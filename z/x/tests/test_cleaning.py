"""
Tests for cleaning pipeline logic
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.cleaning import FareCleaner

class TestFareCleaner:
    """Test suite for FareCleaner class"""
    
    def test_remove_sold_out(self):
        """Test removal of sold-out entries"""
        cleaner = FareCleaner()
        
        # Create test data
        df = pd.DataFrame({
            'id': [1, 2, 3, 4],
            'total_fare': [100, 200, 300, 400],
            'is_sold_out': [True, False, True, False]
        })
        
        result = cleaner._remove_sold_out(df)
        
        assert len(result) == 2
        assert not result['is_sold_out'].any()  # Use .any() method on Series
        assert list(result['id']) == [2, 4]
    
    def test_remove_duplicates(self):
        """Test removal of duplicate entries"""
        cleaner = FareCleaner()
        
        # Create test data with duplicates
        df = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'route_id': [1, 1, 2, 2, 3],
            'carrier': ['IndiGo', 'IndiGo', 'Air India', 'Air India', 'SpiceJet'],
            'travel_date': [
                datetime(2024, 1, 1),
                datetime(2024, 1, 1),
                datetime(2024, 1, 2),
                datetime(2024, 1, 2),
                datetime(2024, 1, 3)
            ],
            'advance_purchase_days': [7, 7, 14, 14, 7],
            'collection_date': [
                datetime(2024, 1, 1),
                datetime(2024, 1, 2),  # More recent, should be kept
                datetime(2024, 1, 1),
                datetime(2024, 1, 2),  # More recent, should be kept
                datetime(2024, 1, 1)
            ],
            'total_fare': [100, 110, 200, 210, 300]
        })
        
        result = cleaner._remove_duplicates(df)
        
        assert len(result) == 3
        # Should keep the more recent collection dates
        assert result[result['route_id'] == 1]['total_fare'].values[0] == 110
        assert result[result['route_id'] == 2]['total_fare'].values[0] == 210
    
    def test_split_fare_components(self):
        """Test splitting total fare into base fare and taxes"""
        cleaner = FareCleaner()
        
        # Create test data with missing components
        df = pd.DataFrame({
            'id': [1, 2, 3],
            'total_fare': [100, 200, 300],
            'base_fare': [80, None, None],
            'taxes_and_fees': [20, None, None]
        })
        
        result = cleaner._split_fare_components(df)
        
        # Check that missing values were filled with 20% tax rate
        assert result.loc[1, 'base_fare'] == 160.0  # 200 * 0.8
        assert result.loc[1, 'taxes_and_fees'] == 40.0  # 200 * 0.2
        assert result.loc[2, 'base_fare'] == 240.0  # 300 * 0.8
        assert result.loc[2, 'taxes_and_fees'] == 60.0  # 300 * 0.2
        
        # Check that existing values were not changed
        assert result.loc[0, 'base_fare'] == 80.0
        assert result.loc[0, 'taxes_and_fees'] == 20.0
    
    def test_detect_outliers_z_score(self):
        """Test z-score based outlier detection"""
        cleaner = FareCleaner(z_score_threshold=2.0)
        
        # Create test data with clear outlier
        df = pd.DataFrame({
            'id': [1, 2, 3, 4, 5],
            'route_id': [1, 1, 1, 1, 1],
            'advance_purchase_days': [7, 7, 7, 7, 7],
            'total_fare': [100, 105, 98, 102, 500]  # 500 is clear outlier
        })
        
        result, outlier_ids = cleaner._detect_outliers(df)
        
        assert len(outlier_ids) == 1
        assert 5 in outlier_ids  # The outlier ID
        assert len(result) == 4  # Should remove the outlier
    
    def test_detect_outliers_iqr(self):
        """Test IQR based outlier detection"""
        cleaner = FareCleaner(iqr_multiplier=1.5)
        
        # Create test data with outliers
        df = pd.DataFrame({
            'id': [1, 2, 3, 4, 5, 6, 7],
            'route_id': [1, 1, 1, 1, 1, 1, 1],
            'advance_purchase_days': [7, 7, 7, 7, 7, 7, 7],
            'total_fare': [100, 105, 98, 102, 95, 108, 500]  # 500 is outlier
        })
        
        result, outlier_ids = cleaner._detect_outliers(df)
        
        assert len(outlier_ids) >= 1  # Should detect at least the obvious outlier
        assert len(result) < len(df)  # Should remove some outliers
    
    def test_detect_outliers_insufficient_data(self):
        """Test that outlier detection requires minimum data points"""
        cleaner = FareCleaner()
        
        # Create test data with insufficient points
        df = pd.DataFrame({
            'id': [1, 2],
            'route_id': [1, 1],
            'advance_purchase_days': [7, 7],
            'total_fare': [100, 500]
        })
        
        result, outlier_ids = cleaner._detect_outliers(df)
        
        # Should not detect outliers with insufficient data
        assert len(outlier_ids) == 0
        assert len(result) == 2
    
    def test_empty_dataframe_handling(self):
        """Test handling of empty dataframes"""
        cleaner = FareCleaner()
        
        # Create empty dataframe with proper columns
        empty_df = pd.DataFrame(columns=['id', 'total_fare', 'is_sold_out', 'route_id', 
                                        'carrier', 'travel_date', 'advance_purchase_days',
                                        'collection_date', 'fare_class', 'base_fare', 
                                        'taxes_and_fees', 'source'])
        
        # All methods should handle empty dataframes gracefully
        result = cleaner._remove_sold_out(empty_df)
        assert len(result) == 0
        
        result = cleaner._remove_duplicates(empty_df)
        assert len(result) == 0
        
        result = cleaner._split_fare_components(empty_df)
        assert len(result) == 0
        
        result, outlier_ids = cleaner._detect_outliers(empty_df)
        assert len(result) == 0
        assert len(outlier_ids) == 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])