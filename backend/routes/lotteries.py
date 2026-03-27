"""Lottery management routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import Optional, Dict
from models.schemas import LotteryCreate, LotteryUpdate, DEFAULT_WEEKLY_SCHEDULE, DEFAULT_PLAY_TYPES
from models.enums import UserRole, TicketStatus
from utils.database import get_db
from utils.helpers import serialize_doc, check_lottery_open
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/lotteries", tags=["Lotteries"])


@router.post("")
async def create_lottery(lottery: LotteryCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Create a new lottery with multi-play support"""
    db = get_db()
    
    # Use provided play_types or default
    play_types = lottery.play_types if lottery.play_types else DEFAULT_PLAY_TYPES.copy()
    
    lottery_doc = {
        "id": str(uuid.uuid4()),
        "name": lottery.name,
        "country": lottery.country,
        "min_number": lottery.min_number,
        "max_number": lottery.max_number,
        "price": lottery.price,
        "currency": lottery.currency.value,
        "schedule": lottery.schedule,
        "closing_minutes_before": lottery.closing_minutes_before,
        "active": lottery.active,
        "opening_time": lottery.opening_time,
        "closing_time": lottery.closing_time,
        "weekly_hours": lottery.weekly_hours or DEFAULT_WEEKLY_SCHEDULE,
        "holidays": lottery.holidays or [],
        "ticket_limit_per_number": lottery.ticket_limit_per_number,
        "play_types": play_types,
        "created_at": datetime.utcnow(),
        # Legacy fields for backward compatibility
        "lottery_type": lottery.lottery_type or "multi",
        "numbers_to_pick": lottery.numbers_to_pick or 1,
        "prize_multiplier": lottery.prize_multiplier or 70.0,
        "allows_combined": lottery.allows_combined if lottery.allows_combined is not None else True,
        "prize_rules": lottery.prize_rules or []
    }
    await db.lotteries.insert_one(lottery_doc)
    return {"message": "Lotería creada", "lottery_id": lottery_doc["id"], "name": lottery.name}


@router.get("")
async def get_lotteries(active_only: bool = True, country: Optional[str] = None):
    """Get all lotteries with their current status, sorted: open first by draw time, closed at bottom"""
    db = get_db()
    query = {}
    if active_only:
        query["active"] = True
    if country:
        query["country"] = country
    
    # Sort by sort_order (time-based) from database
    lotteries = await db.lotteries.find(query).sort("sort_order", 1).to_list(100)
    
    open_lotteries = []
    closed_lotteries = []
    
    for l in lotteries:
        is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(l)
        lottery_data = {
            **serialize_doc(l),
            "is_open": is_open,
            "next_draw_time": next_draw,
            "closed_message": closed_message,
            "today_hours": today_hours,
            "is_holiday": holiday_info is not None,
            "holiday_name": holiday_info.get("name") if holiday_info else None,
            "display_time": l.get("display_time", ""),
            "display_closing": l.get("display_closing", "")
        }
        
        # Separate open and closed lotteries
        if is_open:
            open_lotteries.append(lottery_data)
        else:
            closed_lotteries.append(lottery_data)
    
    # Return open lotteries first (sorted by time), then closed ones
    return open_lotteries + closed_lotteries


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


@router.put("/{lottery_id}/prize-tiers")
async def update_lottery_prize_tiers(
    lottery_id: str,
    prize_tiers: Dict[str, float],
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update prize tiers for a lottery (Super Admin only)
    Example: {"first": 70, "second": 15, "third": 5}
    """
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    await db.lotteries.update_one(
        {"id": lottery_id},
        {"$set": {
            "prize_tiers": prize_tiers,
            "prize_tiers_updated_at": datetime.utcnow(),
            "prize_tiers_updated_by": current_user["id"]
        }}
    )
    return {"message": f"Tiers de premios actualizados para {lottery['name']}"}


@router.put("/{lottery_id}/play-types/{play_type}")
async def update_play_type_config(
    lottery_id: str,
    play_type: str,
    config: Dict,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Update configuration for a specific play type in a lottery
    
    play_type: quiniela, pale, tripleta, super_pale
    config: {
        "multipliers": {"first": 70, "second": 20, "third": 10},
        "enabled": true
    }
    """
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    play_types = lottery.get("play_types", {})
    if play_type not in play_types:
        raise HTTPException(status_code=400, detail=f"Tipo de jugada '{play_type}' no existe en esta lotería")
    
    # Update multipliers if provided
    if "multipliers" in config:
        play_types[play_type]["multipliers"] = config["multipliers"]
    
    # Update enabled status if provided
    if "enabled" in config:
        play_types[play_type]["enabled"] = config["enabled"]
    
    await db.lotteries.update_one(
        {"id": lottery_id},
        {"$set": {
            "play_types": play_types,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user["id"]
        }}
    )
    return {
        "message": f"Tipo de jugada {play_type} actualizado para {lottery['name']}",
        "play_type": play_type,
        "config": play_types[play_type]
    }


@router.put("/{lottery_id}/play-types/{play_type}/toggle")
async def toggle_play_type(
    lottery_id: str,
    play_type: str,
    enabled: bool,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))
):
    """Enable or disable a play type for a lottery"""
    db = get_db()
    lottery = await db.lotteries.find_one({"id": lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    play_types = lottery.get("play_types", {})
    if play_type not in play_types:
        raise HTTPException(status_code=400, detail=f"Tipo de jugada '{play_type}' no existe")
    
    play_types[play_type]["enabled"] = enabled
    
    await db.lotteries.update_one(
        {"id": lottery_id},
        {"$set": {"play_types": play_types}}
    )
    
    status = "habilitado" if enabled else "deshabilitado"
    return {"message": f"Tipo {play_type} {status} para {lottery['name']}"}
