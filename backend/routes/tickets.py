"""Ticket sales routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
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
        
        multiplier = lottery.get("prize_multiplier", 70)
        if play.position and lottery.get("prize_rules"):
            for rule in lottery["prize_rules"]:
                if rule.get("position") == play.position:
                    multiplier = rule.get("multiplier", multiplier)
                    break
        
        potential_win = play.amount * multiplier
        
        plays_data.append({
            "lottery_type": play.lottery_type,
            "lottery_name": lottery["name"],
            "lottery_id": lottery["id"],
            "numbers": play.numbers,
            "amount": play.amount,
            "position": play.position,
            "potential_win": potential_win,
            "multiplier": multiplier
        })
        
        total_amount += play.amount
        total_potential_win += potential_win
    
    # Check credit limit
    if effective_user["role"] == UserRole.VENDEDOR.value:
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
    
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "ticket_number": generate_ticket_number(),
        "ticket_type": "multi_play",
        "seller_id": effective_user["id"],
        "seller_name": effective_user["name"],
        "plays": plays_data,
        "plays_count": len(plays_data),
        "total_amount": total_amount,
        "total_potential_win": total_potential_win,
        "currency": ticket_data.currency.value,
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
    current_user: dict = Depends(get_current_user)
):
    """Get tickets with filters"""
    db = get_db()
    query = {}
    
    user_country = current_user.get("country", "RD")
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        if country:
            country_lotteries = await db.lotteries.find({"country": country}).to_list(1000)
            lottery_ids = [l["id"] for l in country_lotteries]
            if lottery_ids:
                query["lottery_id"] = {"$in": lottery_ids}
    else:
        country_lotteries = await db.lotteries.find({"country": user_country}).to_list(1000)
        lottery_ids = [l["id"] for l in country_lotteries]
        if lottery_ids:
            query["lottery_id"] = {"$in": lottery_ids}
    
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
    if lottery_id:
        query["lottery_id"] = lottery_id
    
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(tickets)


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
