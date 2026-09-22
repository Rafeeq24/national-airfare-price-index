# Airfare Price Index (APIx) - Real-time Indian Domestic Air Travel Index

A working prototype of a **Real-time Airfare Price Index (APIx)** for Indian domestic air travel. This system collects airfare data, cleans it, computes a price index, and displays it on a dashboard.

## 🎯 Project Overview

This is a hackathon/capstone-style prototype that demonstrates:
- **5 representative city-pair routes**: DEL-BOM, DEL-BLR, BOM-BLR, DEL-CCU, MAA-DEL
- **3 advance-purchase windows**: T+1, T+7, T+30
- **Pluggable data sources**: MockFareSource (default) + LiveFareSource stub
- **Weighted Laspeyres-style index computation**
- **Real-time dashboard** with interactive visualizations

## 📁 Project Structure

```
airfare-price-index/
├── scraper/              # Fare data collection
│   ├── fare_source.py    # Pluggable fare source interface
│   ├── seed_data.py      # Database seeding script
│   └── live_scraper_stub.py  # Live scraper structure (Playwright)
├── pipeline/             # Data processing pipeline
│   ├── cleaning.py       # Data cleaning and outlier detection
│   └── index_computation.py  # Index calculation logic
├── api/                  # FastAPI backend
│   └── main.py           # API endpoints
├── dashboard/            # React frontend
│   ├── src/
│   │   ├── App.jsx       # Main dashboard component
│   │   └── App.css      # Dashboard styling
│   ├── package.json
│   └── vite.config.js
├── data/                 # Database and schema
│   ├── schema.py         # SQLAlchemy models
│   └── airfare_prices.db # SQLite database
├── tests/                # Automated tests
│   ├── test_cleaning.py  # Cleaning logic tests
│   └── test_index_computation.py  # Index computation tests
├── requirements.txt      # Python dependencies
└── README.md            # Documentation
```

### New Extended Architecture (`backend/` & `frontend/`)
```
├── backend/
│   ├── database.py              # Extended SQLAlchemy models (PostgreSQL & SQLite)
│   ├── scraper_indigo.py        # Dedicated Playwright scraper for IndiGo (goindigo.in)
│   ├── scraper_airindia.py      # Dedicated Playwright scraper for Air India (airindia.com)
│   ├── scraper.py               # Unified scraper runner & coordinator
│   ├── index_calculator.py      # Multi-window & per-route base-100 APIx calculator
│   ├── main.py                  # Executive FastAPI backend with clean endpoints & /docs
│   └── mock_site/               # Calibrated fallback fare source when automation is blocked
├── frontend/ (and dashboard/)   # Modern React + Recharts dashboard UI
│   ├── src/
│   │   ├── App.jsx              # Redesigned minimal dashboard with route picker & stat cards
│   │   └── App.css              # Polished slate/blue minimal design system
│   ├── package.json
│   └── vite.config.js
```

## 🚀 Quick Start

### 1. Backend Server
```bash
# Start FastAPI backend
python -m uvicorn backend.main:app --reload --port 8000
```
Interactive API documentation will be available at: `http://localhost:8000/docs`

### 2. Frontend Dashboard
```bash
# Start React (Vite) dashboard
cd frontend
npm run dev
```
The dashboard will be available at: `http://localhost:5173`

### 3. Run Scrapers via CLI
```bash
# Scrape IndiGo live
python backend/scraper.py indigo

# Scrape Air India live
python backend/scraper.py airindia

# Scrape both sources
python backend/scraper.py all
```

## 📊 Key API Endpoints (Ministry / External Use)

### Route & Index Surveillance
- `GET /api/routes` — Monitored trunk routes (DEL-BOM, DEL-BLR)
- `GET /api/index?route=DEL-BOM` — Full multi-window daily index series (T+1, T+7, T+45)
- `GET /api/summary?route=DEL-BOM` — Current KPI values, base fares, and changes per window
- `GET /api/fares?route=DEL-BOM&limit=50` — Recent collected flight quotes with surveillance mode
- `GET /api/scrape-now?source=indigo` — Trigger real-time live extraction with anti-bot fallback
- `GET /docs` — Swagger UI for external government portals


## 🔄 Data Pipeline

### 1. Collection Stage
- **Default**: MockFareSource generates realistic synthetic fare data
- **Alternative**: LiveFareSource stub structured for real Playwright scraping
- **Routes**: 5 city-pairs with DGCA-traffic-proportional weights
- **Advance Windows**: T+1, T+7, T+30
- **Carriers**: IndiGo, Air India, SpiceJet, Vistara, GoAir

### 2. Cleaning Stage
- Remove sold-out entries
- Remove duplicates (keep most recent)
- Split total fare into base fare + taxes (20% tax rate approximation)
- Detect outliers using z-score and IQR methods
- Flag statistical outliers

