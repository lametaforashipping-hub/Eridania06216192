"""Draw management routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
import random
from typing import Optional
from pydantic import BaseModel
from pymongo import UpdateOne, InsertOne
from models.schemas import DrawCreate
from models.enums import UserRole, TicketStatus, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc, calculate_prize
from utils.auth import require_role
from services.notifications import notify_winner, notify_draw_complete

router = APIRouter(prefix="/draws", tags=["Draws"])


class DrawCreateMultiPrize(BaseModel):
    """Create draw with multiple prize positions"""
    lottery_id: str
    first_prize: int
    second_prize: Optional[int] = None
    third_prize: Optional[int] = None
    draw_date: Optional[str] = None
    draw_time: Optional[str] = None


@router.post("")
async def create_draw(draw_data: DrawCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Create a draw and process winning tickets"""
    db = get_db()
    
    lottery = await db.lotteries.find_one({"id": draw_data.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    # Use manual winning numbers if provided
    if draw_data.winning_numbers and len(draw_data.winning_numbers) > 0:
        winning_numbers = draw_data.winning_numbers
        if len(winning_numbers) != lottery["numbers_to_pick"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Debe ingresar exactamente {lottery['numbers_to_pick']} número(s)"
            )
        for num in winning_numbers:
            if num < lottery["min_number"] or num > lottery["max_number"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Número {num} fuera de rango ({lottery['min_number']}-{lottery['max_number']})"
                )
    else:
        winning_numbers = random.sample(
            range(lottery["min_number"], lottery["max_number"] + 1),
            lottery["numbers_to_pick"]
        )
    winning_numbers.sort()
    
    draw = {
        "id": str(uuid.uuid4()),
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": winning_numbers,
        "position": draw_data.position,
        "draw_time": datetime.utcnow(),
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": lottery["currency"],
        "is_manual": draw_data.winning_numbers is not None
    }
    
    # Find pending tickets
    ticket_query = {
        "lottery_id": lottery["id"],
        "status": TicketStatus.PENDING.value
    }
    
    if draw_data.position:
        ticket_query["$or"] = [
            {"position": draw_data.position},
            {"position": None},
            {"position": {"$exists": False}}
        ]
    
    pending_tickets = await db.tickets.find(ticket_query).to_list(10000)
    
    total_winners = 0
    total_paid = 0.0
    winner_notifications = []
    
    ticket_ops = []
    transaction_ops = []
    
    for ticket in pending_tickets:
        prize = calculate_prize(ticket, lottery, winning_numbers, draw_data.position)
        
        if prize > 0:
            ticket_ops.append(UpdateOne(
                {"id": ticket["id"]},
                {"$set": {"status": TicketStatus.WON.value, "draw_id": draw["id"], "potential_win": prize}}
            ))
            total_winners += 1
            total_paid += prize
            
            transaction_ops.append(InsertOne({
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": prize,
                "currency": ticket["currency"],
                "description": f"Premio ganado - {lottery['name']} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.utcnow()
            }))
            
            winner_notifications.append({
                "user_id": ticket["seller_id"],
                "ticket_number": ticket["ticket_number"],
                "prize": prize
            })
        else:
            ticket_ops.append(UpdateOne(
                {"id": ticket["id"]},
                {"$set": {"status": TicketStatus.LOST.value, "draw_id": draw["id"]}}
            ))
    
    if ticket_ops:
        await db.tickets.bulk_write(ticket_ops)
    if transaction_ops:
        await db.transactions.bulk_write(transaction_ops)
    
    draw["total_tickets"] = len(pending_tickets)
    draw["total_winners"] = total_winners
    draw["total_paid"] = total_paid
    
    await db.draws.insert_one(draw)
    
    # Record number frequency
    for num in winning_numbers:
        await db.number_stats.update_one(
            {"lottery_id": lottery["id"], "number": num},
            {"$inc": {"frequency": 1}, "$set": {"last_drawn": datetime.utcnow()}},
            upsert=True
        )
    
    # Create draw result notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": "draw_result",
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": winning_numbers,
        "position": draw_data.position,
        "total_winners": total_winners,
        "created_at": datetime.utcnow(),
        "read_by": []
    }
    await db.notifications.insert_one(notification)
    
    # Create notifications for winners
    for winner in winner_notifications:
        seller_notification = {
            "id": str(uuid.uuid4()),
            "type": "winner_alert",
            "user_id": winner["user_id"],
            "lottery_id": lottery["id"],
            "lottery_name": lottery["name"],
            "ticket_number": winner["ticket_number"],
            "prize_amount": winner["prize"],
            "currency": lottery.get("currency", "RD$"),
            "message": f"🎉 ¡GANADOR! Boleto {winner['ticket_number']} ganó {lottery.get('currency', 'RD$')} {winner['prize']:,.2f}",
            "created_at": datetime.utcnow(),
            "read": False
        }
        await db.notifications.insert_one(seller_notification)
        
        await notify_winner(
            winner["user_id"],
            winner["ticket_number"],
            winner["prize"],
            lottery.get("currency", "RD$"),
            lottery["name"]
        )
    
    await notify_draw_complete(
        lottery["name"],
        winning_numbers,
        total_winners,
        total_paid,
        lottery.get("currency", "RD$")
    )
    
    return serialize_doc(draw)


@router.get("")
async def get_draws(lottery_id: Optional[str] = None, limit: int = 50):
    """Get draws list"""
    db = get_db()
    query = {}
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    draws = await db.draws.find(query).sort("draw_time", -1).to_list(limit)
    return serialize_doc(draws)


@router.get("/{draw_id}")
async def get_draw(draw_id: str):
    """Get a specific draw"""
    db = get_db()
    draw = await db.draws.find_one({"id": draw_id})
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    return serialize_doc(draw)


@router.put("/{draw_id}")
async def update_draw(draw_id: str, draw_data: dict, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Update an existing draw - Super Admin only"""
    db = get_db()
    draw = await db.draws.find_one({"id": draw_id})
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    
    update_data = {}
    if "winning_numbers" in draw_data:
        update_data["winning_numbers"] = draw_data["winning_numbers"]
    if "first_prize" in draw_data:
        update_data["first_prize"] = draw_data["first_prize"]
    if "second_prize" in draw_data:
        update_data["second_prize"] = draw_data["second_prize"]
    if "third_prize" in draw_data:
        update_data["third_prize"] = draw_data["third_prize"]
    
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
        update_data["updated_by"] = current_user["id"]
        await db.draws.update_one({"id": draw_id}, {"$set": update_data})
    
    updated_draw = await db.draws.find_one({"id": draw_id})
    return serialize_doc(updated_draw)


@router.post("/multi-prize")
async def create_draw_multi_prize(draw_data: DrawCreateMultiPrize, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Create a draw with 1st, 2nd, and 3rd place prizes"""
    db = get_db()
    
    lottery = await db.lotteries.find_one({"id": draw_data.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    
    # Validate numbers
    for prize_name, prize_value in [("Primer", draw_data.first_prize), ("Segundo", draw_data.second_prize), ("Tercer", draw_data.third_prize)]:
        if prize_value is not None:
            if prize_value < lottery["min_number"] or prize_value > lottery["max_number"]:
                raise HTTPException(
                    status_code=400, 
                    detail=f"{prize_name} premio ({prize_value}) fuera de rango ({lottery['min_number']}-{lottery['max_number']})"
                )
    
    # Parse draw datetime
    draw_datetime = datetime.utcnow()
    if draw_data.draw_date:
        try:
            date_part = datetime.strptime(draw_data.draw_date, "%Y-%m-%d")
            if draw_data.draw_time:
                time_parts = draw_data.draw_time.split(":")
                draw_datetime = date_part.replace(
                    hour=int(time_parts[0]), 
                    minute=int(time_parts[1]) if len(time_parts) > 1 else 0
                )
            else:
                draw_datetime = date_part
        except ValueError:
            pass
    
    draw = {
        "id": str(uuid.uuid4()),
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": [draw_data.first_prize],
        "first_prize": draw_data.first_prize,
        "second_prize": draw_data.second_prize,
        "third_prize": draw_data.third_prize,
        "position": "primera",
        "draw_time": draw_datetime,
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": lottery["currency"],
        "is_manual": True,
        "created_by": current_user["id"],
        "created_by_name": current_user["name"]
    }
    
    total_winners = 0
    total_paid = 0.0
    
    prize_tiers = lottery.get("prize_tiers", {"first": 70, "second": 15, "third": 5})
    
    for position, prize_number, tier_key in [
        ("primera", draw_data.first_prize, "first"),
        ("segunda", draw_data.second_prize, "second"),
        ("tercera", draw_data.third_prize, "third")
    ]:
        if prize_number is None:
            continue
            
        ticket_query = {
            "lottery_id": lottery["id"],
            "status": TicketStatus.PENDING.value,
            "numbers": prize_number
        }
        
        matching_tickets = await db.tickets.find(ticket_query).to_list(10000)
        multiplier = prize_tiers.get(tier_key, lottery.get("prize_multiplier", 70))
        
        for ticket in matching_tickets:
            prize = ticket.get("amount", 0) * multiplier
            
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {
                    "status": TicketStatus.WON.value, 
                    "draw_id": draw["id"], 
                    "potential_win": prize,
                    "won_position": position
                }}
            )
            total_winners += 1
            total_paid += prize
            
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": prize,
                "currency": ticket["currency"],
                "description": f"Premio {position} - {lottery['name']} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.utcnow()
            })
    
    # Mark remaining tickets as lost
    await db.tickets.update_many(
        {
            "lottery_id": lottery["id"],
            "status": TicketStatus.PENDING.value
        },
        {"$set": {"status": TicketStatus.LOST.value, "draw_id": draw["id"]}}
    )
    
    draw["total_winners"] = total_winners
    draw["total_paid"] = total_paid
    
    await db.draws.insert_one(draw)
    
    # Create notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": "draw_result",
        "lottery_id": lottery["id"],
        "lottery_name": lottery["name"],
        "winning_numbers": [draw_data.first_prize, draw_data.second_prize, draw_data.third_prize],
        "first_prize": draw_data.first_prize,
        "second_prize": draw_data.second_prize,
        "third_prize": draw_data.third_prize,
        "total_winners": total_winners,
        "created_at": datetime.utcnow(),
        "read_by": []
    }
    await db.notifications.insert_one(notification)
    
    return serialize_doc(draw)
