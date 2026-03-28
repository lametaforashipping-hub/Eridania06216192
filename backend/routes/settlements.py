"""Settlement/Cuadre routes - Sistema de cobro y liquidación de vendedores"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import uuid

from models.enums import UserRole, TicketStatus, TransactionType
from utils.database import get_db
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/settlements", tags=["Settlements"])


class CloseSettlementRequest(BaseModel):
    seller_id: str
    amount_paid: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = ""


class RegisterPaymentRequest(BaseModel):
    seller_id: str
    amount: float
    notes: Optional[str] = ""


async def calculate_seller_cuadre(db, seller_id: str, start: datetime, end: datetime):
    """
    Calculate the cuadre (settlement) for a seller in a date range.
    Formula: Ganancia Neta = Ventas - Comisión - Premios
    """
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
    if not seller:
        return None

    # Get tickets in period
    ticket_query = {
        "seller_id": seller_id,
        "created_at": {"$gte": start, "$lte": end}
    }
    tickets = await db.tickets.find(ticket_query, {"_id": 0}).to_list(50000)

    total_sales = 0
    total_wins = 0
    tickets_sold = 0
    tickets_won = 0
    winning_tickets = []

    for t in tickets:
        status = t.get("status", "pending")
        if status == TicketStatus.CANCELLED.value:
            continue

        amount = t.get("amount") or t.get("total_amount", 0)
        total_sales += amount
        tickets_sold += 1

        if status in [TicketStatus.WON.value, TicketStatus.PAID.value]:
            prize = t.get("potential_win") or t.get("total_potential_win", 0)
            total_wins += prize
            tickets_won += 1
            winning_tickets.append({
                "ticket_number": t.get("ticket_number"),
                "amount": amount,
                "prize": prize,
                "won_position": t.get("won_position"),
                "won_number": t.get("won_number"),
                "status": status,
                "created_at": t.get("created_at").isoformat() if t.get("created_at") else ""
            })

    commission_rate = seller.get("commission_rate", 0)
    total_commission = total_sales * (commission_rate / 100)
    net_profit = total_sales - total_commission - total_wins

    return {
        "seller_id": seller_id,
        "seller_name": seller.get("name", ""),
        "commission_rate": commission_rate,
        "currency": seller.get("currency", "RD$"),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "total_sales": round(total_sales, 2),
        "total_commission": round(total_commission, 2),
        "total_wins": round(total_wins, 2),
        "net_profit": round(net_profit, 2),
        "tickets_sold": tickets_sold,
        "tickets_won": tickets_won,
        "winning_tickets": winning_tickets
    }


@router.get("/cuadre/{seller_id}")
async def get_seller_cuadre(
    seller_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """
    Get the cuadre (settlement summary) for a seller with date range filter.
    
    Returns:
    - Venta Total
    - Comisión (always deducted)
    - Premios pagados
    - Ganancia Neta = Ventas - Comisión - Premios
    - Balance actual (running balance from previous settlements)
    """
    db = get_db()

    # Verify admin can only see their own sellers
    if current_user["role"] == UserRole.ADMIN.value:
        seller = await db.users.find_one({"id": seller_id, "created_by": current_user["id"]})
        if not seller:
            raise HTTPException(status_code=403, detail="No tienes acceso a este vendedor")

    # Parse dates
    if start_date:
        start = datetime.fromisoformat(start_date)
    else:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    if end_date:
        end = datetime.fromisoformat(end_date)
    else:
        end = datetime.utcnow()

    cuadre = await calculate_seller_cuadre(db, seller_id, start, end)
    if not cuadre:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")

    # Get running balance from previous settlements
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "balance": 1})
    running_balance = seller.get("balance", 0) if seller else 0

    # Get settlement history for context
    last_settlement = await db.settlements.find_one(
        {"seller_id": seller_id},
        sort=[("created_at", -1)]
    )
    last_settlement_date = None
    if last_settlement:
        last_settlement_date = last_settlement.get("created_at").isoformat() if last_settlement.get("created_at") else None

    cuadre["running_balance"] = round(running_balance, 2)
    cuadre["total_due"] = round(cuadre["net_profit"] + running_balance, 2)
    cuadre["last_settlement_date"] = last_settlement_date

    return cuadre


@router.post("/close")
async def close_settlement(
    data: CloseSettlementRequest,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """
    Close a settlement (cuadre) with a seller.
    Records the payment and updates the running balance.
    
    - If seller pays full amount: balance = 0
    - If seller pays partial: remaining added to running balance
    - If prize was larger than sales (seller is owed): balance adjusted accordingly
    """
    db = get_db()

    # Verify admin can only close their own sellers
    if current_user["role"] == UserRole.ADMIN.value:
        seller = await db.users.find_one({"id": data.seller_id, "created_by": current_user["id"]})
        if not seller:
            raise HTTPException(status_code=403, detail="No tienes acceso a este vendedor")
    else:
        seller = await db.users.find_one({"id": data.seller_id})
        if not seller:
            raise HTTPException(status_code=404, detail="Vendedor no encontrado")

    # Parse dates
    if data.start_date:
        start = datetime.fromisoformat(data.start_date)
    else:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    if data.end_date:
        end = datetime.fromisoformat(data.end_date)
    else:
        end = datetime.utcnow()

    # Calculate what's owed
    cuadre = await calculate_seller_cuadre(db, data.seller_id, start, end)
    if not cuadre:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")

    previous_balance = seller.get("balance", 0)
    amount_due = cuadre["net_profit"] + previous_balance

    # If net_profit is negative (prizes > sales - commission), the banca owes the seller
    # In that case amount_due could be negative, meaning the banca must pay
    # After paying, balance resets

    balance_after = round(amount_due - data.amount_paid, 2)

    # Create settlement record
    settlement = {
        "id": str(uuid.uuid4()),
        "seller_id": data.seller_id,
        "seller_name": seller.get("name", ""),
        "closed_by_id": current_user["id"],
        "closed_by_name": current_user.get("name", ""),
        "closed_by_role": current_user["role"],
        "period_start": start,
        "period_end": end,
        "total_sales": cuadre["total_sales"],
        "total_commission": cuadre["total_commission"],
        "total_wins": cuadre["total_wins"],
        "net_profit": cuadre["net_profit"],
        "previous_balance": round(previous_balance, 2),
        "amount_due": round(amount_due, 2),
        "amount_paid": round(data.amount_paid, 2),
        "balance_after": balance_after,
        "notes": data.notes or "",
        "currency": seller.get("currency", "RD$"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.settlements.insert_one(settlement)

    # Update seller's running balance
    await db.users.update_one(
        {"id": data.seller_id},
        {"$set": {"balance": balance_after}}
    )

    # Record the payment transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.seller_id,
        "user_name": seller.get("name", ""),
        "transaction_type": TransactionType.PAYMENT.value,
        "amount": data.amount_paid,
        "currency": seller.get("currency", "RD$"),
        "description": f"Cuadre cerrado - Pagó {seller.get('currency', 'RD$')} {data.amount_paid:,.2f} de {seller.get('currency', 'RD$')} {amount_due:,.2f} debido. Balance: {seller.get('currency', 'RD$')} {balance_after:,.2f}",
        "reference_id": settlement["id"],
        "created_at": datetime.now(timezone.utc)
    })

    # Remove _id before returning
    settlement.pop("_id", None)
    settlement["period_start"] = settlement["period_start"].isoformat()
    settlement["period_end"] = settlement["period_end"].isoformat()
    settlement["created_at"] = settlement["created_at"].isoformat()

    return {
        "message": "Cuadre cerrado exitosamente",
        "settlement": settlement
    }


@router.post("/payment")
async def register_payment(
    data: RegisterPaymentRequest,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """
    Register a quick payment from a seller (without closing a full cuadre).
    Reduces the seller's running balance.
    """
    db = get_db()

    # Verify admin can only manage their own sellers
    if current_user["role"] == UserRole.ADMIN.value:
        seller = await db.users.find_one({"id": data.seller_id, "created_by": current_user["id"]})
        if not seller:
            raise HTTPException(status_code=403, detail="No tienes acceso a este vendedor")
    else:
        seller = await db.users.find_one({"id": data.seller_id})
        if not seller:
            raise HTTPException(status_code=404, detail="Vendedor no encontrado")

    current_balance = seller.get("balance", 0)
    new_balance = round(current_balance - data.amount, 2)

    # Update balance
    await db.users.update_one(
        {"id": data.seller_id},
        {"$set": {"balance": new_balance}}
    )

    # Record transaction
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.seller_id,
        "user_name": seller.get("name", ""),
        "transaction_type": TransactionType.PAYMENT.value,
        "amount": data.amount,
        "currency": seller.get("currency", "RD$"),
        "description": f"Pago recibido - {seller.get('currency', 'RD$')} {data.amount:,.2f}. Balance anterior: {seller.get('currency', 'RD$')} {current_balance:,.2f} → Nuevo: {seller.get('currency', 'RD$')} {new_balance:,.2f}",
        "reference_id": f"payment-{data.seller_id}",
        "created_at": datetime.now(timezone.utc),
        "notes": data.notes or ""
    })

    return {
        "message": "Pago registrado",
        "previous_balance": round(current_balance, 2),
        "amount_paid": round(data.amount, 2),
        "new_balance": new_balance,
        "currency": seller.get("currency", "RD$")
    }


@router.get("/history/{seller_id}")
async def get_settlement_history(
    seller_id: str,
    limit: int = 50,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get settlement history for a seller"""
    db = get_db()

    # Verify admin can only see their own sellers
    if current_user["role"] == UserRole.ADMIN.value:
        seller = await db.users.find_one({"id": seller_id, "created_by": current_user["id"]})
        if not seller:
            raise HTTPException(status_code=403, detail="No tienes acceso a este vendedor")

    settlements = await db.settlements.find(
        {"seller_id": seller_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    # Serialize dates
    for s in settlements:
        for field in ["period_start", "period_end", "created_at"]:
            if s.get(field) and hasattr(s[field], "isoformat"):
                s[field] = s[field].isoformat()

    # Get current balance
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "balance": 1, "name": 1, "currency": 1})

    return {
        "seller_id": seller_id,
        "seller_name": seller.get("name", "") if seller else "",
        "current_balance": round(seller.get("balance", 0), 2) if seller else 0,
        "currency": seller.get("currency", "RD$") if seller else "RD$",
        "settlements": settlements,
        "total_settlements": len(settlements)
    }


@router.get("/all-balances")
async def get_all_seller_balances(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get all sellers with their current balance (for admin overview)"""
    db = get_db()

    seller_query = {"role": UserRole.VENDEDOR.value}
    if current_user["role"] == UserRole.ADMIN.value:
        seller_query["created_by"] = current_user["id"]

    sellers = await db.users.find(
        seller_query,
        {"_id": 0, "id": 1, "name": 1, "balance": 1, "currency": 1, "commission_rate": 1, "is_active": 1}
    ).to_list(1000)

    result = []
    for s in sellers:
        result.append({
            "seller_id": s["id"],
            "seller_name": s.get("name", ""),
            "balance": round(s.get("balance", 0), 2),
            "commission_rate": s.get("commission_rate", 0),
            "currency": s.get("currency", "RD$"),
            "is_active": s.get("is_active", True)
        })

    result.sort(key=lambda x: x["balance"], reverse=True)

    return {
        "sellers": result,
        "total_balance": round(sum(s["balance"] for s in result), 2),
        "currency": current_user.get("currency", "RD$")
    }
