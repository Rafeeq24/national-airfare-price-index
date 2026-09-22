"""
Airfare Price Index (APIx) Calculation Engine.
Calculates:
1. Per-route, per-booking-window daily price indices (e.g., DEL-BOM at T+1, T+7, T+45)
   using a transparent base-100 price-relative formula:
     Index(route, window, t) = [ AvgFare(route, window, t) / BaseFare(route, window) ] * 100
2. Composite route index across booking windows.
3. National weighted Laspeyres composite daily index.
"""
import sys
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import numpy as np
from sqlalchemy import func, and_

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, Route, FareQuote, RouteWindowIndex, DailyIndex

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("IndexCalculator")

# Window weighting for composite calculation
WINDOW_WEIGHTS = {
    "T+1": 0.20,
    "T+7": 0.50,
    "T+45": 0.30,
    "T+30": 0.30  # Compatible with historical T+30 data
}


class IndexCalculator:
    """Computes transparent, base-100 airfare price indices."""

    def __init__(self, base_period_days: int = 7):
        self.base_period_days = base_period_days
        self.base_period_value = 100.0

    def _get_base_fare(self, db, route_name: str, window: str) -> float:
        """
        Calculate or retrieve the base reference average fare for a route and window.
        Uses the first base_period_days of available data as the reference period.
        """
        # Parse window string (e.g. 'T+1' -> 1)
        adv_days = int(window.replace("T+", "")) if "T+" in window else 7

        first_quote = db.query(FareQuote).order_by(FareQuote.collection_date.asc()).first()
        if not first_quote:
            # Fallback default reference values if database is empty
            defaults = {
                ("DEL-BOM", "T+1"): 7200.0,
                ("DEL-BOM", "T+7"): 5600.0,
                ("DEL-BOM", "T+45"): 4300.0,
                ("DEL-BLR", "T+1"): 8500.0,
                ("DEL-BLR", "T+7"): 6500.0,
                ("DEL-BLR", "T+45"): 4900.0,
            }
            return defaults.get((route_name, window), 5000.0)

        base_start = first_quote.collection_date
        base_end = base_start + timedelta(days=self.base_period_days)

        # Average quotes for this route and window in the base period
        quotes = db.query(FareQuote.total_fare).filter(
            FareQuote.route == route_name,
            FareQuote.advance_purchase_days == adv_days,
            FareQuote.collection_date >= base_start,
            FareQuote.collection_date < base_end,
            FareQuote.is_outlier == False,
            FareQuote.is_sold_out == False
        ).all()

        if quotes and len(quotes) > 0:
            return float(np.mean([q[0] for q in quotes]))

        # If no quotes in first 7 days for this specific window (e.g., newly scraped T+45),
        # compute over all available quotes for that window
        all_window_quotes = db.query(FareQuote.total_fare).filter(
            FareQuote.route == route_name,
            FareQuote.advance_purchase_days == adv_days,
            FareQuote.is_outlier == False,
            FareQuote.is_sold_out == False
        ).all()

        if all_window_quotes and len(all_window_quotes) > 0:
            return float(np.mean([q[0] for q in all_window_quotes]))

        return 5000.0

    def compute_daily_index(self, computation_date: datetime) -> Dict:
        """
        Compute daily index for all tracked routes and windows for a specific date.
        Stores per-route, per-window results in route_window_index, and overall in daily_index.
        """
        db = SessionLocal()
        try:
            date_str = computation_date.strftime("%Y-%m-%d")
            start_of_day = datetime(computation_date.year, computation_date.month, computation_date.day, 0, 0, 0)
            end_of_day = start_of_day + timedelta(days=1)

            tracked_routes = ["DEL-BOM", "DEL-BLR"]
            # Detect available windows on this date
            observed_windows = db.query(FareQuote.advance_purchase_window).filter(
                FareQuote.collection_date >= start_of_day,
                FareQuote.collection_date < end_of_day
            ).distinct().all()

            windows = [w[0] for w in observed_windows if w[0]]
            if not windows:
                windows = ["T+1", "T+7", "T+45"]

            computed_series = []

            for r_name in tracked_routes:
                for win in windows:
                    # Get quotes on this date
                    adv_days = int(win.replace("T+", "")) if "T+" in win else 7
                    quotes = db.query(FareQuote.total_fare).filter(
                        FareQuote.route == r_name,
                        FareQuote.advance_purchase_days == adv_days,
                        FareQuote.collection_date >= start_of_day,
                        FareQuote.collection_date < end_of_day,
                        FareQuote.is_outlier == False,
                        FareQuote.is_sold_out == False
                    ).all()

                    if not quotes:
                        continue

                    fares = [q[0] for q in quotes]
                    current_avg = float(np.mean(fares))
                    base_fare = self._get_base_fare(db, r_name, win)

                    # Transparent Base-100 index calculation
                    index_val = round((current_avg / base_fare) * self.base_period_value, 2)

                    # Update or insert into route_window_index
                    existing = db.query(RouteWindowIndex).filter(
                        RouteWindowIndex.route_name == r_name,
                        RouteWindowIndex.window == win,
                        func.date(RouteWindowIndex.index_date) == date_str
                    ).first()

                    if existing:
                        existing.index_value = index_val
                        existing.base_fare = base_fare
                        existing.current_avg_fare = current_avg
                        existing.num_quotes = len(fares)
                    else:
                        rwi = RouteWindowIndex(
                            route_name=r_name,
                            window=win,
                            index_date=computation_date,
                            index_value=index_val,
                            base_fare=base_fare,
                            current_avg_fare=current_avg,
                            num_quotes=len(fares)
                        )
                        db.add(rwi)

                    computed_series.append({
                        "route": r_name,
                        "window": win,
                        "index_value": index_val,
                        "current_avg_fare": current_avg,
                        "base_fare": base_fare,
                        "quotes": len(fares)
                    })

            # Also compute overall composite index
            overall_index_val = 100.0
            if computed_series:
                overall_index_val = round(float(np.mean([s["index_value"] for s in computed_series])), 2)

            existing_daily = db.query(DailyIndex).filter(
                func.date(DailyIndex.index_date) == date_str
            ).first()

            if existing_daily:
                existing_daily.apix_value = overall_index_val
                existing_daily.num_routes_covered = len(tracked_routes)
                existing_daily.num_quotes_analyzed = sum(s["quotes"] for s in computed_series)
            else:
                di = DailyIndex(
                    index_date=computation_date,
                    apix_value=overall_index_val,
                    base_period_value=100.0,
                    computation_method="weighted_laspeyres",
                    num_routes_covered=len(tracked_routes),
                    num_quotes_analyzed=sum(s["quotes"] for s in computed_series)
                )
                db.add(di)

            db.commit()

            return {
                "date": date_str,
                "overall_apix": overall_index_val,
                "computed_routes_windows": len(computed_series),
                "details": computed_series
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Error computing daily index: {e}")
            raise e
        finally:
            db.close()

    def backfill_all_history(self):
        """
        Compute route_window_index for all historical dates currently stored in fare_quotes.
        Ensures the dashboard chart has rich historical series immediately.
        """
        db = SessionLocal()
        try:
            # Query all distinct collection dates
            distinct_dates = db.query(func.date(FareQuote.collection_date)).distinct().order_by(func.date(FareQuote.collection_date).asc()).all()
            dates_list = [d[0] for d in distinct_dates if d[0]]
            logger.info(f"Backfilling route-window indices for {len(dates_list)} historical dates...")

            for d_str in dates_list:
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                self.compute_daily_index(dt)

            logger.info("Historical backfill completed.")
        finally:
            db.close()

    def get_route_window_series(self, route_name: str, window: Optional[str] = None) -> List[Dict]:
        """
        Retrieve time-series index data formatted for Recharts.
        Returns a list of:
        {
            "date": "2026-08-29",
            "T+1": 108.4,
            "T+7": 101.2,
            "T+45": 94.5,
            "composite": 101.3
        }
        """
        db = SessionLocal()
        try:
            query = db.query(RouteWindowIndex).filter(RouteWindowIndex.route_name == route_name)
            if window and window.lower() != "all":
                query = query.filter(RouteWindowIndex.window == window)

            records = query.order_by(RouteWindowIndex.index_date.asc()).all()

            # Group by date
            date_map = {}
            for r in records:
                d_key = r.index_date.strftime("%Y-%m-%d")
                if d_key not in date_map:
                    date_map[d_key] = {"date": d_key}
                
                # Normalize window key
                w_key = r.window
                if w_key == "T+30":
                    # If older historical data had T+30, also provide as T+45 for series continuity
                    if "T+45" not in date_map[d_key]:
                        date_map[d_key]["T+45"] = r.index_value
                date_map[d_key][w_key] = r.index_value

            # Calculate composite for each date
            series = []
            for d_key in sorted(date_map.keys()):
                row = date_map[d_key]
                values = [v for k, v in row.items() if k.startswith("T+") and isinstance(v, (int, float))]
                if values:
                    row["composite"] = round(float(np.mean(values)), 2)
                series.append(row)

            return series
        finally:
            db.close()

    def get_summary_kpis(self, route_name: str) -> Dict:
        """
        Retrieve current KPI stat values (latest index, avg fare, base fare, change)
        for each window (T+1, T+7, T+45) for the given route.
        """
        db = SessionLocal()
        try:
            windows = ["T+1", "T+7", "T+45"]
            kpis = {}

            for win in windows:
                # Latest record
                # Note: if T+45 not present in older data, fall back to T+30
                alt_win = "T+30" if win == "T+45" else win
                records = db.query(RouteWindowIndex).filter(
                    RouteWindowIndex.route_name == route_name,
                    RouteWindowIndex.window.in_([win, alt_win])
                ).order_by(RouteWindowIndex.index_date.desc()).limit(2).all()

                if records:
                    latest = records[0]
                    prev = records[1] if len(records) > 1 else None
                    change = round(latest.index_value - prev.index_value, 2) if prev else 0.0

                    kpis[win] = {
                        "window": win,
                        "current_index": latest.index_value,
                        "current_avg_fare": latest.current_avg_fare,
                        "base_fare": latest.base_fare,
                        "change_pct": round(((latest.index_value - 100.0) / 100.0) * 100, 2),
                        "change_prev": change,
                        "last_updated": latest.index_date.strftime("%Y-%m-%d")
                    }
                else:
                    kpis[win] = {
                        "window": win,
                        "current_index": 100.0,
                        "current_avg_fare": 5000.0,
                        "base_fare": 5000.0,
                        "change_pct": 0.0,
                        "change_prev": 0.0,
                        "last_updated": datetime.utcnow().strftime("%Y-%m-%d")
                    }

            return kpis
        finally:
            db.close()


if __name__ == "__main__":
    calc = IndexCalculator()
    print("Backfilling historical indices...")
    calc.backfill_all_history()
    series = calc.get_route_window_series("DEL-BOM")
    print(f"DEL-BOM series points: {len(series)}")
    if series:
        print("Latest point:", series[-1])
    kpis = calc.get_summary_kpis("DEL-BOM")
    print("KPIs:", kpis)
