"""
Data cleaning pipeline for fare quotes
Handles outlier detection, sold-out filtering, fare splitting, and deduplication
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from data.schema import SessionLocal, FareQuote
from datetime import datetime

class FareCleaner:
    """Cleans raw fare quote data"""
    
    def __init__(self, z_score_threshold: float = 3.0, iqr_multiplier: float = 1.5):
        """
        Initialize fare cleaner
        
        Args:
            z_score_threshold: Threshold for z-score based outlier detection
            iqr_multiplier: Multiplier for IQR-based outlier detection
        """
        self.z_score_threshold = z_score_threshold
        self.iqr_multiplier = iqr_multiplier
    
    def clean_fares(self, collection_date: datetime = None) -> Dict:
        """
        Clean all fare quotes in the database
        
        Args:
            collection_date: Optional date to clean only specific day's data
            
        Returns:
            Dictionary with cleaning statistics
        """
        db = SessionLocal()
        
        try:
            # Get fare quotes
            if collection_date:
                quotes = db.query(FareQuote).filter(
                    FareQuote.collection_date == collection_date
                ).all()
            else:
                quotes = db.query(FareQuote).all()
            
            if not quotes:
                return {
                    'total_quotes': 0,
                    'sold_out_removed': 0,
                    'outliers_removed': 0,
                    'duplicates_removed': 0,
                    'cleaned_quotes': 0
                }
            
            # Convert to DataFrame for processing
            df = pd.DataFrame([{
                'id': q.id,
                'route_id': q.route_id,
                'carrier': q.carrier,
                'collection_date': q.collection_date,
                'travel_date': q.travel_date,
                'advance_purchase_days': q.advance_purchase_days,
                'fare_class': q.fare_class,
                'base_fare': q.base_fare,
                'taxes_and_fees': q.taxes_and_fees,
                'total_fare': q.total_fare,
                'source': q.source,
                'is_sold_out': q.is_sold_out,
                'is_outlier': q.is_outlier
            } for q in quotes])
            
            initial_count = len(df)
            
            # Step 1: Remove sold-out entries
            df = self._remove_sold_out(df)
            sold_out_count = initial_count - len(df)
            
            # Step 2: Remove duplicates
            df = self._remove_duplicates(df)
            duplicates_count = (initial_count - sold_out_count) - len(df)
            
            # Step 3: Split total fare into base fare and taxes where needed
            df = self._split_fare_components(df)
            
            # Step 4: Detect and remove outliers
            df, outlier_ids = self._detect_outliers(df)
            outliers_count = len(outlier_ids)
            
            # Step 5: Update database with cleaning results
            cleaned_count = self._update_database(df, outlier_ids, db)
            
            db.commit()
            
            return {
                'total_quotes': initial_count,
                'sold_out_removed': sold_out_count,
                'duplicates_removed': duplicates_count,
                'outliers_removed': outliers_count,
                'cleaned_quotes': cleaned_count
            }
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
    
    def _remove_sold_out(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove sold-out entries"""
        if df.empty or 'is_sold_out' not in df.columns:
            return df
        return df[~df['is_sold_out']].copy()
    
    def _remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Remove duplicate fare quotes
        Duplicates defined as same route, carrier, travel_date, and advance_purchase_days
        Keep the one with latest collection_date
        """
        if df.empty:
            return df
        
        # Sort by collection_date descending to keep most recent
        df = df.sort_values('collection_date', ascending=False)
        
        # Drop duplicates based on key columns
        df = df.drop_duplicates(
            subset=['route_id', 'carrier', 'travel_date', 'advance_purchase_days'],
            keep='first'
        )
        
        return df
    
    def _split_fare_components(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Split total fare into base fare and taxes where not already separated
        Uses 20% tax rate as approximation for Indian domestic flights
        """
        if df.empty:
            return df
        
        # Split where base_fare or taxes_and_fees is null
        mask = (df['base_fare'].isna()) | (df['taxes_and_fees'].isna())
        
        if mask.any():
            # Apply 20% tax rate
            total_fare = df.loc[mask, 'total_fare']
            df.loc[mask, 'taxes_and_fees'] = total_fare * 0.20
            df.loc[mask, 'base_fare'] = total_fare * 0.80
        
        return df
    
    def _detect_outliers(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[int]]:
        """
        Detect outliers using both z-score and IQR methods
        Outliers are flagged and their IDs returned
        """
        if df.empty:
            return df, []
        
        outlier_ids = []
        
        # Group by route and advance window for outlier detection
        for (route_id, advance_days), group in df.groupby(['route_id', 'advance_purchase_days']):
            if len(group) < 3:  # Need at least 3 data points for outlier detection
                continue
            
            fares = group['total_fare'].values
            
            # Z-score method
            z_scores = np.abs((fares - fares.mean()) / fares.std())
            z_outliers = group[z_scores > self.z_score_threshold]
            
            # IQR method
            q1 = np.percentile(fares, 25)
            q3 = np.percentile(fares, 75)
            iqr = q3 - q1
            lower_bound = q1 - (self.iqr_multiplier * iqr)
            upper_bound = q3 + (self.iqr_multiplier * iqr)
            
            iqr_outliers = group[(group['total_fare'] < lower_bound) | 
                                 (group['total_fare'] > upper_bound)]
            
            # Combine outliers from both methods
            combined_outliers = pd.concat([z_outliers, iqr_outliers]).drop_duplicates()
            outlier_ids.extend(combined_outliers['id'].tolist())
        
        # Mark outliers in dataframe
        df['is_outlier'] = df['id'].isin(outlier_ids)
        
        # Remove outliers from cleaned data
        cleaned_df = df[~df['is_outlier']].copy()
        
        return cleaned_df, outlier_ids
    
    def _update_database(self, df: pd.DataFrame, outlier_ids: List[int], db) -> int:
        """Update database with cleaning results"""
        if df.empty:
            return 0
        
        # Update outlier flags
        for quote_id in outlier_ids:
            quote = db.query(FareQuote).filter(FareQuote.id == quote_id).first()
            if quote:
                quote.is_outlier = True
        
        # Update fare components where they were split
        for _, row in df.iterrows():
            quote = db.query(FareQuote).filter(FareQuote.id == row['id']).first()
            if quote:
                quote.base_fare = row['base_fare']
                quote.taxes_and_fees = row['taxes_and_fees']
        
        return len(df)

def clean_data(collection_date: datetime = None) -> Dict:
    """
    Convenience function to clean fare data
    
    Args:
        collection_date: Optional date to clean specific day's data
        
    Returns:
        Cleaning statistics dictionary
    """
    cleaner = FareCleaner()
    return cleaner.clean_fares(collection_date)

if __name__ == "__main__":
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    from datetime import datetime, timedelta
    
    # Clean all data
    print("Cleaning fare data...")
    stats = clean_data()
    
    print("Cleaning Results:")
    print(f"  Total quotes: {stats['total_quotes']}")
    print(f"  Sold-out removed: {stats['sold_out_removed']}")
    print(f"  Duplicates removed: {stats['duplicates_removed']}")
    print(f"  Outliers removed: {stats['outliers_removed']}")
    print(f"  Cleaned quotes: {stats['cleaned_quotes']}")