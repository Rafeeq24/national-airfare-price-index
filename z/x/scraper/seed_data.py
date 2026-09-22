"""
Seed script to generate ~30 days of mock fare data
This allows the dashboard to show data immediately without waiting for live collection
"""
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.schema import init_db, SessionLocal, Route, FareQuote
from scraper.fare_source import MockFareSource

# Route configuration with realistic DGCA-traffic-proportional weights
ROUTES_CONFIG = [
    {
        'id': 1,
        'origin': 'DEL',
        'destination': 'BOM',
        'route_name': 'DEL-BOM',
        'weight': 0.35  # Delhi-Mumbai is highest traffic route
    },
    {
        'id': 2,
        'origin': 'DEL',
        'destination': 'BLR',
        'route_name': 'DEL-BLR',
        'weight': 0.25  # Delhi-Bangalore high traffic
    },
    {
        'id': 3,
        'origin': 'BOM',
        'destination': 'BLR',
        'route_name': 'BOM-BLR',
        'weight': 0.20  # Mumbai-Bangalore medium traffic
    },
    {
        'id': 4,
        'origin': 'DEL',
        'destination': 'CCU',
        'route_name': 'DEL-CCU',
        'weight': 0.12  # Delhi-Kolkata lower traffic
    },
    {
        'id': 5,
        'origin': 'MAA',
        'destination': 'DEL',
        'route_name': 'MAA-DEL',
        'weight': 0.08  # Chennai-Delhi lowest traffic
    }
]

# Advance purchase windows
ADVANCE_WINDOWS = [1, 7, 30]  # T+1, T+7, T+30

def seed_database(num_days: int = 30):
    """
    Seed database with mock fare data for specified number of days
    
    Args:
        num_days: Number of days to generate data for
    """
    print(f"Seeding database with {num_days} days of mock fare data...")
    
    # Initialize database
    init_db()
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Insert routes
        print("Creating routes...")
        for route_config in ROUTES_CONFIG:
            existing_route = db.query(Route).filter(
                Route.route_name == route_config['route_name']
            ).first()
            
            if not existing_route:
                route = Route(
                    id=route_config['id'],
                    origin=route_config['origin'],
                    destination=route_config['destination'],
                    route_name=route_config['route_name'],
                    weight=route_config['weight']
                )
                db.add(route)
        
        db.commit()
        print(f"Created {len(ROUTES_CONFIG)} routes")
        
        # Get routes from database
        routes = db.query(Route).all()
        routes_data = [
            {
                'id': route.id,
                'origin': route.origin,
                'destination': route.destination
            }
            for route in routes
        ]
        
        # Initialize mock fare source
        mock_source = MockFareSource(random_seed=42)  # Fixed seed for reproducibility
        
        # Generate data for each day
        print(f"Generating fare data for {num_days} days...")
        start_date = datetime.now() - timedelta(days=num_days)
        
        total_quotes = 0
        
        for day_offset in range(num_days):
            collection_date = start_date + timedelta(days=day_offset)
            
            # Collect fares for this day
            fare_quotes = mock_source.collect_fares(
                collection_date=collection_date,
                routes=routes_data,
                advance_windows=ADVANCE_WINDOWS
            )
            
            # Convert to database models and insert
            for quote in fare_quotes:
                db_quote = FareQuote(
                    route_id=quote.route_id,
                    carrier=quote.carrier,
                    collection_date=quote.collection_date,
                    travel_date=quote.travel_date,
                    advance_purchase_days=quote.advance_purchase_days,
                    fare_class=quote.fare_class,
                    base_fare=quote.base_fare,
                    taxes_and_fees=quote.taxes_and_fees,
                    total_fare=quote.total_fare,
                    source=quote.source,
                    is_sold_out=quote.is_sold_out
                )
                db.add(db_quote)
                total_quotes += 1
            
            # Commit every 5 days to avoid large transactions
            if (day_offset + 1) % 5 == 0:
                db.commit()
                print(f"  Generated data for day {day_offset + 1}/{num_days}")
        
        # Final commit
        db.commit()
        
        print(f"\nDatabase seeding complete!")
        print(f"   - Routes: {len(routes)}")
        print(f"   - Days: {num_days}")
        print(f"   - Total fare quotes: {total_quotes}")
        print(f"   - Advance windows: {ADVANCE_WINDOWS}")
        
        # Display sample data
        print("\nSample fare data:")
        sample_quotes = db.query(FareQuote).limit(5).all()
        for quote in sample_quotes:
            print(f"   {quote.route.route_name} | {quote.carrier} | "
                  f"{quote.travel_date.strftime('%Y-%m-%d')} | "
                  f"T+{quote.advance_purchase_days} | INR {quote.total_fare}")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed database with mock fare data")
    parser.add_argument("--days", type=int, default=30, 
                       help="Number of days to generate data for (default: 30)")
    parser.add_argument("--reset", action="store_true",
                       help="Reset database before seeding (delete existing data)")
    
    args = parser.parse_args()
    
    if args.reset:
        print("Reset option enabled - this will delete existing data")
        response = input("Are you sure? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborting")
            sys.exit(0)
        
        # Delete existing database
        db_path = os.path.join(os.path.dirname(__file__), "..", "data", "airfare_prices.db")
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"Deleted existing database: {db_path}")
    
    seed_database(num_days=args.days)