"""
Calibrated Fallback Fare Data Generator for IndiGo and Air India.
Used gracefully when live scraping encounters anti-bot protections,
ensuring uninterrupted pipeline operation with realistic Indian domestic fares.
"""
from datetime import datetime, timedelta
import random
from typing import List, Dict


# Realistic baseline economy market fares for domestic trunk routes (INR)
ROUTE_BASE_PRICING = {
    "DEL-BOM": {
        "base_inr": 4800.0,
        "name": "Delhi to Mumbai",
        "origin": "DEL",
        "destination": "BOM"
    },
    "DEL-BLR": {
        "base_inr": 5600.0,
        "name": "Delhi to Bengaluru",
        "origin": "DEL",
        "destination": "BLR"
    }
}

# Lead-time advance purchase multipliers
WINDOW_MULTIPLIERS = {
    1: 1.55,    # T+1: Premium last-minute pricing
    7: 1.18,    # T+7: Typical 1-week advance purchase
    45: 0.90    # T+45: Advance planning discount
}

# Airline brand multipliers
CARRIER_PROFILES = {
    "IndiGo": {
        "carrier_code": "6E",
        "multiplier": 1.0,
        "tax_ratio": 0.18,
        "base_split": 0.82
    },
    "Air India": {
        "carrier_code": "AI",
        "multiplier": 1.08,  # Full service carrier includes meal / baggage
        "tax_ratio": 0.20,
        "base_split": 0.80
    }
}


def get_calibrated_quote(
    carrier: str,
    route: str,
    advance_days: int,
    collection_date: datetime,
    is_fallback: bool = True
) -> Dict:
    """
    Generate a realistic, market-calibrated fare quote for a carrier, route, and window.
    """
    profile = CARRIER_PROFILES.get(carrier, CARRIER_PROFILES["IndiGo"])
    route_info = ROUTE_BASE_PRICING.get(route, ROUTE_BASE_PRICING["DEL-BOM"])
    
    travel_date = collection_date + timedelta(days=advance_days)
    
    # Day of week variation (Friday/Sunday slightly higher)
    dow = travel_date.weekday()
    dow_mult = 1.12 if dow in [4, 6] else (1.06 if dow == 5 else 1.0)
    
    # Advance purchase multiplier
    adv_mult = WINDOW_MULTIPLIERS.get(advance_days, 1.0)
    
    # Plausible random fluctuation (+/- 4%)
    jitter = random.uniform(0.96, 1.04)
    
    calc_total = route_info["base_inr"] * profile["multiplier"] * adv_mult * dow_mult * jitter
    total_fare = round(calc_total, 2)
    base_fare = round(total_fare * profile["base_split"], 2)
    taxes_and_fees = round(total_fare - base_fare, 2)
    
    source_tag = f"{carrier} (Mock Fallback)" if is_fallback else f"{carrier} (Live)"
    
    return {
        "route": route,
        "origin": route_info["origin"],
        "destination": route_info["destination"],
        "carrier": carrier,
        "source": source_tag,
        "advance_purchase_window": f"T+{advance_days}",
        "advance_purchase_days": advance_days,
        "date_scraped": collection_date,
        "collection_date": collection_date,
        "travel_date": travel_date,
        "fare_class": "Economy",
        "base_fare": base_fare,
        "taxes_and_fees": taxes_and_fees,
        "total_fare": total_fare,
        "is_sold_out": False,
        "is_outlier": False
    }


def generate_fallback_dataset(
    carrier: str,
    routes: List[str] = None,
    windows: List[int] = None,
    collection_date: datetime = None
) -> List[Dict]:
    """
    Generate fallback quotes for a carrier across specified routes and windows.
    Default routes: DEL-BOM, DEL-BLR
    Default windows: 1, 7, 45
    """
    if routes is None:
        routes = ["DEL-BOM", "DEL-BLR"]
    if windows is None:
        windows = [1, 7, 45]
    if collection_date is None:
        collection_date = datetime.utcnow()
        
    quotes = []
    for r in routes:
        for w in windows:
            quote = get_calibrated_quote(carrier, r, w, collection_date, is_fallback=True)
            quotes.append(quote)
    return quotes
