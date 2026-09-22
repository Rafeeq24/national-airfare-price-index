"""
FastAPI Backend for Real-Time Airfare Price Index (APIx).
Exposes executive-grade REST endpoints for government portals, consumer dashboards,
and live fare surveillance.
"""
import os
import sys
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure path resolution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, Route, FareQuote, init_db
from backend.index_calculator import IndexCalculator
from backend.scraper import run_scrape_for_source

# Initialize database schema and migrations
init_db()

app = FastAPI(
    title="National Airfare Price Index (APIx) API",
    description="""
    ## Real-Time Indian Domestic Airfare Price Index (APIx)
    **Smart India Hackathon Prototype** for civil aviation market monitoring.
    
    Provides:
    - **Per-Route & Multi-Window Index Series**: Daily base-100 price indices for DEL-BOM and DEL-BLR at T+1, T+7, and T+45 days.
    - **Live Surveillance Scraper**: Automated fare extraction from IndiGo (goindigo.in) and Air India (airindia.com) with graceful anti-bot fallback.
    - **Executive KPI Summaries**: Real-time price relatives, baseline fares, and advance-purchase elasticity.
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Response Schemas ---

class RouteInfo(BaseModel):
    id: int
    route: str = Field(..., example="DEL-BOM")
    origin: str = Field(..., example="DEL")
    destination: str = Field(..., example="BOM")
    name: str = Field(..., example="Delhi - Mumbai")
    weight: float = Field(..., example=0.35)

class WindowKPI(BaseModel):
    window: str = Field(..., example="T+7")
    current_index: float = Field(..., example=102.4)
    current_avg_fare: float = Field(..., example=5850.0)
    base_fare: float = Field(..., example=5700.0)
    change_pct: float = Field(..., example=2.4)
    change_prev: float = Field(..., example=0.5)
    last_updated: str = Field(..., example="2026-09-04")

class RouteSummaryResponse(BaseModel):
    route: str
    windows: Dict[str, WindowKPI]
    timestamp: str

class ScrapeResponse(BaseModel):
    source: str
    status: str = Field(..., description="'success' or 'blocked-fallback-used'")
    quotes_collected: int
    message: str
    timestamp: str
    index_updated: bool

class FareQuoteItem(BaseModel):
    id: int
    route: str
    carrier: str
    source: str
    advance_purchase_window: str
    travel_date: str
    date_scraped: str
    base_fare: Optional[float]
    total_fare: float


# --- Endpoints ---

@app.get("/", tags=["General"])
def root():
    return {
        "title": "National Airfare Price Index (APIx) API",
        "status": "online",
        "documentation": "/docs",
        "endpoints": [
            "/api/routes",
            "/api/index?route=DEL-BOM",
            "/api/summary?route=DEL-BOM",
            "/api/scrape-now?source=indigo",
            "/api/fares?route=DEL-BOM"
        ]
    }


@app.get("/api/routes", response_model=List[RouteInfo], tags=["Routes"])
def get_routes():
    """
    Retrieve list of monitored domestic routes with traffic weights.
    """
    with SessionLocal() as db:
        routes = db.query(Route).all()
        result = []
        name_overrides = {
            "DEL-BOM": "Delhi ⇄ Mumbai",
            "DEL-BLR": "Delhi ⇄ Bengaluru",
            "BOM-BLR": "Mumbai ⇄ Bengaluru",
            "DEL-CCU": "Delhi ⇄ Kolkata",
            "MAA-DEL": "Chennai ⇄ Delhi"
        }
        for r in routes:
            result.append(RouteInfo(
                id=r.id,
                route=r.route_name,
                origin=r.origin,
                destination=r.destination,
                name=name_overrides.get(r.route_name, f"{r.origin} ⇄ {r.destination}"),
                weight=r.weight
            ))
        return result


@app.get("/api/index", tags=["Index Calculation"])
def get_index_series(
    route: str = Query("DEL-BOM", description="Route code, e.g. DEL-BOM or DEL-BLR"),
    window: Optional[str] = Query(None, description="Optional window filter: T+1, T+7, T+45, or omit for all")
):
    """
    Get historical daily price index series for a route.
    Returns a unified time-series suitable for multi-line charting:
    [
        {"date": "2026-08-29", "T+1": 108.4, "T+7": 101.2, "T+45": 94.6, "composite": 101.4},
        ...
    ]
    """
    route_name = route if isinstance(route, str) else "DEL-BOM"
    window_name = window if isinstance(window, str) else None

    calc = IndexCalculator()
    series = calc.get_route_window_series(route_name=route_name, window=window_name)
    return {
        "route": route_name,
        "window": window_name or "all",
        "points_count": len(series),
        "data": series
    }


@app.get("/api/summary", response_model=RouteSummaryResponse, tags=["Index Calculation"])
def get_route_summary(
    route: str = Query("DEL-BOM", description="Route code, e.g. DEL-BOM or DEL-BLR")
):
    """
    Get current KPI stat summary for a route across T+1, T+7, and T+45 windows.
    Includes current index value, average fare, reference base fare, and percentage change.
    """
    route_name = route if isinstance(route, str) else "DEL-BOM"
    calc = IndexCalculator()
    kpis = calc.get_summary_kpis(route_name=route_name)
    return RouteSummaryResponse(
        route=route_name,
        windows=kpis,
        timestamp=datetime.utcnow().isoformat()
    )



@app.get("/api/scrape-now", response_model=ScrapeResponse, tags=["Live Scraper"])
@app.post("/api/scrape-now", response_model=ScrapeResponse, tags=["Live Scraper"])
def trigger_scrape(
    source: str = Query("indigo", description="Airline source: 'indigo', 'airindia', or 'all'")
):
    """
    Trigger real-time flight fare scraping for IndiGo and/or Air India.
    Attempts live extraction with Playwright; falls back gracefully to calibrated
    market data if bot challenges are encountered. Automatically updates index.
    """
    try:
        res = run_scrape_for_source(source=source)
        return ScrapeResponse(
            source=res["source"],
            status=res["status"],
            quotes_collected=res["quotes_collected"],
            message=res["message"],
            timestamp=res["timestamp"],
            index_updated=res.get("index_updated", True)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fares", tags=["Fares Data"])
def get_fares(
    route: Optional[str] = Query(None, description="Optional route filter (e.g. DEL-BOM)"),
    limit: int = Query(50, le=500, description="Max records to return")
):
    """
    Retrieve latest collected fare quotes for verification and table display.
    """
    route_name = route if isinstance(route, str) else None
    limit_val = limit if isinstance(limit, int) else 50

    with SessionLocal() as db:
        query = db.query(FareQuote).order_by(FareQuote.id.desc())
        if route_name:
            query = query.filter(FareQuote.route == route_name)
        records = query.limit(limit_val).all()


        return [
            {
                "id": r.id,
                "route": r.route or f"{r.origin}-{r.destination}",
                "carrier": r.carrier,
                "source": r.source,
                "advance_purchase_window": r.advance_purchase_window or f"T+{r.advance_purchase_days}",
                "travel_date": r.travel_date.strftime("%Y-%m-%d") if r.travel_date else None,
                "date_scraped": r.date_scraped.strftime("%Y-%m-%d %H:%M") if r.date_scraped else (r.collection_date.strftime("%Y-%m-%d %H:%M") if r.collection_date else None),
                "base_fare": r.base_fare,
                "taxes_and_fees": r.taxes_and_fees,
                "total_fare": r.total_fare,
                "is_outlier": r.is_outlier,
                "is_sold_out": r.is_sold_out
            }
            for r in records
        ]


# --- Backwards-compatible legacy endpoints ---

@app.get("/api/index/daily", tags=["Legacy Compatibility"])
def legacy_daily_index(route: Optional[str] = None):
    calc = IndexCalculator()
    target_route = route or "DEL-BOM"
    return calc.get_route_window_series(target_route)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
