"""
Data model and SQLite schema for Airfare Price Index (APIx)
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime
import os

# SQLite database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "airfare_prices.db")

# Create engine
engine = create_engine(f"sqlite:///{DATABASE_PATH}", echo=False)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

class Route(Base):
    """Represents a city-pair route"""
    __tablename__ = "routes"
    
    id = Column(Integer, primary_key=True)
    origin = Column(String(3), nullable=False)  # IATA airport code
    destination = Column(String(3), nullable=False)  # IATA airport code
    route_name = Column(String(50), nullable=False)  # e.g., "DEL-BOM"
    weight = Column(Float, default=1.0)  # DGCA traffic-proportional weight
    base_period_avg_fare = Column(Float, nullable=True)  # Base period average fare for index calculation
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    fare_quotes = relationship("FareQuote", back_populates="route")
    
    def __repr__(self):
        return f"<Route {self.route_name} (weight={self.weight})>"

class FareQuote(Base):
    """Individual fare quote record"""
    __tablename__ = "fare_quotes"
    
    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    carrier = Column(String(50), nullable=False)  # Airline name
    collection_date = Column(DateTime, nullable=False)  # When data was collected
    travel_date = Column(DateTime, nullable=False)  # Flight date
    advance_purchase_days = Column(Integer, nullable=False)  # Days between collection and travel
    fare_class = Column(String(10), nullable=False)  # Economy, Business, etc.
    base_fare = Column(Float, nullable=True)  # Base fare component
    taxes_and_fees = Column(Float, nullable=True)  # Taxes and fees component
    total_fare = Column(Float, nullable=False)  # Total fare
    source = Column(String(50), nullable=False)  # Data source (airline/OTA name)
    is_sold_out = Column(Boolean, default=False)  # Sold out flag
    is_outlier = Column(Boolean, default=False)  # Flagged as statistical outlier
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    route = relationship("Route", back_populates="fare_quotes")
    
    def __repr__(self):
        return f"<FareQuote {self.route.route_name} {self.carrier} {self.travel_date.strftime('%Y-%m-%d')} ₹{self.total_fare}>"

class DailyIndex(Base):
    """Computed daily index values"""
    __tablename__ = "daily_index"
    
    id = Column(Integer, primary_key=True)
    index_date = Column(DateTime, nullable=False, unique=True)
    apix_value = Column(Float, nullable=False)  # Overall APIx value
    base_period_value = Column(Float, default=100.0)  # Base period value (usually 100)
    computation_method = Column(String(50), default="weighted_laspeyres")  # Index computation method
    num_routes_covered = Column(Integer, default=0)  # Number of routes with data
    num_quotes_analyzed = Column(Integer, default=0)  # Total quotes used in computation
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DailyIndex {self.index_date.strftime('%Y-%m-%d')} APIx={self.apix_value:.2f}>"

class WeeklyIndex(Base):
    """Computed weekly index values (aggregated from daily)"""
    __tablename__ = "weekly_index"
    
    id = Column(Integer, primary_key=True)
    week_start_date = Column(DateTime, nullable=False, unique=True)
    week_end_date = Column(DateTime, nullable=False)
    apix_value = Column(Float, nullable=False)
    base_period_value = Column(Float, default=100.0)
    num_daily_values = Column(Integer, default=0)  # Number of daily values in this week
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<WeeklyIndex {self.week_start_date.strftime('%Y-%m-%d')} APIx={self.apix_value:.2f}>"

class MonthlyIndex(Base):
    """Computed monthly index values (aggregated from daily)"""
    __tablename__ = "monthly_index"
    
    id = Column(Integer, primary_key=True)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    apix_value = Column(Float, nullable=False)
    base_period_value = Column(Float, default=100.0)
    num_daily_values = Column(Integer, default=0)  # Number of daily values in this month
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<MonthlyIndex {self.year}-{self.month:02d} APIx={self.apix_value:.2f}>"

def init_db():
    """Initialize database with all tables"""
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized at {DATABASE_PATH}")

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    init_db()