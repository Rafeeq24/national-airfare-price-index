"""
Tests for index computation logic
"""
import pytest
import numpy as np
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.index_computation import IndexCalculator

class TestIndexCalculator:
    """Test suite for IndexCalculator class"""
    
    def test_weighted_index_calculation(self):
        """Test weighted Laspeyres index calculation"""
        calculator = IndexCalculator()
        
        # Mock route data
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        routes = [
            MockRoute(1, 0.4),  # High weight route
            MockRoute(2, 0.3),  # Medium weight route
            MockRoute(3, 0.3)   # Medium weight route
        ]
        
        # Base period fares
        base_fares = {
            1: 100.0,
            2: 200.0,
            3: 150.0
        }
        
        # Current period fares (10% increase across all routes)
        current_fares = {
            1: 110.0,  # 10% increase
            2: 220.0,  # 10% increase
            3: 165.0   # 10% increase
        }
        
        # Calculate index
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Expected: All routes increased by 10%, so index should be 110
        assert index_value == 110.0
    
    def test_weighted_index_with_mixed_changes(self):
        """Test index calculation with mixed fare changes"""
        calculator = IndexCalculator()
        
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        routes = [
            MockRoute(1, 0.5),  # High weight, price increase
            MockRoute(2, 0.5)   # High weight, price decrease
        ]
        
        base_fares = {
            1: 100.0,
            2: 100.0
        }
        
        current_fares = {
            1: 120.0,  # 20% increase
            2: 90.0   # 10% decrease
        }
        
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Expected: (0.5 * 1.2 + 0.5 * 0.9) * 100 = 105
        assert index_value == 105.0
    
    def test_weighted_index_missing_route_data(self):
        """Test index calculation when some routes have no data"""
        calculator = IndexCalculator()
        
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        routes = [
            MockRoute(1, 0.4),
            MockRoute(2, 0.3),
            MockRoute(3, 0.3)
        ]
        
        base_fares = {
            1: 100.0,
            2: 200.0
            # Route 3 missing from base period
        }
        
        current_fares = {
            1: 110.0,
            2: 220.0
            # Route 3 missing from current period
        }
        
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Should only use available routes (1 and 2)
        # Expected: (0.4 * 1.1 + 0.3 * 1.1) / (0.4 + 0.3) * 100 = 110
        assert index_value == 110.0
    
    def test_weighted_index_no_data(self):
        """Test index calculation when no data is available"""
        calculator = IndexCalculator()
        
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        routes = [MockRoute(1, 1.0)]
        
        base_fares = {}
        current_fares = {}
        
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Should return base value when no data
        assert index_value == 100.0
    
    def test_base_period_calculation(self):
        """Test base period average fare calculation"""
        calculator = IndexCalculator()
        
        # This would typically be tested with database integration
        # For unit testing, we test the logic structure
        assert calculator.base_period_days == 7
        assert calculator.base_period_value == 100.0
    
    def test_index_precision(self):
        """Test that index values are rounded to 2 decimal places"""
        calculator = IndexCalculator()
        
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        routes = [MockRoute(1, 1.0)]
        
        base_fares = {1: 100.0}
        current_fares = {1: 105.555}  # Value that would need rounding
        
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Should be rounded to 2 decimal places
        assert len(str(index_value).split('.')[-1]) <= 2
    
    def test_weight_normalization(self):
        """Test that weights are properly normalized"""
        calculator = IndexCalculator()
        
        class MockRoute:
            def __init__(self, id, weight):
                self.id = id
                self.weight = weight
        
        # Routes with weights that don't sum to 1
        routes = [
            MockRoute(1, 2.0),
            MockRoute(2, 3.0)
        ]
        
        base_fares = {
            1: 100.0,
            2: 200.0
        }
        
        current_fares = {
            1: 110.0,  # 10% increase
            2: 220.0  # 10% increase
        }
        
        index_value = calculator._compute_weighted_index(routes, base_fares, current_fares)
        
        # Even with weights summing to 5, should normalize and get 110
        assert index_value == 110.0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])