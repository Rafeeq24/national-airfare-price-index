"""
Database models and connection handling for Airfare Price Index (APIx).
Supports both PostgreSQL (via DATABASE_URL) and local SQLite fallback.
"""
import os
import sys
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, text, inspect
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship

# Determine database URL: check DATABASE_URL env var, else fall back to local SQLite
DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "airfare_prices.db"
)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Use SQLite
    os.makedirs(os.path.dirname(DEFAULT_SQLITE_PATH), exist_ok=True)
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

# Connect args for SQLite
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Route(Base):
    """Represents a tracked city-pair route (e.g., DEL-BOM, DEL-BLR)."""
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True)
    origin = Column(String(3), nullable=False)  # IATA code, e.g. "DEL"
    destination = Column(String(3), nullable=False)  # IATA code, e.g. "BOM"
    route_name = Column(String(50), nullable=False, unique=True)  # e.g., "DEL-BOM"
    weight = Column(Float, default=1.0)  # Traffic-proportional weight
    base_period_avg_fare = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    fare_quotes = relationship("FareQuote", back_populates="route_rel")

    def __repr__(self):
        return f"<Route {self.route_name} (weight={self.weight})>"


class FareQuote(Base):
    """
    Individual fare quote record (stored in 'fare_quotes', also accessible as fares).
    Stores route, origin, destination, carrier, advance_purchase_window (T+1, T+7, T+45),
    date_scraped, base_fare, total_fare, and data source status.
    """
    __tablename__ = "fare_quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    route = Column(String(50), nullable=True)  # e.g. "DEL-BOM"
    origin = Column(String(3), nullable=True)  # e.g. "DEL"
    destination = Column(String(3), nullable=True)  # e.g. "BOM"
    carrier = Column(String(50), nullable=False)  # "IndiGo", "Air India"
    source = Column(String(100), nullable=False)  # e.g. "IndiGo (Live)", "Air India (Mock Fallback)"
    advance_purchase_window = Column(String(10), nullable=True)  # "T+1", "T+7", "T+45"
    advance_purchase_days = Column(Integer, nullable=False, default=1)  # 1, 7, 45
    date_scraped = Column(DateTime, nullable=True, default=datetime.utcnow)
    collection_date = Column(DateTime, nullable=False, default=datetime.utcnow)  # For backwards compatibility
    travel_date = Column(DateTime, nullable=False)
    fare_class = Column(String(20), default="Economy")
    base_fare = Column(Float, nullable=True)
    taxes_and_fees = Column(Float, nullable=True)
    total_fare = Column(Float, nullable=False)
    is_sold_out = Column(Boolean, default=False)
    is_outlier = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    route_rel = relationship("Route", back_populates="fare_quotes")

    def to_dict(self):
        return {
            "id": self.id,
            "route": self.route or (f"{self.origin}-{self.destination}" if self.origin and self.destination else "N/A"),
            "origin": self.origin,
            "destination": self.destination,
            "carrier": self.carrier,
            "source": self.source,
            "advance_purchase_window": self.advance_purchase_window or f"T+{self.advance_purchase_days}",
            "advance_purchase_days": self.advance_purchase_days,
            "date_scraped": self.date_scraped.isoformat() if self.date_scraped else None,
            "travel_date": self.travel_date.isoformat() if self.travel_date else None,
            "fare_class": self.fare_class,
            "base_fare": self.base_fare,
            "taxes_and_fees": self.taxes_and_fees,
            "total_fare": self.total_fare,
            "is_sold_out": self.is_sold_out,
            "is_outlier": self.is_outlier
        }


class RouteWindowIndex(Base):
    """
    Computed daily index series per route AND per booking window
    (e.g., DEL-BOM at T+1, T+7, T+45).
    """
    __tablename__ = "route_window_index"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_name = Column(String(50), nullable=False)  # "DEL-BOM", "DEL-BLR"
    window = Column(String(10), nullable=False)      # "T+1", "T+7", "T+45"
    index_date = Column(DateTime, nullable=False)
    index_value = Column(Float, nullable=False)     # Base-100 value
    base_fare = Column(Float, nullable=False)       # Reference base fare
    current_avg_fare = Column(Float, nullable=False)# Observed average fare
    num_quotes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "route": self.route_name,
            "window": self.window,
            "index_date": self.index_date.strftime("%Y-%m-%d"),
            "index_value": round(self.index_value, 2),
            "base_fare": round(self.base_fare, 2),
            "current_avg_fare": round(self.current_avg_fare, 2),
            "num_quotes": self.num_quotes
        }