### 3. Index Construction
- **Method**: Weighted Laspeyres price-relative index
- **Base Period**: First 7 days of data (index = 100)
- **Formula**: Σ(weight_i × (current_fare_i / base_fare_i)) × 100
- **Weights**: Based on DGCA traffic proportions (DEL-BOM: 0.35, DEL-BLR: 0.25, etc.)

### 4. Serve Stage
- FastAPI exposes raw fares, cleaned fares, and computed indices
- Daily, weekly, and monthly aggregations available
- Dashboard visualizes trends and patterns

## 🧪 Testing

Run automated tests:

```bash
# Test cleaning logic
python -m pytest tests/test_cleaning.py -v

# Test index computation
python -m pytest tests/test_index_computation.py -v
```

## 🎨 Dashboard Features

### Overall APIx Trend
- Daily, weekly, monthly toggle
- Interactive line chart
- Current value and base period reference

### Route-wise Fare Heatmap
- Route × date matrix
- Average fare visualization
- Color-coded by fare levels

### Lead-time Elasticity Curve
- Fare vs. days before departure
- Scatter plot by route
- Shows pricing patterns by advance purchase

## 🔌 Data Source Configuration

### Using MockFareSource (Default)
The system defaults to MockFareSource which generates realistic synthetic data with:
- Day-of-week price variations
- Advance purchase pricing patterns
- Carrier-specific price differences
- Randomized but plausible fare movements

### Switching to LiveFareSource
To use a real scraper (structured but not functional):

1. Implement actual Playwright scraping in `scraper/live_scraper_stub.py`
2. Call the live source via API:
```bash
curl -X POST "http://localhost:8000/api/collect?source=live"
```

**Important**: Live scraping requires:
- Respecting robots.txt
- Rate limiting
- Handling CAPTCHAs (not allowed per requirements)
- Following airline website ToS

## 📈 Index Methodology

### Weighted Laspeyres Index

**Formula:**
```
APIx = Σ(weight_i × (current_fare_i / base_fare_i)) × 100
```

**Where:**
- `weight_i` = DGCA traffic-proportional weight for route i
- `current_fare_i` = Average fare for route i in current period
- `base_fare_i` = Average fare for route i in base period (first 7 days)
- Base period value = 100

**Route Weights (Placeholders):**
- DEL-BOM: 0.35 (highest traffic)
- DEL-BLR: 0.25
- BOM-BLR: 0.20
- DEL-CCU: 0.12
- MAA-DEL: 0.08

**Note:** Production version would need proper Fisher/Laspeyres/Paasche index methodology validated against DGCA data.

## 🛠️ Development Notes

### Database Schema
- SQLite for prototype (easy to swap to Postgres)
- Tables: routes, fare_quotes, daily_index, weekly_index, monthly_index
- Relationships defined for data integrity

### Key Design Decisions
- **Pluggable sources**: Easy to swap mock → live without pipeline changes
- **Synthetic data**: Allows immediate end-to-end demo without live scraping
- **Simple index**: Weighted Laspeyres (expandable for production)
- **SQLite**: Easy local development (Postgres-ready schema)

### Known Limitations
- Live scraping stub not functional (CAPTCHA/ToS restrictions)
- Index methodology simplified (production needs DGCA validation)
- Limited route coverage (5 routes vs. full domestic network)
- Mock data patterns may not reflect real market dynamics

## 📝 Validation Approach

See `VALIDATION.md` for detailed back-testing methodology against DGCA/CPI transport sub-group data.

## 🚦 Running the Full Pipeline

### Manual "Next Day" Collection
Since this is a prototype, you can manually trigger collection:

```bash
# Collect next day's fares
curl -X POST "http://localhost:8000/api/collect?collection_date=2024-01-16"

# Clean the new data
curl -X POST "http://localhost:8000/api/clean?collection_date=2024-01-16"

# Compute index for new day
curl -X POST "http://localhost:8000/api/compute-index?computation_date=2024-01-16"
```

### Automated Scheduling
For production, this would use APScheduler or cron jobs for daily collection.

## 🎯 Demo Mode

The prototype is set up for immediate demo:

1. Database already seeded with 30 days of mock data
2. Indices pre-computed for demonstration
3. Dashboard shows historical trends immediately
4. No waiting for real-time data collection

## 📚 Future Enhancements

**Production Version Would Need:**
- Real-time airline website scraping
- DGCA data validation
- More sophisticated index methodology
- Full route coverage
- Production database (Postgres)
- Automated scheduling and monitoring
- Error handling and retry logic
- CAPTCHA solving (where legally permitted)

## 🔒 Security & Compliance

- **No CAPTCHA bypass**: Per requirements, does not attempt to defeat CAPTCHAs
- **Robots.txt respect**: Live scraper stub includes robots.txt checking
- **Rate limiting**: Built-in delays between requests
- **ToS compliance**: Structure allows compliance when implementing real scraper

## 📞 Support

For issues or questions:
1. Check API documentation at `http://localhost:8000/docs`
2. Review test outputs for logic validation
3. Consult VALIDATION.md for methodology questions

## 📄 License

This is a prototype project for educational/hackathon purposes.