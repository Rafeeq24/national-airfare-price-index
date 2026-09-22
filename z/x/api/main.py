"""
FastAPI application for Airfare Price Index (APIx) API
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.schema import SessionLocal, Route, FareQuote, DailyIndex, WeeklyIndex, MonthlyIndex
from scraper.fare_source import MockFareSource, LiveFareSource
from pipeline.cleaning import clean_data
from pipeline.index_computation import IndexCalculator, compute_all_indices

app = FastAPI(
    title="Airfare Price Index (APIx) API",
    description="API for real-time airfare price index for Indian domestic air travel",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API responses
from pydantic import BaseModel
from typing import Optional

class FareQuoteResponse(BaseModel):
    id: int
    route_id: int
    origin: str
    destination: str
    carrier: str
    collection_date: datetime
    travel_date: datetime
    advance_purchase_days: int
    fare_class: str
    base_fare: Optional[float]
    taxes_and_fees: Optional[float]
    total_fare: float
    source: str
    is_sold_out: bool
    is_outlier: bool

class RouteResponse(BaseModel):
    id: int
    origin: str
    destination: str
    route_name: str
    weight: float
    base_period_avg_fare: Optional[float]

class DailyIndexResponse(BaseModel):
    id: int
    index_date: datetime
    apix_value: float
    base_period_value: float
    computation_method: str
    num_routes_covered: int
    num_quotes_analyzed: int

class WeeklyIndexResponse(BaseModel):
    id: int
    week_start_date: datetime
    week_end_date: datetime
    apix_value: float
    base_period_value: float
    num_daily_values: int

class MonthlyIndexResponse(BaseModel):
    id: int
    month: int
    year: int
    apix_value: float
    base_period_value: float
    num_daily_values: int

class CollectionStatusResponse(BaseModel):
    status: str
    message: str
    collection_date: Optional[datetime]
    quotes_collected: int
    last_computation: Optional[datetime]

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Airfare Price Index (APIx) API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "routes": "/api/routes",
            "raw_fares": "/api/fares/raw",
            "cleaned_fares": "/api/fares/cleaned",
            "daily_index": "/api/index/daily",
            "weekly_index": "/api/index/weekly",
            "monthly_index": "/api/index/monthly",
            "collect": "/api/collect",
            "clean": "/api/clean",
            "compute_index": "/api/compute-index"
        }
    }

# Routes endpoints
@app.get("/api/routes", response_model=List[RouteResponse])
async def get_routes():
    """Get all configured routes"""
    db = SessionLocal()
    try:
        routes = db.query(Route).all()
        return routes
    finally:
        db.close()

# Raw fare quotes endpoints
@app.get("/api/fares/raw", response_model=List[FareQuoteResponse])
async def get_raw_fares(
    route_id: Optional[int] = None,
    collection_date: Optional[str] = None,
    limit: int = Query(100, le=1000)
):
    """Get raw fare quotes (before cleaning)"""
    db = SessionLocal()
    try:
        query = db.query(FareQuote)
        
        if route_id:
            query = query.filter(FareQuote.route_id == route_id)
        
        if collection_date:
            try:
                date_obj = datetime.strptime(collection_date, "%Y-%m-%d")
                query = query.filter(FareQuote.collection_date == date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        fares = query.limit(limit).all()
        return fares
    finally:
        db.close()

# Cleaned fare quotes endpoints
@app.get("/api/fares/cleaned", response_model=List[FareQuoteResponse])
async def get_cleaned_fares(
    route_id: Optional[int] = None,
    collection_date: Optional[str] = None,
    limit: int = Query(100, le=1000)
):
    """Get cleaned fare quotes (after removing outliers and sold-out)"""
    db = SessionLocal()
    try:
        query = db.query(FareQuote).filter(
            FareQuote.is_outlier == False,
            FareQuote.is_sold_out == False
        )
        
        if route_id:
            query = query.filter(FareQuote.route_id == route_id)
        
        if collection_date:
            try:
                date_obj = datetime.strptime(collection_date, "%Y-%m-%d")
                query = query.filter(FareQuote.collection_date == date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        fares = query.limit(limit).all()
        return fares
    finally:
        db.close()

# Index endpoints
@app.get("/api/index/daily", response_model=List[DailyIndexResponse])
async def get_daily_index(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get daily index values"""
    db = SessionLocal()
    try:
        query = db.query(DailyIndex)
        
        if start_date:
            try:
                date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(DailyIndex.index_date >= date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        if end_date:
            try:
                date_obj = datetime.strptime(end_date, "%Y-%m-%d")
                query = query.filter(DailyIndex.index_date <= date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        indices = query.order_by(DailyIndex.index_date).all()
        return indices
    finally:
        db.close()

@app.get("/api/index/weekly", response_model=List[WeeklyIndexResponse])
async def get_weekly_index(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get weekly index values"""
    db = SessionLocal()
    try:
        query = db.query(WeeklyIndex)
        
        if start_date:
            try:
                date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(WeeklyIndex.week_start_date >= date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        if end_date:
            try:
                date_obj = datetime.strptime(end_date, "%Y-%m-%d")
                query = query.filter(WeeklyIndex.week_end_date <= date_obj)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        indices = query.order_by(WeeklyIndex.week_start_date).all()
        return indices
    finally:
        db.close()

@app.get("/api/index/monthly", response_model=List[MonthlyIndexResponse])
async def get_monthly_index(
    year: Optional[int] = None,
    month: Optional[int] = None
):
    """Get monthly index values"""
    db = SessionLocal()
    try:
        query = db.query(MonthlyIndex)
        
        if year:
            query = query.filter(MonthlyIndex.year == year)
        
        if month:
            query = query.filter(MonthlyIndex.month == month)
        
        indices = query.order_by(MonthlyIndex.year, MonthlyIndex.month).all()
        return indices
    finally:
        db.close()

# Pipeline control endpoints
@app.post("/api/collect", response_model=CollectionStatusResponse)
async def collect_fares(
    source: str = Query("mock", description="Data source: 'mock' or 'live'"),
    collection_date: Optional[str] = None
):
    """
    Collect fare quotes using specified data source
    For prototype, defaults to MockFareSource
    """
    db = SessionLocal()
    try:
        # Determine collection date
        if collection_date:
            try:
                collection_date_obj = datetime.strptime(collection_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            collection_date_obj = datetime.now()
        
        # Get routes
        routes = db.query(Route).all()
        routes_data = [
            {
                'id': route.id,
                'origin': route.origin,
                'destination': route.destination
            }
            for route in routes
        ]
        
        # Select data source
        if source == "mock":
            fare_source = MockFareSource()
        elif source == "live":
            fare_source = LiveFareSource()
        else:
            raise HTTPException(status_code=400, detail="Invalid source. Use 'mock' or 'live'")
        
        # Collect fares
        advance_windows = [1, 7, 30]  # T+1, T+7, T+30
        fare_quotes = fare_source.collect_fares(
            collection_date=collection_date_obj,
            routes=routes_data,
            advance_windows=advance_windows
        )
        
        # Save to database
        quotes_saved = 0
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
            quotes_saved += 1
        
        db.commit()
        
        return CollectionStatusResponse(
            status="success",
            message=f"Collected {quotes_saved} fare quotes using {fare_source.get_source_name()}",
            collection_date=collection_date_obj,
            quotes_collected=quotes_saved,
            last_computation=None
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.post("/api/clean")
async def clean_fares(
    collection_date: Optional[str] = None
):
    """Clean fare quotes (remove outliers, sold-out, etc.)"""
    try:
        if collection_date:
            collection_date_obj = datetime.strptime(collection_date, "%Y-%m-%d")
        else:
            collection_date_obj = None
        
        stats = clean_data(collection_date_obj)
        
        return {
            "status": "success",
            "message": "Fare cleaning completed",
            "statistics": stats
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compute-index")
async def compute_index(
    computation_date: Optional[str] = None
):
    """Compute index values for specified date"""
    try:
        calculator = IndexCalculator()
        
        if computation_date:
            computation_date_obj = datetime.strptime(computation_date, "%Y-%m-%d")
        else:
            computation_date_obj = datetime.now()
        
        result = calculator.compute_daily_index(computation_date_obj)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "status": "success",
            "message": "Index computation completed",
            "result": result
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compute-all-indices")
async def compute_all_indices_endpoint(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Compute indices for all dates in range"""
    try:
        if start_date:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
        else:
            start_date_obj = None
        
        if end_date:
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        else:
            end_date_obj = None
        
        result = compute_all_indices(start_date_obj, end_date_obj)
        
        return {
            "status": "success",
            "message": "Index computation completed for all dates",
            "result": result
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)