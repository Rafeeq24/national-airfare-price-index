"""
Unified Scraper Coordinator for Airfare Price Index (APIx).
Coordinates live scraping across IndiGo and Air India, records quotes in database,
and triggers automatic index re-computation.
"""
import sys
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, FareQuote, Route
from backend.scraper_indigo import run_indigo_scrape
from backend.scraper_airindia import run_airindia_scrape
from backend.index_calculator import IndexCalculator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ScraperCoordinator")


def save_quotes_to_db(quotes: List[Dict]) -> int:
    """Persist a list of quote dictionaries to the database."""
    saved_count = 0
    with SessionLocal() as db:
        # Pre-fetch routes to link route_id
        routes = db.query(Route).all()
        route_map = {r.route_name: r.id for r in routes}

        for q in quotes:
            route_name = q.get("route")
            r_id = route_map.get(route_name)

            db_quote = FareQuote(
                route_id=r_id,
                route=route_name,
                origin=q.get("origin"),
                destination=q.get("destination"),
                carrier=q.get("carrier"),
                source=q.get("source"),
                advance_purchase_window=q.get("advance_purchase_window"),
                advance_purchase_days=q.get("advance_purchase_days", 1),
                date_scraped=q.get("date_scraped") or datetime.utcnow(),
                collection_date=q.get("collection_date") or datetime.utcnow(),
                travel_date=q.get("travel_date"),
                fare_class=q.get("fare_class", "Economy"),
                base_fare=q.get("base_fare"),
                taxes_and_fees=q.get("taxes_and_fees"),
                total_fare=q.get("total_fare"),
                is_sold_out=q.get("is_sold_out", False),
                is_outlier=q.get("is_outlier", False),
                created_at=datetime.utcnow()
            )
            db.add(db_quote)
            saved_count += 1
        db.commit()

    logger.info(f"Successfully saved {saved_count} quotes to database.")
    return saved_count


def run_scrape_for_source(source: str = "all") -> Dict:
    """
    Trigger scraping for a specific source ('indigo', 'airindia', or 'all').
    Saves results to DB and recalculates indices.
    """
    source_lower = source.lower().strip()
    quotes_to_save = []
    statuses = {}

    if source_lower in ["indigo", "all"]:
        logger.info("Executing IndiGo scrape...")
        indigo_res = run_indigo_scrape()
        statuses["indigo"] = indigo_res["status"]
        quotes_to_save.extend(indigo_res["quotes"])

    if source_lower in ["airindia", "air_india", "air-india", "all"]:
        logger.info("Executing Air India scrape...")
        ai_res = run_airindia_scrape()
        statuses["airindia"] = ai_res["status"]
        quotes_to_save.extend(ai_res["quotes"])

    if not quotes_to_save:
        return {
            "source": source,
            "status": "error",
            "message": f"Unknown source '{source}'. Use 'indigo', 'airindia', or 'all'.",
            "quotes_collected": 0,
            "timestamp": datetime.utcnow().isoformat()
        }

    # Save quotes
    saved_count = save_quotes_to_db(quotes_to_save)

    # Automatically recompute today's index
    try:
        calc = IndexCalculator()
        index_res = calc.compute_daily_index(datetime.utcnow())
        logger.info("Recomputed daily indices successfully.")
    except Exception as e:
        logger.warning(f"Index computation warning: {e}")
        index_res = {}

    overall_status = "success" if all(s == "success" for s in statuses.values()) else "blocked-fallback-used"

    return {
        "source": source,
        "status": overall_status,
        "statuses": statuses,
        "quotes_collected": saved_count,
        "message": f"Scrape completed for {source}. {saved_count} quotes saved to database.",
        "timestamp": datetime.utcnow().isoformat(),
        "index_updated": bool(index_res)
    }


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "all"
    res = run_scrape_for_source(src)
    print("Scraper execution result:", res["status"])
    print(f"Quotes saved: {res['quotes_collected']}")
