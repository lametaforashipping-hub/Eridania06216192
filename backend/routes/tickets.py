"""Ticket sales routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from datetime import datetime
import io
import base64
import uuid
import os
from typing import Optional
from models.schemas import TicketCreate, MultiPlayTicketCreate
from models.enums import UserRole, TicketStatus, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc, generate_ticket_number, check_lottery_open
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/tickets", tags=["Tickets"])


def get_ticket_message(status: str) -> str:
    """Get human readable message for ticket status"""
    messages = {
        "won": "🎉 ¡BOLETO GANADOR! Presente este boleto para cobrar su premio.",
        "paid": "✅ Este boleto ya fue pagado.",
        "lost": "😔 Este boleto no resultó ganador.",
        "pending": "⏳ Sorteo pendiente. Espere los resultados.",
        "cancelled": "❌ Este boleto fue cancelado."
    }
    return messages.get(status, "Estado desconocido")


@router.post("")
async def create_ticket(ticket: TicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a simple ticket"""
    db = get_db()
    
    lottery = await db.lotteries.find_one({"id": ticket.lottery_id})
    if not lottery:
        raise HTTPException(status_code=404, detail="Lotería no encontrada")
    if not lottery.get("active", True):
        raise HTTPException(status_code=400, detail="Lotería no activa")
    
    is_open, next_draw, closed_message, today_hours, holiday_info = check_lottery_open(lottery)
    if not is_open:
        error_msg = closed_message or f"La lotería está cerrada. Próximo sorteo: {next_draw}"
        raise HTTPException(status_code=400, detail=error_msg)
    
    for num in ticket.numbers:
        if num < lottery["min_number"] or num > lottery["max_number"]:
            raise HTTPException(status_code=400, detail=f"Número {num} fuera de rango")
    
    if len(ticket.numbers) != lottery["numbers_to_pick"]:
        raise HTTPException(status_code=400, detail=f"Debe seleccionar {lottery['numbers_to_pick']} números")
    
    # Check ticket limit per number
    ticket_limit = lottery.get("ticket_limit_per_number")
    limit_warnings = []
    if ticket_limit and ticket_limit > 0:
        for num in ticket.numbers:
            sold_count = await db.tickets.count_documents({
                "lottery_id": ticket.lottery_id,
                "numbers": num,
                "status": {"$ne": TicketStatus.CANCELLED.value}
            })
            if sold_count >= ticket_limit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Límite alcanzado: El número {num} ya tiene {sold_count} boletos vendidos (máximo: {ticket_limit})"
                )
            new_count = sold_count + 1
            if new_count >= ticket_limit * 0.8:
                remaining = ticket_limit - new_count
                limit_warnings.append({
                    "number": num,
                    "sold": new_count,
                    "limit": ticket_limit,
                    "remaining": remaining
                })
    
    # Check credit limit for vendors
    if current_user["role"] == UserRole.VENDEDOR.value:
        today_sales = await db.tickets.aggregate([
            {"$match": {
                "seller_id": current_user["id"],
                "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)},
                "status": {"$ne": TicketStatus.CANCELLED.value}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        current_sales = today_sales[0]["total"] if today_sales else 0
        if current_sales + ticket.amount > current_user["credit_limit"]:
            raise HTTPException(status_code=400, detail="Límite de crédito excedido")
    
    # Calculate potential win
    potential_win = ticket.amount * lottery["prize_multiplier"]
    if ticket.position and lottery.get("prize_rules"):
        for rule in lottery["prize_rules"]:
            if rule.get("position") == ticket.position:
                potential_win = ticket.amount * rule.get("multiplier", lottery["prize_multiplier"])
                break
    
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "ticket_number": generate_ticket_number(),
        "lottery_id": ticket.lottery_id,
        "lottery_name": lottery["name"],
        "seller_id": current_user["id"],
        "seller_name": current_user["name"],
        "numbers": ticket.numbers,
        "amount": ticket.amount,
        "currency": ticket.currency.value,
        "potential_win": potential_win,
        "status": TicketStatus.PENDING.value,
        "customer_name": ticket.customer_name,
        "position": ticket.position,
        "is_combined": ticket.is_combined,
        "created_at": datetime.utcnow(),
        "draw_id": None,
        "paid_at": None,
        "cancelled_at": None
    }
    await db.tickets.insert_one(ticket_doc)
    
    # Check high-risk and create notification
    config = await db.system_config.find_one({"type": "global"})
    threshold_rd = config.get("high_risk_threshold_rd", 10000.0) if config else 10000.0
    threshold_usd = config.get("high_risk_threshold_usd", 200.0) if config else 200.0
    
    is_high_risk = False
    if ticket.currency.value == "RD$" and ticket.amount >= threshold_rd:
        is_high_risk = True
    elif ticket.currency.value == "USD" and ticket.amount >= threshold_usd:
        is_high_risk = True
    
    if is_high_risk:
        super_admins = await db.users.find({"role": "super_admin", "active": True}).to_list(100)
        for admin in super_admins:
            notification_doc = {
                "id": str(uuid.uuid4()),
                "user_id": admin["id"],
                "title": "⚠️ ALERTA: Ticket de Alto Riesgo",
                "message": f"Vendedor {current_user['name']} creó un ticket de {ticket.currency.value} {ticket.amount:,.2f} (#{ticket_doc['ticket_number']})",
                "type": "high_risk_alert",
                "reference_id": ticket_doc["id"],
                "ticket_number": ticket_doc["ticket_number"],
                "seller_name": current_user["name"],
                "amount": ticket.amount,
                "currency": ticket.currency.value,
                "read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(notification_doc)
    
    # Update seller stats
    commission_rate = current_user.get("commission_rate", 10.0)
    commission = ticket.amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {"total_sales": ticket.amount, "total_commission": commission, "balance": commission},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    
    # Record transactions
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.SALE.value,
        "amount": ticket.amount,
        "currency": ticket.currency.value,
        "description": f"Venta de boleto {lottery['name']} - {ticket.numbers}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.COMMISSION.value,
        "amount": commission,
        "currency": ticket.currency.value,
        "description": f"Comisión {commission_rate}% de venta {ticket_doc['ticket_number']}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    response = {**serialize_doc(ticket_doc), "commission_earned": commission}
    if limit_warnings:
        response["limit_warnings"] = limit_warnings
        warnings_msg = []
        for w in limit_warnings:
            if w["remaining"] == 0:
                warnings_msg.append(f"Número {w['number']}: LÍMITE ALCANZADO ({w['sold']}/{w['limit']})")
            else:
                warnings_msg.append(f"Número {w['number']}: quedan {w['remaining']} de {w['limit']}")
        response["limit_warning_message"] = " | ".join(warnings_msg)
    
    return response


@router.post("/multi")
async def create_multi_play_ticket(ticket_data: MultiPlayTicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a single ticket with multiple plays"""
    db = get_db()
    
    if not ticket_data.plays or len(ticket_data.plays) == 0:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una jugada")
    
    # Handle impersonation
    effective_user = current_user
    impersonated_by = None
    
    if ticket_data.act_as_user_id:
        if current_user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Solo el Super Admin puede crear tickets en nombre de otro usuario")
        
        target_user = await db.users.find_one({"id": ticket_data.act_as_user_id})
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")
        
        effective_user = target_user
        impersonated_by = current_user.get("id")
    
    all_lotteries = await db.lotteries.find({"active": True}).to_list(100)
    lottery_map = {l["lottery_type"]: l for l in all_lotteries}
    
    # Check if any lottery is open
    any_lottery_open = False
    for lottery in all_lotteries:
        is_open, _, _, _, _ = check_lottery_open(lottery)
        if is_open:
            any_lottery_open = True
            break
    
    if not any_lottery_open:
        raise HTTPException(
            status_code=400, 
            detail="Todas las loterías están cerradas. No se pueden crear jugadas en este momento."
        )
    
    # Validate and calculate each play
    plays_data = []
    total_amount = 0
    total_potential_win = 0
    multi_play_limit_warnings = []
    
    for play in ticket_data.plays:
        lottery = None
        if play.lottery_id:
            lottery = next((l for l in all_lotteries if l["id"] == play.lottery_id), None)
        
        if not lottery:
            lottery = lottery_map.get(play.lottery_type)
        if not lottery:
            lottery = next((l for l in all_lotteries if l["lottery_type"] == play.lottery_type), None)
        
        if not lottery:
            raise HTTPException(status_code=400, detail=f"Tipo de lotería '{play.lottery_type}' no encontrado")
        
        # Validate numbers
        expected_numbers = lottery.get("numbers_to_pick", 1)
        if play.lottery_type in ["quiniela", "quinieloto"]:
            expected_numbers = 1
        elif play.lottery_type in ["pale", "super_pale"]:
            expected_numbers = 2
        elif play.lottery_type == "tripleta":
            expected_numbers = 3
        
        if len(play.numbers) != expected_numbers:
            raise HTTPException(status_code=400, detail=f"El tipo {play.lottery_type} requiere {expected_numbers} número(s)")
        
        min_num = lottery.get("min_number", 0)
        max_num = lottery.get("max_number", 99)
        for num in play.numbers:
            if num < min_num or num > max_num:
                raise HTTPException(status_code=400, detail=f"Número {num} fuera de rango ({min_num}-{max_num})")
        
        # Check ticket limit
        ticket_limit = lottery.get("ticket_limit_per_number")
        if ticket_limit and ticket_limit > 0:
            for num in play.numbers:
                sold_count = await db.tickets.count_documents({
                    "lottery_id": lottery["id"],
                    "numbers": num,
                    "status": {"$ne": TicketStatus.CANCELLED.value}
                })
                if sold_count >= ticket_limit:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Límite alcanzado: El número {num} ya tiene {sold_count} boletos vendidos (máximo: {ticket_limit})"
                    )
                new_count = sold_count + 1
                if new_count >= ticket_limit * 0.8:
                    remaining = ticket_limit - new_count
                    if not any(w["number"] == num and w["lottery_id"] == lottery["id"] for w in multi_play_limit_warnings):
                        multi_play_limit_warnings.append({
                            "number": num,
                            "lottery_id": lottery["id"],
                            "lottery_name": lottery["name"],
                            "sold": new_count,
                            "limit": ticket_limit,
                            "remaining": remaining
                        })
        
        # Get multipliers based on seller's country
        seller_country = effective_user.get("country", "RD")
        prize_config = await db.prize_config.find_one({"country": seller_country})
        
        # Default multipliers
        DEFAULT_MULTIPLIERS = {
            "RD": {
                "quiniela": {"first": 70, "second": 20, "third": 10},
                "pale": {"first": 1000, "second": 100, "third": 50},
                "tripleta": {"first": 50000, "second": 5000, "third": 2500},
                "super_pale": {"first": 2500, "second": 250, "third": 125}
            },
            "US": {
                "quiniela": {"first": 60, "second": 12, "third": 4},
                "pale": {"first": 1500, "second": 100, "third": 100},
                "tripleta": {"first": 10000, "second": 150, "third": 150},
                "super_pale": {"first": 2000, "second": 200, "third": 100}
            }
        }
        
        # Get the multiplier for this play type
        play_type_lower = play.lottery_type.lower()
        if prize_config and play_type_lower in prize_config:
            multipliers = prize_config[play_type_lower]
        else:
            defaults = DEFAULT_MULTIPLIERS.get(seller_country, DEFAULT_MULTIPLIERS["RD"])
            multipliers = defaults.get(play_type_lower, defaults["quiniela"])
        
        # Determine which position multiplier to use
        position = play.position or "first"
        multiplier = multipliers.get(position, multipliers.get("first", 70))
        
        potential_win = play.amount * multiplier
        
        plays_data.append({
            "lottery_type": play.lottery_type,
            "lottery_name": lottery["name"],
            "lottery_id": lottery["id"],
            "numbers": play.numbers,
            "amount": play.amount,
            "position": play.position,
            "potential_win": potential_win,
            "multiplier": multiplier,
            "seller_country": seller_country
        })
        
        total_amount += play.amount
        total_potential_win += potential_win
    
    # Check credit limit
    if effective_user["role"] == UserRole.VENDEDOR.value:
        # First check if vendor has sufficient balance
        vendor_balance = effective_user.get("balance", 0)
        if vendor_balance <= 0:
            # Block vendor if balance is zero
            await db.users.update_one(
                {"id": effective_user["id"]},
                {"$set": {"active": False, "blocked_reason": "zero_balance"}}
            )
            raise HTTPException(
                status_code=403, 
                detail="Tu balance es $0. No puedes realizar ventas hasta que deposites fondos. Tu cuenta ha sido bloqueada temporalmente."
            )
        
        today_sales = await db.tickets.aggregate([
            {"$match": {
                "seller_id": effective_user["id"],
                "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)},
                "status": {"$ne": TicketStatus.CANCELLED.value}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        current_sales = today_sales[0]["total"] if today_sales else 0
        if current_sales + total_amount > effective_user["credit_limit"]:
            raise HTTPException(status_code=400, detail="Límite de crédito excedido")
    
    # Determine currency based on seller's country
    seller_country = effective_user.get("country", "RD")
    if seller_country == "US":
        ticket_currency = "USD"
    else:
        ticket_currency = "RD$"
    
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "ticket_number": generate_ticket_number(),
        "ticket_type": "multi_play",
        "seller_id": effective_user["id"],
        "seller_name": effective_user["name"],
        "seller_country": seller_country,
        "plays": plays_data,
        "plays_count": len(plays_data),
        "total_amount": total_amount,
        "total_potential_win": total_potential_win,
        "currency": ticket_currency,
        "status": TicketStatus.PENDING.value,
        "customer_name": ticket_data.customer_name,
        "created_at": datetime.utcnow(),
        "paid_at": None,
        "cancelled_at": None,
        "impersonated_by": impersonated_by
    }
    
    await db.tickets.insert_one(ticket_doc)
    
    # Check high-risk
    config = await db.system_config.find_one({"type": "global"})
    threshold_rd = config.get("high_risk_threshold_rd", 10000.0) if config else 10000.0
    threshold_usd = config.get("high_risk_threshold_usd", 200.0) if config else 200.0
    
    is_high_risk = False
    if ticket_data.currency.value == "RD$" and total_amount >= threshold_rd:
        is_high_risk = True
    elif ticket_data.currency.value == "USD" and total_amount >= threshold_usd:
        is_high_risk = True
    
    if is_high_risk:
        super_admins = await db.users.find({"role": "super_admin", "active": True}).to_list(100)
        for admin in super_admins:
            notification_doc = {
                "id": str(uuid.uuid4()),
                "user_id": admin["id"],
                "title": "⚠️ ALERTA: Ticket de Alto Riesgo",
                "message": f"Vendedor {effective_user['name']} creó un ticket de {ticket_data.currency.value} {total_amount:,.2f} (#{ticket_doc['ticket_number']})",
                "type": "high_risk_alert",
                "reference_id": ticket_doc["id"],
                "ticket_number": ticket_doc["ticket_number"],
                "seller_name": effective_user["name"],
                "amount": total_amount,
                "currency": ticket_data.currency.value,
                "read": False,
                "created_at": datetime.utcnow()
            }
            await db.notifications.insert_one(notification_doc)
    
    # Update stats
    commission_rate = effective_user.get("commission_rate", 10.0)
    commission = total_amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": effective_user["id"]},
        {
            "$inc": {"total_sales": total_amount, "total_commission": commission, "balance": commission},
            "$set": {"last_activity": datetime.utcnow()}
        }
    )
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": effective_user["id"],
        "user_name": effective_user["name"],
        "transaction_type": TransactionType.SALE.value,
        "amount": total_amount,
        "currency": ticket_data.currency.value,
        "description": f"Venta multi-jugada ({len(plays_data)} jugadas)" + (f" [Creado por Admin]" if impersonated_by else ""),
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": effective_user["id"],
        "user_name": effective_user["name"],
        "transaction_type": TransactionType.COMMISSION.value,
        "amount": commission,
        "currency": ticket_data.currency.value,
        "description": f"Comisión {commission_rate}% de multi-jugada {ticket_doc['ticket_number']}",
        "reference_id": ticket_doc["id"],
        "created_at": datetime.utcnow()
    })
    
    # Check sales milestones
    try:
        alert_config = await db.alert_settings.find_one({"type": "global"})
        if alert_config and alert_config.get("notify_on_milestone", True):
            milestone = alert_config.get("milestone_rd", 50000) if seller_country != "US" else alert_config.get("milestone_usd", 1000)
            currency_sym = "RD$" if seller_country != "US" else "US$"
            
            # Get today's total sales for this seller
            today_total_pipeline = [
                {"$match": {
                    "seller_id": effective_user["id"],
                    "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)},
                    "status": {"$ne": TicketStatus.CANCELLED.value}
                }},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$amount", "$total_amount"]}}}}
            ]
            today_result = await db.tickets.aggregate(today_total_pipeline).to_list(1)
            today_total = today_result[0]["total"] if today_result else 0
            prev_total = today_total - total_amount
            
            # Check if milestone just crossed
            if prev_total < milestone <= today_total:
                milestone_notification = {
                    "id": str(uuid.uuid4()),
                    "type": "sales_milestone",
                    "target_role": "all",
                    "title": f"Meta de Ventas Alcanzada",
                    "message": f"{effective_user['name']} alcanzó {currency_sym} {milestone:,.0f} en ventas hoy (Total: {currency_sym} {today_total:,.0f})",
                    "seller_id": effective_user["id"],
                    "seller_name": effective_user["name"],
                    "milestone": milestone,
                    "today_total": today_total,
                    "currency": currency_sym,
                    "created_at": datetime.utcnow(),
                    "read_by": []
                }
                await db.notifications.insert_one(milestone_notification)
            
            # Check daily target
            daily_target = alert_config.get("daily_target_rd", 100000) if seller_country != "US" else alert_config.get("daily_target_usd", 2000)
            if alert_config.get("notify_on_daily_target", True) and prev_total < daily_target <= today_total:
                target_notification = {
                    "id": str(uuid.uuid4()),
                    "type": "daily_target",
                    "target_role": "all",
                    "title": f"Meta Diaria Alcanzada",
                    "message": f"{effective_user['name']} alcanzó la meta diaria de {currency_sym} {daily_target:,.0f}",
                    "seller_id": effective_user["id"],
                    "seller_name": effective_user["name"],
                    "daily_target": daily_target,
                    "today_total": today_total,
                    "currency": currency_sym,
                    "created_at": datetime.utcnow(),
                    "read_by": []
                }
                await db.notifications.insert_one(target_notification)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Milestone check failed: {e}")
    
    response = {**serialize_doc(ticket_doc), "commission_earned": commission}
    if multi_play_limit_warnings:
        response["limit_warnings"] = multi_play_limit_warnings
        warnings_msg = []
        for w in multi_play_limit_warnings:
            if w["remaining"] == 0:
                warnings_msg.append(f"Número {w['number']}: LÍMITE ALCANZADO ({w['sold']}/{w['limit']})")
            else:
                warnings_msg.append(f"Número {w['number']}: quedan {w['remaining']} de {w['limit']}")
        response["limit_warning_message"] = " | ".join(warnings_msg)
    
    return response


@router.get("")
async def get_tickets(
    status: Optional[TicketStatus] = None,
    lottery_id: Optional[str] = None,
    seller_id: Optional[str] = None,
    country: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    current_user: dict = Depends(get_current_user)
):
    """Get tickets with filters and pagination"""
    db = get_db()
    query = {}
    
    # Build seller filter first
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    if seller_id and current_user["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        query["seller_id"] = seller_id
    if status:
        query["status"] = status.value
    
    # Handle lottery filtering - must account for multi_play tickets
    user_country = current_user.get("country", "RD")
    lottery_filter_ids = None
    
    if lottery_id:
        # Specific lottery filter
        lottery_filter_ids = [lottery_id]
    elif current_user["role"] == UserRole.SUPER_ADMIN.value:
        if country:
            country_lotteries = await db.lotteries.find({"country": country}).to_list(1000)
            lottery_filter_ids = [l["id"] for l in country_lotteries]
    else:
        # Non-super-admin users filter by their country's lotteries
        country_lotteries = await db.lotteries.find({"country": user_country}).to_list(1000)
        lottery_filter_ids = [l["id"] for l in country_lotteries]
    
    # Apply lottery filter that works for both simple and multi_play tickets
    if lottery_filter_ids:
        query["$or"] = [
            # Simple tickets with lottery_id at root level
            {"lottery_id": {"$in": lottery_filter_ids}},
            # Multi-play tickets with lottery_id inside plays array
            {"ticket_type": "multi_play", "plays.lottery_id": {"$in": lottery_filter_ids}}
        ]
    
    # Get total count for pagination
    total_count = await db.tickets.count_documents(query)
    
    # Get status counts for filters (only once per query without status filter)
    status_counts = {}
    if not status:
        base_query = {k: v for k, v in query.items() if k != "status"}
        pipeline = [
            {"$match": base_query},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_agg = await db.tickets.aggregate(pipeline).to_list(10)
        status_counts = {s["_id"]: s["count"] for s in status_agg}
    
    # Calculate pagination
    skip = (page - 1) * limit
    total_pages = (total_count + limit - 1) // limit
    
    tickets = await db.tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "tickets": serialize_doc(tickets),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "status_counts": status_counts
    }


@router.get("/today")
async def get_today_tickets(current_user: dict = Depends(get_current_user)):
    """Get today's tickets"""
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = {"created_at": {"$gte": today_start}}
    
    if current_user["role"] == UserRole.VENDEDOR.value:
        query["seller_id"] = current_user["id"]
    elif current_user["role"] == UserRole.ADMIN.value:
        vendedores = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
        vendor_ids = [v["id"] for v in vendedores] + [current_user["id"]]
        query["seller_id"] = {"$in": vendor_ids}
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)


@router.get("/recent-plays")
async def get_recent_plays(current_user: dict = Depends(get_current_user), limit: int = 10):
    """Get recent unique plays for quick re-selection"""
    db = get_db()
    
    # Get last 50 tickets to find unique plays
    query = {"seller_id": current_user["id"]}
    tickets = await db.tickets.find(query).sort("created_at", -1).limit(50).to_list(50)
    
    # Extract unique plays (by numbers + lottery_type combination)
    seen_plays = set()
    recent_plays = []
    
    for ticket in tickets:
        # Handle multi-play tickets
        if ticket.get("ticket_type") == "multi_play" and ticket.get("plays"):
            for play in ticket.get("plays", []):
                # Create unique key for this play
                play_key = f"{play.get('lottery_type', 'quiniela')}:{','.join(map(str, sorted(play.get('numbers', []))))}"
                if play_key not in seen_plays:
                    seen_plays.add(play_key)
                    recent_plays.append({
                        "id": f"{ticket['id']}_{len(recent_plays)}",
                        "lottery_type": play.get("lottery_type", "quiniela"),
                        "lottery_id": play.get("lottery_id"),
                        "lottery_name": play.get("lottery_name", ""),
                        "numbers": play.get("numbers", []),
                        "amount": play.get("amount", 20),
                        "created_at": (ticket["created_at"].isoformat() + 'Z') if ticket.get("created_at") else None
                    })
                    if len(recent_plays) >= limit:
                        break
        # Handle simple tickets
        elif ticket.get("numbers"):
            play_key = f"{ticket.get('lottery_type', 'quiniela')}:{','.join(map(str, sorted(ticket.get('numbers', []))))}"
            if play_key not in seen_plays:
                seen_plays.add(play_key)
                recent_plays.append({
                    "id": ticket["id"],
                    "lottery_type": ticket.get("lottery_type", "quiniela"),
                    "lottery_id": ticket.get("lottery_id"),
                    "lottery_name": ticket.get("lottery_name", ""),
                    "numbers": ticket.get("numbers", []),
                    "amount": ticket.get("amount", 20),
                    "created_at": (ticket["created_at"].isoformat() + 'Z') if ticket.get("created_at") else None
                })
        
        if len(recent_plays) >= limit:
            break
    
    return recent_plays


@router.get("/verify/{ticket_number}")
async def verify_ticket(ticket_number: str):
    """Public endpoint to verify ticket status"""
    db = get_db()
    ticket = await db.tickets.find_one({"ticket_number": ticket_number})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    lottery = await db.lotteries.find_one({"id": ticket.get("lottery_id")})
    lottery_name = lottery["name"] if lottery else ticket.get("lottery_name", "N/A")
    
    return {
        "ticket_number": ticket["ticket_number"],
        "status": ticket["status"],
        "is_winner": ticket["status"] in ["won", "paid"],
        "is_paid": ticket["status"] == "paid",
        "lottery_name": lottery_name,
        "numbers": ticket.get("numbers", []),
        "plays": ticket.get("plays", []),
        "amount": ticket.get("amount") or ticket.get("total_amount", 0),
        "potential_win": ticket.get("potential_win") or ticket.get("total_potential_win", 0),
        "currency": ticket.get("currency", "RD$"),
        "created_at": ticket["created_at"].isoformat(),
        "customer_name": ticket.get("customer_name"),
        "message": get_ticket_message(ticket["status"])
    }


@router.get("/qr/{ticket_number}")
async def get_qr_code(ticket_number: str):
    """Generate QR code as base64 JSON"""
    import qrcode
    
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(ticket_number)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    return {"qr": f"data:image/png;base64,{b64}"}


@router.get("/receipt-image/{ticket_number}")
async def get_receipt_image(ticket_number: str):
    """Generate a complete receipt image matching the reference design exactly"""
    import qrcode
    from PIL import Image, ImageDraw, ImageFont
    from collections import defaultdict
    import base64
    
    db = get_db()
    
    # Find ticket
    ticket = await db.tickets.find_one({"ticket_number": ticket_number})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    
    # Get company profile
    company = await db.company_profile.find_one({})
    company_name = company.get("company_name", "LOTERIA MAGICA") if company else "LOTERIA MAGICA"
    company_address = company.get("address", "SANTO DOMINGO") if company else "SANTO DOMINGO"
    company_city = company.get("city", "DISTRITO NACIONAL") if company else "DISTRITO NACIONAL"
    company_rnc = company.get("rnc", "123-456-789") if company else "123-456-789"
    
    # Fonts - different sizes for hierarchy
    try:
        font_company = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 24)
        font_address = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 14)
        font_label = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 14)
        font_ticket_num = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 20)
        font_date = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 14)
        font_lottery_name = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 13)
        font_numbers = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 16)
        font_amount = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 13)
        font_type_badge = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 12)
        font_total_label = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 16)
        font_total_amount = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 22)
        font_footer = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 14)
    except Exception:
        font_company = ImageFont.load_default()
        font_address = font_company
        font_label = font_company
        font_ticket_num = font_company
        font_date = font_company
        font_lottery_name = font_company
        font_numbers = font_company
        font_amount = font_company
        font_type_badge = font_company
        font_total_label = font_company
        font_total_amount = font_company
        font_footer = font_company
    
    # Receipt dimensions
    width = 420
    margin = 25
    
    # Abbreviations for play types
    PLAY_TYPE_ABBR = {
        "quiniela": "Q", "pale": "P", "tripleta": "T",
        "super_pale": "SP", "first": "1ra", "second": "2da", "third": "3ra"
    }
    
    # Group plays by lottery name
    plays = ticket.get("plays", [])
    plays_by_lottery = defaultdict(list)
    
    # Build lottery ID to name mapping for lookups
    lottery_id_to_name = {}
    all_lotteries = await db.lotteries.find({}, {"id": 1, "name": 1}).to_list(100)
    for lot in all_lotteries:
        lottery_id_to_name[lot.get("id", "")] = lot.get("name", "LOTERÍA")
    
    for play in plays:
        lottery_name = play.get("lottery_name")
        if not lottery_name or lottery_name == "LOTERÍA":
            lottery_id = play.get("lottery_id", "")
            lottery_name = lottery_id_to_name.get(lottery_id, "LOTERÍA")
        plays_by_lottery[lottery_name].append(play)
    
    # Get the currency from ticket
    ticket_currency = ticket.get("currency", "RD$")
    currency_display = "US$" if ticket_currency in ["USD", "US$", "US"] else "RD$"
    
    # Calculate height - plays in card grid (2 per row)
    total_plays = len(plays)
    rows_of_plays = (total_plays + 1) // 2  # Ceiling division for 2 cards per row
    card_height = 65
    estimated_height = 120 + 120 + 100 + (rows_of_plays * (card_height + 15)) + 80 + 180 + 100
    
    img = Image.new('RGB', (width, estimated_height), 'white')
    draw = ImageDraw.Draw(img)
    
    y = 20
    
    # === LOGO (Golden ball with 7) - Using the uploaded logo ===
    try:
        LOGO_BASE64 = "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"
        
        logo_data = base64.b64decode(LOGO_BASE64)
        logo_img = Image.open(io.BytesIO(logo_data))
        
        # Convert RGBA to RGB with white background
        if logo_img.mode == 'RGBA':
            bg = Image.new('RGB', logo_img.size, 'white')
            bg.paste(logo_img, mask=logo_img.split()[3])
            logo_img = bg
        elif logo_img.mode != 'RGB':
            logo_img = logo_img.convert('RGB')
        
        # Resize logo to 80x80
        logo_img = logo_img.resize((80, 80), Image.Resampling.LANCZOS)
        
        # Center the logo
        logo_x = (width - 80) // 2
        img.paste(logo_img, (logo_x, y))
        y += 90
    except Exception as e:
        print(f"[RECEIPT] Logo load error: {e}")
        y += 20
    
    # === COMPANY NAME (bold, centered, dark blue) ===
    company_display = company_name.upper()
    bbox = draw.textbbox((0, 0), company_display, font=font_company)
    text_w = bbox[2] - bbox[0]
    draw.text(((width - text_w) // 2, y), company_display, fill='#1a237e', font=font_company)
    y += 32
    
    # === ADDRESS INFO (centered, gray) ===
    address_color = '#666666'
    for line in [company_address.upper(), company_city.upper(), f"RNC: {company_rnc}"]:
        bbox = draw.textbbox((0, 0), line, font=font_address)
        text_w = bbox[2] - bbox[0]
        draw.text(((width - text_w) // 2, y), line, fill=address_color, font=font_address)
        y += 20
    
    y += 15
    
    # === SOLID LINE SEPARATOR ===
    draw.line([(margin, y), (width - margin, y)], fill='#cccccc', width=1)
    y += 25
    
    # === "NO. BOLETO" LABEL (centered, blue) ===
    label = "NO. BOLETO"
    bbox = draw.textbbox((0, 0), label, font=font_label)
    text_w = bbox[2] - bbox[0]
    draw.text(((width - text_w) // 2, y), label, fill='#3949ab', font=font_label)
    y += 22
    
    # === TICKET NUMBER (bold, centered, dark) ===
    bbox = draw.textbbox((0, 0), ticket_number, font=font_ticket_num)
    text_w = bbox[2] - bbox[0]
    draw.text(((width - text_w) // 2, y), ticket_number, fill='#1a1a2e', font=font_ticket_num)
    y += 30
    
    # === DATE (centered, gray) ===
    created = ticket.get("created_at")
    if created:
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace('Z', '+00:00'))
            except:
                created = None
        if created:
            from datetime import timedelta, timezone as tz
            dr_tz = tz(timedelta(hours=-4))
            created_dr = created.astimezone(dr_tz) if created.tzinfo else created
            hour = created_dr.hour
            am_pm = "a. m." if hour < 12 else "p. m."
            hour_12 = hour if hour <= 12 else hour - 12
            if hour_12 == 0:
                hour_12 = 12
            date_str = f"{created_dr.day:02d}/{created_dr.month:02d}/{created_dr.year}, {hour_12}:{created_dr.minute:02d} {am_pm}"
            bbox = draw.textbbox((0, 0), date_str, font=font_date)
            text_w = bbox[2] - bbox[0]
            draw.text(((width - text_w) // 2, y), date_str, fill='#666666', font=font_date)
            y += 25
    
    y += 10
    
    # === SOLID LINE SEPARATOR ===
    draw.line([(margin, y), (width - margin, y)], fill='#cccccc', width=1)
    y += 20
    
    # === PLAYS IN CARD GRID FORMAT (2 per row) ===
    all_plays = []
    for lottery_name, lottery_plays in plays_by_lottery.items():
        for play in lottery_plays:
            all_plays.append((lottery_name, play))
    
    card_width = (width - margin * 2 - 15) // 2  # 2 cards per row with 15px gap
    card_x_start = margin
    
    for i, (lottery_name, play) in enumerate(all_plays):
        col = i % 2
        row = i // 2
        
        if col == 0 and i > 0:
            y += card_height + 15
        
        card_x = card_x_start + col * (card_width + 15)
        card_y = y if col == 0 or i == 0 else y
        
        # Draw card background with light gray border
        draw.rectangle(
            [(card_x, card_y), (card_x + card_width, card_y + card_height)],
            fill='#f8f9fa',
            outline='#e0e0e0',
            width=1
        )
        
        # Lottery name (inside card, top left)
        lottery_short = (lottery_name or "Lotería")[:18]
        draw.text((card_x + 8, card_y + 6), lottery_short, fill='#666666', font=font_lottery_name)
        
        # Play type badge (top right corner of card) - blue background
        play_type = play.get("lottery_type", "quiniela")
        abbr = PLAY_TYPE_ABBR.get(play_type, play_type[:1].upper())
        badge_x = card_x + card_width - 28
        badge_y = card_y + 5
        draw.rectangle([(badge_x, badge_y), (badge_x + 22, badge_y + 18)], fill='#3949ab')
        bbox = draw.textbbox((0, 0), abbr, font=font_type_badge)
        abbr_w = bbox[2] - bbox[0]
        draw.text((badge_x + (22 - abbr_w) // 2, badge_y + 2), abbr, fill='white', font=font_type_badge)
        
        # Numbers (bold, larger, below lottery name)
        numbers = play.get("numbers", [])
        if isinstance(numbers, list):
            numbers_str = "-".join(str(n).zfill(2) for n in numbers)
        else:
            numbers_str = str(numbers)
        draw.text((card_x + 8, card_y + 26), numbers_str, fill='#1a1a2e', font=font_numbers)
        
        # Amount (right side of card, below badge)
        amount = play.get("amount", 0)
        amount_text = f"{currency_display} {int(amount)}"
        bbox = draw.textbbox((0, 0), amount_text, font=font_amount)
        amount_w = bbox[2] - bbox[0]
        draw.text((card_x + card_width - amount_w - 8, card_y + 45), amount_text, fill='#666666', font=font_amount)
    
    # Move y to after the last row of cards
    total_rows = (len(all_plays) + 1) // 2
    if len(all_plays) > 0:
        y += card_height + 25
    else:
        y += 10
    
    # === TOTAL SECTION ===
    total = ticket.get("total_amount", 0)
    total_label = f"TOTAL ({len(all_plays)} jugadas)"
    total_amount_text = f"{currency_display} {total:.2f}"
    
    # Total label (left)
    draw.text((margin, y), total_label, fill='#1a1a2e', font=font_total_label)
    
    # Total amount (right, bold, blue)
    bbox = draw.textbbox((0, 0), total_amount_text, font=font_total_amount)
    amount_w = bbox[2] - bbox[0]
    draw.text((width - margin - amount_w, y - 3), total_amount_text, fill='#3949ab', font=font_total_amount)
    y += 50
    
    # === QR CODE (centered) ===
    qr = qrcode.QRCode(version=1, box_size=5, border=2)
    qr.add_data(ticket_number)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    qr_w, qr_h = qr_img.size
    qr_x = (width - qr_w) // 2
    img.paste(qr_img, (qr_x, y))
    y += qr_h + 30
    
    # === FOOTER (centered, bold) ===
    footer1 = "CONSERVE ESTE BOLETO"
    footer2 = "¡BUENA SUERTE!"
    
    bbox = draw.textbbox((0, 0), footer1, font=font_footer)
    text_w = bbox[2] - bbox[0]
    draw.text(((width - text_w) // 2, y), footer1, fill='#3949ab', font=font_footer)
    y += 22
    
    bbox = draw.textbbox((0, 0), footer2, font=font_footer)
    text_w = bbox[2] - bbox[0]
    draw.text(((width - text_w) // 2, y), footer2, fill='#3949ab', font=font_footer)
    y += 25
    
    # Crop to actual content
    img = img.crop((0, 0, width, y + 10))
    
    # Return as PNG
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": f"inline; filename=ticket-{ticket_number}.png",
            "Cache-Control": "no-cache"
        }
    )


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific ticket"""
    db = get_db()
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    return serialize_doc(ticket)


@router.post("/{ticket_id}/cancel")
async def cancel_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a ticket"""
    db = get_db()
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    if ticket["status"] != TicketStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar boletos pendientes")
    
    is_super_admin = current_user["role"] == UserRole.SUPER_ADMIN.value
    
    if not is_super_admin:
        time_diff = datetime.utcnow() - ticket["created_at"]
        if time_diff.total_seconds() > 300:
            raise HTTPException(status_code=400, detail="Tiempo de cancelación expirado (máximo 5 minutos)")
        
        if current_user["role"] == UserRole.VENDEDOR.value and ticket["seller_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="No puedes cancelar este boleto")
        
        if current_user["role"] == UserRole.ADMIN.value:
            seller = await db.users.find_one({"id": ticket["seller_id"]})
            if seller and seller.get("created_by") != current_user["id"] and ticket["seller_id"] != current_user["id"]:
                raise HTTPException(status_code=403, detail="No puedes cancelar boletos de vendedores que no creaste")
    
    cancelled_by = current_user["id"] if is_super_admin else None
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "status": TicketStatus.CANCELLED.value, 
            "cancelled_at": datetime.utcnow(),
            "cancelled_by": cancelled_by,
            "cancelled_by_name": current_user["name"] if is_super_admin else None
        }}
    )
    
    seller = await db.users.find_one({"id": ticket["seller_id"]})
    commission_rate = seller.get("commission_rate", 10.0)
    ticket_amount = ticket.get("amount") or ticket.get("total_amount", 0)
    commission = ticket_amount * (commission_rate / 100)
    
    await db.users.update_one(
        {"id": ticket["seller_id"]},
        {"$inc": {"total_sales": -ticket_amount, "total_commission": -commission, "balance": -commission}}
    )
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": ticket["seller_id"],
        "user_name": ticket["seller_name"],
        "transaction_type": TransactionType.CANCELLATION.value,
        "amount": -ticket_amount,
        "currency": ticket["currency"],
        "description": f"Cancelación de boleto {ticket['ticket_number']}" + (f" por {current_user['name']}" if is_super_admin else ""),
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Boleto cancelado", "ticket_number": ticket["ticket_number"], "cancelled_by": current_user["name"] if is_super_admin else None}


@router.post("/{ticket_id}/pay")
async def pay_winning_ticket(ticket_id: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDEDOR]))):
    """Pay a winning ticket"""
    db = get_db()
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    
    if ticket["status"] != TicketStatus.WON.value:
        raise HTTPException(status_code=400, detail="Este boleto no es ganador o ya fue pagado")
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": TicketStatus.PAID.value, "paid_at": datetime.utcnow()}}
    )
    
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "transaction_type": TransactionType.PAYMENT.value,
        "amount": ticket["potential_win"],
        "currency": ticket["currency"],
        "description": f"Pago de premio {ticket['ticket_number']} - {ticket['lottery_name']}",
        "reference_id": ticket_id,
        "created_at": datetime.utcnow()
    })
    
    return {
        "message": "Premio pagado",
        "ticket_number": ticket["ticket_number"],
        "amount_paid": ticket["potential_win"],
        "currency": ticket["currency"]
    }
