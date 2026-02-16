"""
Lottery Results API Routes
Endpoints for managing automatic lottery results fetching and processing.
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from models.enums import UserRole
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import require_role, get_current_user
from services.lottery_scraper import get_scraper
from services.lottery_scheduler import (
    start_scheduler, 
    stop_scheduler, 
    get_scheduler_status,
    check_and_process_results
)

router = APIRouter(prefix="/lottery-results", tags=["Lottery Results"])


class SchedulerConfig(BaseModel):
    """Configuration for the automatic scheduler"""
    interval_minutes: int = 5
    enabled: bool = True


class ManualResultEntry(BaseModel):
    """Manual entry of lottery results"""
    lottery_id: str
    first_prize: int
    second_prize: Optional[int] = None
    third_prize: Optional[int] = None
    draw_date: Optional[str] = None
    draw_time: Optional[str] = None


@router.get("/status")
async def get_results_status(current_user: dict = Depends(get_current_user)):
    """Get current status of the lottery results system"""
    scheduler_status = get_scheduler_status()
    return {
        "scheduler": scheduler_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/fetch-now")
async def fetch_results_now(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """
    Manually trigger a fetch of lottery results.
    Results are processed in the background.
    """
    # Run in background to not block the request
    background_tasks.add_task(check_and_process_results)
    
    return {
        "message": "Búsqueda de resultados iniciada",
        "status": "processing",
        "note": "Los resultados se procesarán en segundo plano"
    }


@router.get("/latest")
async def get_latest_results(current_user: dict = Depends(get_current_user)):
    """Get the latest fetched lottery results"""
    scraper = get_scraper()
    results = await scraper.fetch_all_results()
    
    return {
        "results": [r.to_dict() for r in results.values()],
        "total": len(results),
        "validated_count": len([r for r in results.values() if r.validated]),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/preview")
async def preview_results(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """
    Preview current lottery results without processing them.
    Shows what would be processed if fetch-now is called.
    """
    db = get_db()
    scraper = get_scraper()
    
    # Fetch results
    results = await scraper.fetch_all_results()
    
    # Get active lotteries
    active_lotteries = await db.lotteries.find({"active": True}).to_list(100)
    lottery_map = {lot["name"].lower(): lot for lot in active_lotteries}
    
    preview_data = []
    for lottery_key, result in results.items():
        # Find matching lottery
        matching_lottery = None
        for db_name, lot_doc in lottery_map.items():
            if lottery_key in db_name or db_name in lottery_key:
                matching_lottery = lot_doc
                break
        
        # Count pending tickets that would win
        pending_winners = {"primera": 0, "segunda": 0, "tercera": 0}
        if matching_lottery:
            for position, number in [
                ("primera", result.first_prize),
                ("segunda", result.second_prize),
                ("tercera", result.third_prize)
            ]:
                if number is not None:
                    count = await db.tickets.count_documents({
                        "lottery_id": matching_lottery["id"],
                        "status": "pending",
                        "numbers": number
                    })
                    pending_winners[position] = count
        
        preview_data.append({
            "scraped_name": lottery_key,
            "matched_lottery": matching_lottery["name"] if matching_lottery else None,
            "lottery_id": matching_lottery["id"] if matching_lottery else None,
            "results": {
                "first": result.first_prize,
                "second": result.second_prize,
                "third": result.third_prize
            },
            "validated": result.validated,
            "sources": result.validation_sources,
            "pending_winners": pending_winners,
            "total_potential_winners": sum(pending_winners.values())
        })
    
    return {
        "preview": preview_data,
        "total_lotteries": len(preview_data),
        "validated_count": len([p for p in preview_data if p["validated"]]),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/scheduler/start")
async def start_results_scheduler(
    config: SchedulerConfig,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Start the automatic lottery results scheduler (Super Admin only)"""
    start_scheduler(interval_minutes=config.interval_minutes)
    
    # Save config to DB
    db = get_db()
    await db.system_config.update_one(
        {"key": "lottery_scheduler"},
        {"$set": {
            "key": "lottery_scheduler",
            "interval_minutes": config.interval_minutes,
            "enabled": True,
            "started_by": current_user["id"],
            "started_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {
        "message": f"Scheduler iniciado - Verificará cada {config.interval_minutes} minutos",
        "status": get_scheduler_status()
    }


@router.post("/scheduler/stop")
async def stop_results_scheduler(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Stop the automatic lottery results scheduler (Super Admin only)"""
    stop_scheduler()
    
    # Update config in DB
    db = get_db()
    await db.system_config.update_one(
        {"key": "lottery_scheduler"},
        {"$set": {
            "enabled": False,
            "stopped_by": current_user["id"],
            "stopped_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {
        "message": "Scheduler detenido",
        "status": get_scheduler_status()
    }


@router.get("/scheduler/config")
async def get_scheduler_config(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Get current scheduler configuration"""
    db = get_db()
    config = await db.system_config.find_one({"key": "lottery_scheduler"})
    
    return {
        "config": serialize_doc(config) if config else {
            "interval_minutes": 5,
            "enabled": False
        },
        "current_status": get_scheduler_status()
    }


@router.get("/history")
async def get_results_history(
    lottery_id: Optional[str] = None,
    limit: int = 20,
    automated_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get history of processed lottery results"""
    db = get_db()
    
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    if automated_only:
        query["is_automated"] = True
    
    draws = await db.draws.find(query).sort("draw_time", -1).limit(limit).to_list(limit)
    
    return {
        "draws": serialize_doc(draws),
        "total": len(draws)
    }


@router.get("/sources-check")
async def check_sources(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Check which lottery result sources are currently available"""
    import httpx
    
    sources = [
        {"name": "conectate.com.do", "url": "https://www.conectate.com.do/loterias/"},
        {"name": "loteriasdominicanas.com", "url": "https://loteriasdominicanas.com/"},
        {"name": "quinielasrd.com", "url": "https://quinielasrd.com/"},
        {"name": "loteriard.com", "url": "https://www.loteriard.com/"}
    ]
    
    results = []
    async with httpx.AsyncClient(timeout=10) as client:
        for source in sources:
            try:
                response = await client.get(source["url"], follow_redirects=True)
                results.append({
                    "name": source["name"],
                    "url": source["url"],
                    "status": "online" if response.status_code == 200 else "error",
                    "status_code": response.status_code
                })
            except Exception as e:
                results.append({
                    "name": source["name"],
                    "url": source["url"],
                    "status": "offline",
                    "error": str(e)
                })
    
    online_count = len([r for r in results if r["status"] == "online"])
    return {
        "sources": results,
        "online_count": online_count,
        "total_sources": len(sources),
        "validation_possible": online_count >= 2
    }
