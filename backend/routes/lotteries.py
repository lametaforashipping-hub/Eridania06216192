"""Lottery management routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import Optional
from models.schemas import LotteryCreate, LotteryUpdate, DEFAULT_WEEKLY_SCHEDULE
from models.enums import UserRole, TicketStatus
from utils.database import get_db
from utils.helpers import serialize_doc, check_lottery_open
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/lotteries", tags=["Lotteries"])


@router.post("")
async def create_lottery(lottery: LotteryCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Create a new lottery"""
    db = get_db()
    lottery_doc = {
        "id": str(uuid.uuid4()),
        "name": lottery.name,
        "country": lottery.country,
        "lottery_type": lottery.lottery_type.value,
        "min_number": lottery.min_number,
        "max_number": lottery.max_number,
        "numbers_to_pick": lottery.numbers_to_pick,
        "price": lottery.price,
        "currency": lottery.currency.value,
        "prize_multiplier": lottery.prize_multiplier,
        "schedule": lottery.schedule,
        "closing_minutes_before": lottery.closing_minutes_before,
        "active": lottery.active,
        "prize_rules": lottery.prize_rules or [],
        "allows_combined": lottery.allows_combined,
        "opening_time": lottery.opening_time,
        "closing_time": lottery.closing_time,
        "weekly_hours": lottery.weekly_hours or DEFAULT_WEEKLY_SCHEDULE,
        "holidays": lottery.holidays or [],
        "ticket_limit_per_number": lottery.ticket_limit_per_number,
        "created_at": datetime.utcnow()
    }
    await db.lotteries.insert_one(lottery_doc)
    return {"message": "Lotería creada", "lottery_id": lottery_doc["id"]}


@router.get("")
async def get_lotteries(active_only: bool = True, country: Optional[str] = None):
    """Get all lotteries with their current status"""
    db = get_db()
    query = {}
    if active_only:
        query["active"] = True
    if country:
        query["country"] = country
    
    lotteries = await db.lotteries.find(query).to_list(100)
    
    result = []
    for l in lotteries:
        is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(l)
        result.append({
            **serialize_doc(l),
            "is_open": is_open,
            "next_draw_time": next_draw,
            "closed_message": closed_message,
            "today_hours": today_hours,
            "is_holiday": holiday_info is not None,
            "holiday_name": holiday_info.get("name") if holiday_info else None
        })
    
    return result


@router.get("/{lottery_id}")
async def get_lottery(lottery_id: str):
    """Get a specific lottery by ID"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(lottery)
    return {
        **serialize_doc(lottery), 
        "is_open": is_open, 
        "next_draw_time": next_draw, 
        "closed_message": closed_message, 
        "today_hours": today_hours,
        "is_holiday": holiday_info is not None,
        "holiday_name": holiday_info.get("name") if holiday_info else None
    }


@router.put("/{lottery_id}")
async def update_lottery(lottery_id: str, update: LotteryUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Update a lottery"""
    db = get_db()
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.lotteries.update_one({"id": lottery_id}, {"$set": update_data})
    return {"message": "Lotería actualizada"}


@router.post("/{lottery_id}/holidays")
async def add_holiday(lottery_id: str, holiday: dict, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Add a holiday to a lottery"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    if "date" not in holiday or "name" not in holiday:
        raise HTTPException(status_code=400, detail="El festivo debe tener 'date' (YYYY-MM-DD) y 'name'")
    
    holidays = lottery.get("holidays", [])
    for h in holidays:
        if h["date"] == holiday["date"]:
            raise HTTPException(status_code=400, detail=f"Ya existe un festivo para la fecha {holiday['date']}")
    
    holidays.append(holiday)
    await db.lotteries.update_one({"id": lottery_id}, {"$set": {"holidays": holidays}})
    return {"message": f"Festivo '{holiday['name']}' agregado", "holidays": holidays}


@router.delete("/{lottery_id}/holidays/{date}")
async def remove_holiday(lottery_id: str, date: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Remove a holiday from a lottery"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    holidays = lottery.get("holidays", [])
    new_holidays = [h for h in holidays if h["date"] != date]
    
    if len(new_holidays) == len(holidays):
        raise HTTPException(status_code=404, detail=f"No se encontró festivo para la fecha {date}")
    
    await db.lotteries.update_one({"id": lottery_id}, {"$set": {"holidays": new_holidays}})
    return {"message": f"Festivo eliminado para {date}", "holidays": new_holidays}


@router.get("/{lottery_id}/holidays")
async def get_holidays(lottery_id: str):
    """Get all holidays for a lottery"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    return lottery.get("holidays", [])


@router.get("/{lottery_id}/number-stats")
async def get_lottery_number_stats(lottery_id: str, current_user: dict = Depends(get_current_user)):
    """Get statistics of tickets sold per number"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    ticket_limit = lottery.get("ticket_limit_per_number")
    
    pipeline = [
        {"$match": {"lottery_id": lottery_id, "status": {"$ne": TicketStatus.CANCELLED.value}}},
        {"$unwind": "$numbers"},
        {"$group": {"_id": "$numbers", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    number_counts = await db.tickets.aggregate(pipeline).to_list(200)
    
    stats = []
    blocked_numbers = []
    for item in number_counts:
        num = item["_id"]
        count = item["count"]
        is_blocked = ticket_limit and ticket_limit > 0 and count >= ticket_limit
        stats.append({
            "number": num,
            "sold_count": count,
            "limit": ticket_limit,
            "remaining": (ticket_limit - count) if ticket_limit else None,
            "is_blocked": is_blocked
        })
        if is_blocked:
            blocked_numbers.append(num)
    
    return {
        "lottery_id": lottery_id,
        "lottery_name": lottery["name"],
        "ticket_limit_per_number": ticket_limit,
        "number_stats": stats,
        "blocked_numbers": blocked_numbers,
        "total_numbers_with_sales": len(stats)
    }
