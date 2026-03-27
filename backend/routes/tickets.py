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
    
    # Fonts - ALL BOLD, bigger for better readability
    BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
    try:
        font_company = ImageFont.truetype(BOLD, 26)
        font_address = ImageFont.truetype(BOLD, 15)
        font_label = ImageFont.truetype(BOLD, 15)
        font_ticket_num = ImageFont.truetype(BOLD, 22)
        font_date = ImageFont.truetype(BOLD, 15)
        font_play_row = ImageFont.truetype(BOLD, 14)
        font_total_label = ImageFont.truetype(BOLD, 17)
        font_total_amount = ImageFont.truetype(BOLD, 24)
        font_footer = ImageFont.truetype(BOLD, 15)
    except Exception:
        font_company = ImageFont.load_default()
        font_address = font_company
        font_label = font_company
        font_ticket_num = font_company
        font_date = font_company
        font_play_row = font_company
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
    
    # Calculate height - compact list (one row per play)
    total_plays = len(plays)
    row_height = 24
    estimated_height = 120 + 120 + 100 + (total_plays * row_height) + 40 + 80 + 180 + 100
    
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
    
    # === PLAYS AS COMPACT LIST (one line per play) ===
    # Header row
    draw.text((margin, y), "LOTERÍA", fill='#3949ab', font=font_play_row)
    draw.text((margin + 190, y), "NÚM.", fill='#3949ab', font=font_play_row)
    amount_header = "MONTO"
    bbox = draw.textbbox((0, 0), amount_header, font=font_play_row)
    draw.text((width - margin - (bbox[2] - bbox[0]), y), amount_header, fill='#3949ab', font=font_play_row)
    y += 20
    draw.line([(margin, y), (width - margin, y)], fill='#cccccc', width=1)
    y += 8
    
    all_plays = []
    for lottery_name, lottery_plays in plays_by_lottery.items():
        for play in lottery_plays:
            all_plays.append((lottery_name, play))
    
    for i, (lottery_name, play) in enumerate(all_plays):
        # Alternate row background
        if i % 2 == 0:
            draw.rectangle([(margin - 5, y - 2), (width - margin + 5, y + row_height - 4)], fill='#f5f5f5')
        
        # Play type abbreviation + Lottery name
        play_type = play.get("lottery_type", "quiniela")
        abbr = PLAY_TYPE_ABBR.get(play_type, play_type[:1].upper())
        lottery_short = (lottery_name or "Lotería")[:20]
        play_label = f"[{abbr}] {lottery_short}"
        draw.text((margin, y), play_label, fill='#1a1a2e', font=font_play_row)
        
        # Numbers
        numbers = play.get("numbers", [])
        if isinstance(numbers, list):
            numbers_str = "-".join(str(n).zfill(2) for n in numbers)
        else:
            numbers_str = str(numbers)
        draw.text((margin + 190, y), numbers_str, fill='#1a1a2e', font=font_play_row)
        
        # Amount (right-aligned)
        amount = play.get("amount", 0)
        amount_text = f"{currency_display} {int(amount)}"
        bbox = draw.textbbox((0, 0), amount_text, font=font_play_row)
        amount_w = bbox[2] - bbox[0]
        draw.text((width - margin - amount_w, y), amount_text, fill='#1a1a2e', font=font_play_row)
        
        y += row_height
    
    if len(all_plays) > 0:
        y += 15
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