class DailyIndex(Base):
    """Overall national composite daily index."""
    __tablename__ = "daily_index"

    id = Column(Integer, primary_key=True)
    index_date = Column(DateTime, nullable=False, unique=True)
    apix_value = Column(Float, nullable=False)
    base_period_value = Column(Float, default=100.0)
    computation_method = Column(String(50), default="weighted_laspeyres")
    num_routes_covered = Column(Integer, default=0)
    num_quotes_analyzed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeeklyIndex(Base):
    """Computed weekly index values."""
    __tablename__ = "weekly_index"

    id = Column(Integer, primary_key=True)
    week_start_date = Column(DateTime, nullable=False, unique=True)
    week_end_date = Column(DateTime, nullable=False)
    apix_value = Column(Float, nullable=False)
    base_period_value = Column(Float, default=100.0)
    num_daily_values = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class MonthlyIndex(Base):
    """Computed monthly index values."""
    __tablename__ = "monthly_index"

    id = Column(Integer, primary_key=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    apix_value = Column(Float, nullable=False)
    base_period_value = Column(Float, default=100.0)
    num_daily_values = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


def migrate_and_seed():
    """
    Run migration to ensure all columns exist, backfill missing values in existing records,
    and guarantee required routes exist.
    """
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    # Check for missing columns in fare_quotes
    if "fare_quotes" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("fare_quotes")]
        with engine.begin() as conn:
            if "route" not in columns:
                conn.execute(text("ALTER TABLE fare_quotes ADD COLUMN route VARCHAR(50)"))
            if "origin" not in columns:
                conn.execute(text("ALTER TABLE fare_quotes ADD COLUMN origin VARCHAR(3)"))
            if "destination" not in columns:
                conn.execute(text("ALTER TABLE fare_quotes ADD COLUMN destination VARCHAR(3)"))
            if "advance_purchase_window" not in columns:
                conn.execute(text("ALTER TABLE fare_quotes ADD COLUMN advance_purchase_window VARCHAR(10)"))
            if "date_scraped" not in columns:
                conn.execute(text("ALTER TABLE fare_quotes ADD COLUMN date_scraped DATETIME"))

            # Backfill existing records if they have null route / window
            conn.execute(text("""
                UPDATE fare_quotes
                SET date_scraped = collection_date
                WHERE date_scraped IS NULL
            """))

            conn.execute(text("""
                UPDATE fare_quotes
                SET advance_purchase_window = 'T+' || CAST(advance_purchase_days AS TEXT)
                WHERE advance_purchase_window IS NULL AND advance_purchase_days IS NOT NULL
            """))

            # Backfill route, origin, destination from routes table if route_id is present
            conn.execute(text("""
                UPDATE fare_quotes
                SET route = (SELECT route_name FROM routes WHERE routes.id = fare_quotes.route_id),
                    origin = (SELECT origin FROM routes WHERE routes.id = fare_quotes.route_id),
                    destination = (SELECT destination FROM routes WHERE routes.id = fare_quotes.route_id)
                WHERE route IS NULL AND route_id IS NOT NULL
            """))

    # Ensure required routes (DEL-BOM and DEL-BLR) exist
    with SessionLocal() as db:
        routes_to_ensure = [
            {"origin": "DEL", "destination": "BOM", "route_name": "DEL-BOM", "weight": 0.35},
            {"origin": "DEL", "destination": "BLR", "route_name": "DEL-BLR", "weight": 0.25},
        ]
        for r_data in routes_to_ensure:
            existing = db.query(Route).filter(Route.route_name == r_data["route_name"]).first()
            if not existing:
                new_route = Route(
                    origin=r_data["origin"],
                    destination=r_data["destination"],
                    route_name=r_data["route_name"],
                    weight=r_data["weight"],
                    created_at=datetime.utcnow()
                )
                db.add(new_route)
        db.commit()


def init_db():
    """Public DB initializer."""
    migrate_and_seed()
    print("Database schema verified and migrated successfully.")


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
