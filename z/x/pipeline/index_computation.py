"""
Index computation module for Airfare Price Index (APIx)
Uses weighted Laspeyres-style price-relative index method
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy import extract
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.schema import SessionLocal, Route, FareQuote, DailyIndex, WeeklyIndex, MonthlyIndex

class IndexCalculator:
    """Computes airfare price index using weighted Laspeyres method"""
    
    def __init__(self, base_period_days: int = 7):
        """
        Initialize index calculator
        
        Args:
            base_period_days: Number of days to use as base period (default: 7 days)
        """
        self.base_period_days = base_period_days
        self.base_period_value = 100.0  # Base period index value
    
    def compute_daily_index(self, computation_date: datetime) -> Dict:
        """
        Compute daily index value for a specific date
        
        Args:
            computation_date: Date to compute index for
            
        Returns:
            Dictionary with index computation results
        """
        db = SessionLocal()
        
        try:
            # Get all routes with their weights
            routes = db.query(Route).all()
            if not routes:
                return {'error': 'No routes found in database'}
            
            # Determine base period (first 7 days of data)
            first_quote = db.query(FareQuote).order_by(FareQuote.collection_date).first()
            if not first_quote:
                return {'error': 'No fare quotes found in database'}
            
            base_start = first_quote.collection_date
            base_end = base_start + timedelta(days=self.base_period_days)
            
            # Compute base period average fares per route
            base_fares = self._compute_base_period_fares(db, routes, base_start, base_end)
            
            # Store base period fares in routes table
            for route in routes:
                if route.id in base_fares:
                    route.base_period_avg_fare = base_fares[route.id]
            
            db.commit()
            
            # Get fares for computation date
            current_fares = self._compute_current_period_fares(db, routes, computation_date)
            
            # Compute weighted index
            index_value = self._compute_weighted_index(routes, base_fares, current_fares)
            
            # Count quotes analyzed
            num_quotes = db.query(FareQuote).filter(
                FareQuote.collection_date == computation_date,
                FareQuote.is_outlier == False,
                FareQuote.is_sold_out == False
            ).count()
            
            # Store daily index
            existing_index = db.query(DailyIndex).filter(
                DailyIndex.index_date == computation_date
            ).first()
            
            if existing_index:
                existing_index.apix_value = index_value
                existing_index.num_routes_covered = len([r for r in routes if r.id in current_fares])
                existing_index.num_quotes_analyzed = num_quotes
            else:
                daily_index = DailyIndex(
                    index_date=computation_date,
                    apix_value=index_value,
                    base_period_value=self.base_period_value,
                    computation_method='weighted_laspeyres',
                    num_routes_covered=len([r for r in routes if r.id in current_fares]),
                    num_quotes_analyzed=num_quotes
                )
                db.add(daily_index)
            
            db.commit()
            
            return {
                'date': computation_date.strftime('%Y-%m-%d'),
                'apix_value': index_value,
                'base_period_start': base_start.strftime('%Y-%m-%d'),
                'base_period_end': base_end.strftime('%Y-%m-%d'),
                'num_routes_covered': len([r for r in routes if r.id in current_fares]),
                'num_quotes_analyzed': num_quotes,
                'base_fares': base_fares,
                'current_fares': current_fares
            }
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def _compute_base_period_fares(self, db, routes: List[Route], 
                                   base_start: datetime, base_end: datetime) -> Dict[int, float]:
        """Compute average fare per route for base period"""
        base_fares = {}
        
        for route in routes:
            # Get quotes for this route in base period
            quotes = db.query(FareQuote).filter(
                FareQuote.route_id == route.id,
                FareQuote.collection_date >= base_start,
                FareQuote.collection_date < base_end,
                FareQuote.is_outlier == False,
                FareQuote.is_sold_out == False
            ).all()
            
            if quotes:
                avg_fare = np.mean([q.total_fare for q in quotes])
                base_fares[route.id] = avg_fare
        
        return base_fares
    
    def _compute_current_period_fares(self, db, routes: List[Route], 
                                    computation_date: datetime) -> Dict[int, float]:
        """Compute average fare per route for computation date"""
        current_fares = {}
        
        for route in routes:
            # Get quotes for this route on computation date
            quotes = db.query(FareQuote).filter(
                FareQuote.route_id == route.id,
                FareQuote.collection_date == computation_date,
                FareQuote.is_outlier == False,
                FareQuote.is_sold_out == False
            ).all()
            
            if quotes:
                avg_fare = np.mean([q.total_fare for q in quotes])
                current_fares[route.id] = avg_fare
        
        return current_fares
    
    def _compute_weighted_index(self, routes: List[Route], 
                                base_fares: Dict[int, float], 
                                current_fares: Dict[int, float]) -> float:
        """
        Compute weighted Laspeyres index
        
        Formula: Σ(weight_i * (current_fare_i / base_fare_i)) * 100
        """
        weighted_sum = 0.0
        total_weight = 0.0
        
        for route in routes:
            if route.id in base_fares and route.id in current_fares:
                price_relative = current_fares[route.id] / base_fares[route.id]
                weighted_contribution = route.weight * price_relative
                weighted_sum += weighted_contribution
                total_weight += route.weight
        
        if total_weight == 0:
            return 100.0  # Return base value if no data
        
        # Normalize by total weight and scale to base period value
        index_value = (weighted_sum / total_weight) * self.base_period_value
        
        return round(index_value, 2)
    
    def compute_weekly_aggregation(self, week_start: datetime) -> Dict:
        """Aggregate daily indices to weekly level"""
        db = SessionLocal()
        
        try:
            week_end = week_start + timedelta(days=6)
            
            # Get daily indices for the week
            daily_indices = db.query(DailyIndex).filter(
                DailyIndex.index_date >= week_start,
                DailyIndex.index_date <= week_end
            ).all()
            
            if not daily_indices:
                return {'error': 'No daily indices found for this week'}
            
            # Compute weekly average
            weekly_value = np.mean([d.apix_value for d in daily_indices])
            
            # Store weekly index
            existing_weekly = db.query(WeeklyIndex).filter(
                WeeklyIndex.week_start_date == week_start
            ).first()
            
            if existing_weekly:
                existing_weekly.apix_value = weekly_value
                existing_weekly.num_daily_values = len(daily_indices)
            else:
                weekly_index = WeeklyIndex(
                    week_start_date=week_start,
                    week_end_date=week_end,
                    apix_value=weekly_value,
                    base_period_value=self.base_period_value,
                    num_daily_values=len(daily_indices)
                )
                db.add(weekly_index)
            
            db.commit()
            
            return {
                'week_start': week_start.strftime('%Y-%m-%d'),
                'week_end': week_end.strftime('%Y-%m-%d'),
                'apix_value': weekly_value,
                'num_daily_values': len(daily_indices)
            }
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def compute_monthly_aggregation(self, year: int, month: int) -> Dict:
        """Aggregate daily indices to monthly level"""
        db = SessionLocal()
        
        try:
            # Get daily indices for the month using SQLAlchemy extract
            daily_indices = db.query(DailyIndex).filter(
                extract('year', DailyIndex.index_date) == year,
                extract('month', DailyIndex.index_date) == month
            ).all()
            
            if not daily_indices:
                return {'error': 'No daily indices found for this month'}
            
            # Compute monthly average
            monthly_value = np.mean([d.apix_value for d in daily_indices])
            
            # Store monthly index
            existing_monthly = db.query(MonthlyIndex).filter(
                MonthlyIndex.year == year,
                MonthlyIndex.month == month
            ).first()
            
            if existing_monthly:
                existing_monthly.apix_value = monthly_value
                existing_monthly.num_daily_values = len(daily_indices)
            else:
                monthly_index = MonthlyIndex(
                    month=month,
                    year=year,
                    apix_value=monthly_value,
                    base_period_value=self.base_period_value,
                    num_daily_values=len(daily_indices)
                )
                db.add(monthly_index)
            
            db.commit()
            
            return {
                'year': year,
                'month': month,
                'apix_value': monthly_value,
                'num_daily_values': len(daily_indices)
            }
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

def compute_all_indices(start_date: datetime = None, end_date: datetime = None) -> Dict:
    """
    Compute indices for all dates in range
    
    Args:
        start_date: Start date for computation (default: first available date)
        end_date: End date for computation (default: last available date)
        
    Returns:
        Computation summary
    """
    db = SessionLocal()
    
    try:
        if not start_date:
            first_quote = db.query(FareQuote).order_by(FareQuote.collection_date).first()
            start_date = first_quote.collection_date if first_quote else datetime.now()
        
        if not end_date:
            last_quote = db.query(FareQuote).order_by(FareQuote.collection_date.desc()).first()
            end_date = last_quote.collection_date if last_quote else datetime.now()
        
        calculator = IndexCalculator()
        
        current_date = start_date
        daily_computations = []
        
        while current_date <= end_date:
            result = calculator.compute_daily_index(current_date)
            if 'error' not in result:
                daily_computations.append(result)
            current_date += timedelta(days=1)
        
        # Compute weekly aggregations
        week_starts = set()
        for daily in daily_computations:
            date = datetime.strptime(daily['date'], '%Y-%m-%d')
            week_start = date - timedelta(days=date.weekday())
            week_starts.add(week_start)
        
        weekly_computations = []
        for week_start in sorted(week_starts):
            result = calculator.compute_weekly_aggregation(week_start)
            if 'error' not in result:
                weekly_computations.append(result)
        
        # Compute monthly aggregations
        months = set()
        for daily in daily_computations:
            date = datetime.strptime(daily['date'], '%Y-%m-%d')
            months.add((date.year, date.month))
        
        monthly_computations = []
        for year, month in sorted(months):
            result = calculator.compute_monthly_aggregation(year, month)
            if 'error' not in result:
                monthly_computations.append(result)
        
        return {
            'daily_count': len(daily_computations),
            'weekly_count': len(weekly_computations),
            'monthly_count': len(monthly_computations),
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d')
        }
        
    except Exception as e:
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    print("Computing indices for all available dates...")
    result = compute_all_indices()
    
    print("Index Computation Results:")
    print(f"  Daily indices computed: {result['daily_count']}")
    print(f"  Weekly indices computed: {result['weekly_count']}")
    print(f"  Monthly indices computed: {result['monthly_count']}")
    print(f"  Date range: {result['start_date']} to {result['end_date']}")