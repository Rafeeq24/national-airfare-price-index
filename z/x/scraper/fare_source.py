"""
Fare data source interface and implementations
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import random
import pandas as pd

class FareQuote:
    """Data class for fare quote data"""
    def __init__(self, route_id: int, origin: str, destination: str, carrier: str,
                 collection_date: datetime, travel_date: datetime, advance_purchase_days: int,
                 fare_class: str, base_fare: float, taxes_and_fees: float, total_fare: float,
                 source: str, is_sold_out: bool = False):
        self.route_id = route_id
        self.origin = origin
        self.destination = destination
        self.carrier = carrier
        self.collection_date = collection_date
        self.travel_date = travel_date
        self.advance_purchase_days = advance_purchase_days
        self.fare_class = fare_class
        self.base_fare = base_fare
        self.taxes_and_fees = taxes_and_fees
        self.total_fare = total_fare
        self.source = source
        self.is_sold_out = is_sold_out
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'route_id': self.route_id,
            'origin': self.origin,
            'destination': self.destination,
            'carrier': self.carrier,
            'collection_date': self.collection_date,
            'travel_date': self.travel_date,
            'advance_purchase_days': self.advance_purchase_days,
            'fare_class': self.fare_class,
            'base_fare': self.base_fare,
            'taxes_and_fees': self.taxes_and_fees,
            'total_fare': self.total_fare,
            'source': self.source,
            'is_sold_out': self.is_sold_out
        }

class FareSource(ABC):
    """Abstract base class for fare data sources"""
    
    @abstractmethod
    def collect_fares(self, collection_date: datetime, routes: List[Dict], 
                     advance_windows: List[int]) -> List[FareQuote]:
        """
        Collect fare quotes for given routes and advance purchase windows
        
        Args:
            collection_date: Date when fares are being collected
            routes: List of route dictionaries with route_id, origin, destination
            advance_windows: List of advance purchase days (e.g., [1, 7, 30])
            
        Returns:
            List of FareQuote objects
        """
        pass
    
    @abstractmethod
    def get_source_name(self) -> str:
        """Return the name of this data source"""
        pass

class MockFareSource(FareSource):
    """
    Mock fare source that generates realistic synthetic fare data
    Uses randomized but plausible price variation by route, day-of-week, and lead time
    """
    
    # Base fares for different routes (realistic values in INR)
    BASE_FARES = {
        'DEL-BOM': 4500,    # Delhi to Mumbai
        'DEL-BLR': 5500,    # Delhi to Bangalore
        'BOM-BLR': 4000,    # Mumbai to Bangalore
        'DEL-CCU': 6000,    # Delhi to Kolkata
        'MAA-DEL': 4800     # Chennai to Delhi
    }
    
    # Major Indian carriers
    CARRIERS = ['IndiGo', 'Air India', 'SpiceJet', 'Vistara', 'GoAir']
    
    # Day-of-week multipliers (weekend flights typically more expensive)
    DAY_MULTIPLIERS = {
        0: 1.0,  # Monday
        1: 1.0,  # Tuesday
        2: 1.0,  # Wednesday
        3: 1.05, # Thursday
        4: 1.15, # Friday
        5: 1.20, # Saturday
        6: 1.10  # Sunday
    }
    
    # Advance purchase multipliers (last-minute more expensive)
    ADVANCE_MULTIPLIERS = {
        1: 1.40,    # T+1 (very expensive)
        7: 1.15,    # T+7 (moderately expensive)
        30: 1.0     # T+30 (base price)
    }
    
    def __init__(self, random_seed: Optional[int] = None):
        """Initialize mock source with optional random seed for reproducibility"""
        if random_seed is not None:
            random.seed(random_seed)
        self.source_name = "MockFareSource"
    
    def collect_fares(self, collection_date: datetime, routes: List[Dict], 
                     advance_windows: List[int]) -> List[FareQuote]:
        """Generate mock fare quotes for all route x advance window combinations"""
        fare_quotes = []
        
        for route in routes:
            route_name = f"{route['origin']}-{route['destination']}"
            base_fare = self.BASE_FARES.get(route_name, 5000)
            
            for advance_days in advance_windows:
                travel_date = collection_date + timedelta(days=advance_days)
                
                # Generate quotes from multiple carriers
                for carrier in self.CARRIERS:
                    # Calculate fare with realistic variations
                    total_fare = self._calculate_fare(
                        base_fare, travel_date, advance_days, carrier
                    )
                    
                    # Split into base fare and taxes (approx 20% taxes)
                    taxes_and_fees = total_fare * 0.20
                    base_fare_component = total_fare - taxes_and_fees
                    
                    # Random sold-out flag (5% chance)
                    is_sold_out = random.random() < 0.05
                    
                    quote = FareQuote(
                        route_id=route['id'],
                        origin=route['origin'],
                        destination=route['destination'],
                        carrier=carrier,
                        collection_date=collection_date,
                        travel_date=travel_date,
                        advance_purchase_days=advance_days,
                        fare_class='Economy',
                        base_fare=round(base_fare_component, 2),
                        taxes_and_fees=round(taxes_and_fees, 2),
                        total_fare=round(total_fare, 2),
                        source=self.source_name,
                        is_sold_out=is_sold_out
                    )
                    fare_quotes.append(quote)
        
        return fare_quotes
    
    def _calculate_fare(self, base_fare: float, travel_date: datetime, 
                       advance_days: int, carrier: str) -> float:
        """Calculate fare with realistic variations"""
        
        # Day-of-week effect
        day_multiplier = self.DAY_MULTIPLIERS[travel_date.weekday()]
        
        # Advance purchase effect
        advance_multiplier = self.ADVANCE_MULTIPLIERS.get(advance_days, 1.0)
        
        # Carrier-specific variation (some carriers are premium)
        carrier_multipliers = {
            'IndiGo': 1.0,
            'SpiceJet': 0.95,
            'GoAir': 0.97,
            'Air India': 1.10,
            'Vistara': 1.15
        }
        carrier_multiplier = carrier_multipliers.get(carrier, 1.0)
        
        # Random variation (±10%)
        random_variation = random.uniform(0.90, 1.10)
        
        # Calculate final fare
        fare = (base_fare * day_multiplier * advance_multiplier * 
                carrier_multiplier * random_variation)
        
        return round(fare, 2)
    
    def get_source_name(self) -> str:
        return self.source_name

class LiveFareSource(FareSource):
    """
    Stub for live fare scraping using Playwright
    Structured to allow real scraper implementation without changing pipeline
    """
    
    def __init__(self, airline_site: str = "IndiGo"):
        """Initialize live fare source"""
        self.airline_site = airline_site
        self.source_name = f"LiveFareSource-{airline_site}"
        self.rate_limit_delay = 2  # seconds between requests
        self.respect_robots_txt = True
    
    def collect_fares(self, collection_date: datetime, routes: List[Dict], 
                     advance_windows: List[int]) -> List[FareQuote]:
        """
        Stub for live fare collection
        TODO: Implement actual Playwright-based scraping
        """
        # This is a stub - would implement Playwright scraping here
        # Structure:
        # 1. Check robots.txt for allowed paths
        # 2. Use Playwright to navigate to airline site
        # 3. Input route details and dates
        # 4. Extract fare information
        # 5. Apply rate limiting
        # 6. Handle CAPTCHAs (log and skip, do not attempt to bypass)
        
        print(f"LiveFareSource: Would scrape {self.airline_site} for {len(routes)} routes")
        print(f"Advance windows: {advance_windows}")
        print("Note: This is a stub - actual scraping not implemented")
        
        return []  # Return empty list for now
    
    def get_source_name(self) -> str:
        return self.source_name