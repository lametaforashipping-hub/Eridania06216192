"""Payment management routes for Admin"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from models.enums import UserRole, TicketStatus, PaymentStatus
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import require_role

router = APIRouter(prefix="/payments", tags=["Payments"])


class PaymentConfigUpdate(BaseModel):
    zelle: Optional[dict] = None
    bank_accounts: Optional[list] = None


class PaymentAction(BaseModel):
    action: str  # "approve" or "reject"
    notes: Optional[str] = None


@router.get("/config")
async def get_payment_config(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get payment configuration (Zelle, bank accounts)"""
    db = get_db()
    config = await db.payment_config.find_one({}, {"_id": 0})
    
    if not config:
        return {
            "zelle": {
                "enabled": False,
                "phone": "",
                "email": "",
                "name": ""
            },
            "bank_accounts": []
        }
    
    return config


@router.put("/config")
async def update_payment_config(
    data: PaymentConfigUpdate,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Update payment configuration"""
    db = get_db()
    
    update_data = {"updated_at": datetime.utcnow(), "updated_by": current_user["id"]}
    
    if data.zelle is not None:
        update_data["zelle"] = data.zelle
    if data.bank_accounts is not None:
        update_data["bank_accounts"] = data.bank_accounts
    
    await db.payment_config.update_one(
        {},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Configuración actualizada"}


@router.get("/pending")
async def get_pending_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get pending client payments"""
    db = get_db()
    
    query = {"status": PaymentStatus.PENDING.value}
    
    total = await db.client_payments.count_documents(query)
    skip = (page - 1) * limit
    
    payments = await db.client_payments.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with ticket info
    for payment in payments:
        ticket = await db.tickets.find_one({"id": payment.get("ticket_id")}, {"_id": 0})
        if ticket:
            payment["ticket"] = ticket
    
    return {
        "payments": serialize_doc(payments),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/pending-count")
async def get_pending_payments_count(
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get count of pending payments"""
    db = get_db()
    count = await db.client_payments.count_documents({"status": PaymentStatus.PENDING.value})
    return {"count": count}


@router.post("/{payment_id}/action")
async def process_payment(
    payment_id: str,
    data: PaymentAction,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Approve or reject a client payment"""
    db = get_db()
    
    # Find payment
    payment = await db.client_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    if payment.get("status") != PaymentStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Este pago ya fue procesado")
    
    now = datetime.utcnow()
    
    if data.action == "approve":
        # Update payment
        await db.client_payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": PaymentStatus.CONFIRMED.value,
                "processed_at": now,
                "processed_by": current_user["id"],
                "processed_by_name": current_user.get("name", "Admin"),
                "notes": data.notes
            }}
        )
        
        # Update ticket to PENDING (valid for lottery)
        ticket = await db.tickets.find_one({"id": payment["ticket_id"]})
        if ticket:
            await db.tickets.update_one(
                {"id": payment["ticket_id"]},
                {"$set": {
                    "status": TicketStatus.PENDING.value,
                    "payment_status": PaymentStatus.CONFIRMED.value,
                    "payment_confirmed_at": now,
                    "payment_confirmed_by": current_user["id"]
                }}
            )
            
            # Update client stats
            await db.users.update_one(
                {"id": ticket["client_id"]},
                {"$inc": {"total_plays": 1}}
            )
        
        # TODO: Send notification to client
        
        return {
            "message": "Pago aprobado. La jugada es ahora válida.",
            "status": PaymentStatus.CONFIRMED.value
        }
    
    elif data.action == "reject":
        # Update payment
        await db.client_payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": PaymentStatus.REJECTED.value,
                "processed_at": now,
                "processed_by": current_user["id"],
                "processed_by_name": current_user.get("name", "Admin"),
                "notes": data.notes
            }}
        )
        
        # Cancel ticket
        await db.tickets.update_one(
            {"id": payment["ticket_id"]},
            {"$set": {
                "status": TicketStatus.CANCELLED.value,
                "payment_status": PaymentStatus.REJECTED.value,
                "cancelled_at": now,
                "cancelled_by": current_user["id"],
                "cancellation_reason": data.notes or "Pago rechazado"
            }}
        )
        
        # TODO: Send notification to client
        
        return {
            "message": "Pago rechazado. La jugada ha sido cancelada.",
            "status": PaymentStatus.REJECTED.value
        }
    
    else:
        raise HTTPException(status_code=400, detail="Acción inválida. Use 'approve' o 'reject'")


@router.get("/history")
async def get_payment_history(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get all client payments history"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    total = await db.client_payments.count_documents(query)
    skip = (page - 1) * limit
    
    payments = await db.client_payments.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "payments": serialize_doc(payments),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }
