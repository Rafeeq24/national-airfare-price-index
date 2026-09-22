# Validation Methodology: Back-testing Against DGCA/CPI Transport Sub-group Data

This document describes how the APIx prototype's methodology would be validated against official DGCA (Directorate General of Civil Aviation) and CPI (Consumer Price Index) transport sub-group data, even though live comparison is not implemented in this prototype pass.

## 🎯 Validation Objective

Validate that the Airfare Price Index (APIx) methodology accurately reflects actual airfare inflation trends as measured by official government statistics, specifically:
- DGCA airfare statistics
- CPI transport sub-group (air transport) data
- MOSPI (Ministry of Statistics and Programme Implementation) datasets

## 📊 Data Sources for Validation

### 1. DGCA Monthly Traffic and Fare Statistics

**Source:** DGCA Monthly Traffic Reports (https://www.dgca.gov.in/)

**Available Data:**
- Monthly passenger traffic by route
- Average fare data by route/airline
- Route-wise passenger statistics
- Seasonal traffic patterns

**Access Method:**
- Download monthly PDF reports
- Extract fare tables from reports
- Parse route-wise average fare data

**Key Metrics:**
- Route-wise average fares (monthly)
- Passenger load factors
- Route traffic volumes (for weighting)

### 2. CPI Transport Sub-group Data

**Source:** MOSPI CPI Database (https://esankhyiki.mospi.gov.in/)

**Available Data:**
- Monthly CPI indices for transport sub-group
- Air transport component indices
- Base year and weight information
- Year-over-year inflation rates

**Access Method:**
- Access MOSPI CPI database
- Query transport sub-group indices
- Extract air transport component
- Download historical time series

**Key Metrics:**
- Monthly CPI transport index
- Air transport component weight
- Base period values

### 3. Additional Validation Sources

**Source:** Ministry of Civil Aviation reports

**Available Data:**
- Domestic airfare trends
- Route-specific pricing studies
- Seasonal fare pattern analysis

## 🔬 Validation Methodology

### Step 1: Data Collection and Alignment

**APIx Data:**
- Extract daily APIx values from computed database
- Aggregate to monthly level for comparison
- Use same time period as official data

**DGCA Data:**
- Download DGCA monthly reports for validation period
- Extract route-wise average fares
- Compute monthly weighted average fare index

**CPI Data:**
- Extract monthly CPI transport sub-group indices
- Extract air transport component if available
- Align base periods with APIx base period

**Time Period Alignment:**
- Choose overlapping time period (e.g., 12-24 months)
- Ensure consistent month definitions
- Adjust for any differences in fare definitions

### Step 2: Index Calculation Alignment

**APIx Methodology:**
```
APIx_t = Σ(weight_i × (fare_i,t / fare_i,base)) × 100
```

**DGCA Methodology:**
- DGCA uses route-wise passenger volumes as weights
- Computes weighted average fare across all routes
- Reports monthly average fare index

**CPI Methodology:**
- Uses Laspeyres formula with fixed basket
- Air transport weight ~5.6% of CPI basket
- Base year periodically updated

**Alignment Approach:**
1. Use DGCA passenger volumes as route weights in APIx
2. Align fare definitions (include/exclude taxes consistently)
3. Match base period definitions
4. Apply same seasonal adjustment methods

### Step 3: Statistical Validation Metrics

#### Correlation Analysis
- **Pearson correlation** between APIx and DGCA indices
- **Spearman rank correlation** for monotonic relationships
- **Lag correlation** to check for leading/lagging indicators

#### Error Metrics
- **Mean Absolute Error (MAE)**: Average absolute difference
- **Mean Absolute Percentage Error (MAPE)**: Relative error measurement
- **Root Mean Square Error (RMSE)**: Penalizes larger errors
- **Theil's U statistic**: Comparison to naive forecast

#### Trend Validation
- **Directional accuracy**: Percentage of months with same direction change
- **Turning point detection**: Compare peaks and troughs
- **Seasonal pattern alignment**: Compare seasonal indices

#### Statistical Tests
- **Augmented Dickey-Fuller test**: Stationarity of differences
- **Granger causality**: Does APIx predict DGCA movements?
- **Cointegration test**: Long-run relationship validation

### Step 4: Benchmark Comparisons

**Benchmark 1: DGCA Monthly Fare Index**
- Compare APIx month-over-month changes with DGCA fare changes
- Calculate tracking error for each month
- Analyze systematic biases (over/under prediction)

**Benchmark 2: CPI Transport Sub-group**
- Compare APIx with CPI air transport component
- Test if APIx leads CPI movements (early indicator)
- Assess if APIx volatility matches CPI volatility

**Benchmark 3: Simple Average Fare Index**
- Compare APIx against unweighted average fare index
- Quantify benefit of weighted approach
- Validate route weight choices

### Step 5: Route-Level Validation

**Per-Route Analysis:**
- Validate APIx route weights against DGCA traffic volumes
- Check if high-traffic routes have appropriate influence
- Analyze route contribution to overall index movements

**Weight Sensitivity:**
- Test impact of weight variations on index accuracy
- Compare with alternative weighting schemes
- Validate DGCA passenger volume as optimal weight proxy

### Step 6: Back-testing Framework

**Rolling Window Analysis:**
- Use 12-month rolling window for training
- Test 1-month ahead forecast accuracy
- Compute out-of-sample performance metrics
- Avoid look-ahead bias

**Stress Testing:**
- Test performance during high-volatility periods
- Validate during seasonal peaks (holiday seasons)
- Check performance during external shocks (fuel price spikes)

**Longitudinal Validation:**
- Test across multiple years if data available
- Check for temporal stability of methodology
- Validate consistent performance over time

## 📈 Validation Success Criteria

### Primary Metrics
- **Correlation with DGCA**: r > 0.85 (strong positive correlation)
- **MAPE vs DGCA**: < 5% (mean absolute percentage error)
- **Directional accuracy**: > 75% (same month-over-month direction)
- **RMSE**: Less than 15% of index variance

### Secondary Metrics
- **Leading indicator capability**: APIx changes precede CPI changes
- **Volatility matching**: Similar standard deviation to DGCA
- **Seasonal alignment**: Correlation > 0.8 for seasonal patterns

### Qualitative Criteria
- **Interpretability**: Clear relationship to airfare economics
- **Timeliness**: More frequent than official statistics
- **Coverage**: Adequate route and carrier representation
- **Stability**: Consistent methodology over time

## 🔧 Implementation Approach for Production

### Data Pipeline
```python
# Pseudocode for validation pipeline
def validate_apix_against_dgca(start_date, end_date):
    # 1. Fetch APIx data
    apix_data = fetch_apix_monthly(start_date, end_date)
    
    # 2. Fetch DGCA data
    dgca_data = fetch_dgca_monthly(start_date, end_date)
    
    # 3. Align time periods
    aligned_data = align_time_periods(apix_data, dgca_data)
    
    # 4. Compute validation metrics
    correlation = compute_correlation(aligned_data)
    mape = compute_mape(aligned_data)
    directional_accuracy = compute_directional_accuracy(aligned_data)
    
    # 5. Generate validation report
    report = {
        'correlation': correlation,
        'mape': mape,
        'directional_accuracy': directional_accuracy,
        'rmse': compute_rmse(aligned_data),
        'period': f"{start_date} to {end_date}"
    }
    
    return report
```

### Dashboard Integration
- Add validation section to APIx dashboard
- Show real-time comparison with DGCA/CPI
- Display validation metrics and trends
- Alert when validation metrics degrade

### Automated Monitoring
- Run validation weekly/monthly
- Alert on threshold breaches
- Track validation metric trends
- Generate monthly validation reports

## 📊 Expected Validation Results

### Anticipated Findings

**Strong Correlation Expected:**
- APIx should correlate strongly with DGCA fare indices (r > 0.85)
- Both measure similar underlying phenomenon (airfare inflation)
- Should track major fare movements together

**APIx Advantages:**
- Higher frequency (daily vs monthly)
- More granular route coverage
- Real-time availability vs delayed official stats
- Better leading indicator capability

**Potential Divergences:**
- APIx may be more volatile (daily noise)
- Coverage differences (APIx: 5 routes vs DGCA: all routes)
- Fare definition differences (inclusive/exclusive of taxes)
- Weighting methodology differences

### Validation Success Scenario

If validation succeeds:
- APIx can be used as leading indicator for official statistics
- Provides real-time airfare inflation monitoring
- Enables early detection of fare trend changes
- Supports policy and business decision-making

### Validation Failure Scenario

If validation fails:
- Investigate route coverage differences
- Re-examine fare definition alignment
- Consider alternative weighting schemes
- Test different index formulas (Fisher, Paasche)
- Expand route coverage to match DGCA

## 🔄 Continuous Validation

### Ongoing Monitoring
- Monthly validation reports
- Quarterly methodology review
- Annual comprehensive validation
- Performance degradation alerts

### Methodology Refinement
- Update weights based on latest DGCA traffic data
- Adjust for new route introductions
- Incorporate feedback from validation results
- Stay aligned with DGCA methodology changes

## 📝 Validation Report Template

**Monthly Validation Report:**
```
Period: January 2024
APIx vs DGCA Correlation: 0.87
MAPE: 4.2%
Directional Accuracy: 78%
RMSE: 12.3%
Status: ✅ Within acceptable range

Key Findings:
- APIx tracked DGCA fare increases accurately
- APIx provided 3-day early warning for major increase
- Minor divergence in holiday period due to coverage difference

Recommendations:
- Continue current methodology
- Monitor holiday period coverage
- Consider adding 2-3 high-traffic routes
```

## 🎯 Conclusion

This validation framework provides a comprehensive approach to ensure the APIx methodology accurately reflects official airfare inflation trends. While the prototype doesn't implement live comparison, the methodology is structured to enable straightforward integration with DGCA and CPI data sources for production validation.

The validation approach ensures that APIx would be a reliable, statistically sound indicator of Indian domestic airfare price movements, suitable for policy analysis, business intelligence, and economic research applications.