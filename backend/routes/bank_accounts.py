"""Bank Accounts and Deposit Management Routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from typing import Optional, List
from pydantic import BaseModel
from models.enums import UserRole, Currency
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts"])


# ==================== SCHEMAS ====================
class BankAccountCreate(BaseModel):
    name: str  # Ej: "Cuenta Principal RD", "Cuenta Zelle USA"
    account_type: str  # "bank", "zelle", "cash"
    currency: Currency
    country: str  # "RD" or "USA"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None  # Puede ser parcial por seguridad
    zelle_email: Optional[str] = None
    zelle_phone: Optional[str] = None
    initial_balance: float = 0.0
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    zelle_email: Optional[str] = None
    zelle_phone: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class DepositRequest(BaseModel):
    bank_account_id: str
    amount: float
    deposit_method: str  # "transfer", "zelle", "cash"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class DepositApproval(BaseModel):
    approved: bool
    admin_notes: Optional[str] = None


class ManualBalanceAdjustment(BaseModel):
    amount: float  # Positivo para agregar, negativo para restar
    reason: str


# ==================== BANK ACCOUNTS ====================
@router.get("")
async def get_bank_accounts(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Get all bank accounts - Admin sees all, others see active only"""
    db = get_db()
    
    query = {}
    if current_user["role"] != UserRole.SUPER_ADMIN.value:
        query["active"] = True
    
    accounts = await db.bank_accounts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return accounts


@router.get("/public")
async def get_public_bank_accounts(current_user: dict = Depends(get_current_user)):
    """Get bank accounts info for vendors to know where to deposit"""
    db = get_db()
    
    # Filter by vendor's country
    country = current_user.get("country", "RD")
    
    accounts = await db.bank_accounts.find(
        {"active": True, "country": country},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "account_type": 1,
            "currency": 1,
            "bank_name": 1,
            "account_number": 1,
            "zelle_email": 1,
            "zelle_phone": 1,
            "notes": 1
        }
    ).to_list(100)
    
    return accounts


@router.post("")
async def create_bank_account(account: BankAccountCreate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Create a new bank account - Super Admin only"""
    db = get_db()
    
    account_doc = {
        "id": str(uuid.uuid4()),
        "name": account.name,
        "account_type": account.account_type,
        "currency": account.currency.value,
        "country": account.country,
        "bank_name": account.bank_name,
        "account_number": account.account_number,
        "zelle_email": account.zelle_email,
        "zelle_phone": account.zelle_phone,
        "balance": account.initial_balance,
        "notes": account.notes,
        "active": True,
        "created_by": current_user["id"],
        "created_at": datetime.utcnow()
    }
    
    await db.bank_accounts.insert_one(account_doc)
    
    # Log the transaction if initial balance > 0
    if account.initial_balance > 0:
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "bank_account_id": account_doc["id"],
            "type": "initial_balance",
            "amount": account.initial_balance,
            "balance_after": account.initial_balance,
            "description": "Balance inicial",
            "created_by": current_user["id"],
            "created_at": datetime.utcnow()
        }
        await db.bank_transactions.insert_one(transaction_doc)
    
    return {"message": "Cuenta bancaria creada exitosamente", "account_id": account_doc["id"]}


@router.put("/{account_id}")
async def update_bank_account(account_id: str, update: BankAccountUpdate, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Update bank account - Super Admin only"""
    db = get_db()
    
    account = await db.bank_accounts.find_one({"id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        await db.bank_accounts.update_one({"id": account_id}, {"$set": update_data})
    
    return {"message": "Cuenta actualizada"}


@router.post("/{account_id}/adjust-balance")
async def adjust_bank_balance(account_id: str, adjustment: ManualBalanceAdjustment, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Manually adjust bank account balance - Super Admin only"""
    db = get_db()
    
    account = await db.bank_accounts.find_one({"id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    
    new_balance = account["balance"] + adjustment.amount
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="El balance no puede ser negativo")
    
    await db.bank_accounts.update_one(
        {"id": account_id},
        {"$set": {"balance": new_balance}}
    )
    
    # Log transaction
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "bank_account_id": account_id,
        "type": "manual_adjustment",
        "amount": adjustment.amount,
        "balance_after": new_balance,
        "description": adjustment.reason,
        "created_by": current_user["id"],
        "created_at": datetime.utcnow()
    }
    await db.bank_transactions.insert_one(transaction_doc)
    
    return {"message": "Balance ajustado", "new_balance": new_balance}


@router.get("/{account_id}/transactions")
async def get_account_transactions(account_id: str, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Get transaction history for a bank account"""
    db = get_db()
    
    transactions = await db.bank_transactions.find(
        {"bank_account_id": account_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return transactions


# ==================== DEPOSITS ====================
@router.post("/deposit-request")
async def create_deposit_request(deposit: DepositRequest, current_user: dict = Depends(get_current_user)):
    """Vendor creates a deposit request for approval"""
    db = get_db()
    
    # Verify bank account exists
    bank_account = await db.bank_accounts.find_one({"id": deposit.bank_account_id, "active": True})
    if not bank_account:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    
    deposit_doc = {
        "id": str(uuid.uuid4()),
        "bank_account_id": deposit.bank_account_id,
        "bank_account_name": bank_account["name"],
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "user_email": current_user.get("email", ""),
        "amount": deposit.amount,
        "currency": bank_account["currency"],
        "deposit_method": deposit.deposit_method,
        "reference_number": deposit.reference_number,
        "notes": deposit.notes,
        "status": "pending",  # pending, approved, rejected
        "created_at": datetime.utcnow(),
        "processed_at": None,
        "processed_by": None,
        "admin_notes": None
    }
    
    await db.deposit_requests.insert_one(deposit_doc)
    
    # Notify super admins
    super_admins = await db.users.find({"role": "super_admin", "active": True}).to_list(100)
    for admin in super_admins:
        notification_doc = {
            "id": str(uuid.uuid4()),
            "user_id": admin["id"],
            "title": "💰 Nueva Solicitud de Depósito",
            "message": f"{current_user['name']} solicita depósito de {bank_account['currency']} {deposit.amount:,.2f}",
            "type": "deposit_request",
            "reference_id": deposit_doc["id"],
            "read": False,
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification_doc)
    
    return {"message": "Solicitud de depósito enviada. Pendiente de aprobación.", "deposit_id": deposit_doc["id"]}


@router.get("/deposit-requests")
async def get_deposit_requests(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get deposit requests - Admins see all, vendors see their own"""
    db = get_db()
    
    query = {}
    if current_user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        query["user_id"] = current_user["id"]
    
    if status:
        query["status"] = status
    
    deposits = await db.deposit_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return deposits


@router.get("/deposit-requests/pending-count")
async def get_pending_deposits_count(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))):
    """Get count of pending deposit requests"""
    db = get_db()
    count = await db.deposit_requests.count_documents({"status": "pending"})
    return {"count": count}


@router.put("/deposit-requests/{deposit_id}")
async def process_deposit_request(deposit_id: str, approval: DepositApproval, current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Approve or reject a deposit request - Super Admin only"""
    db = get_db()
    
    deposit = await db.deposit_requests.find_one({"id": deposit_id})
    if not deposit:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Esta solicitud ya fue procesada")
    
    new_status = "approved" if approval.approved else "rejected"
    
    await db.deposit_requests.update_one(
        {"id": deposit_id},
        {
            "$set": {
                "status": new_status,
                "processed_at": datetime.utcnow(),
                "processed_by": current_user["id"],
                "admin_notes": approval.admin_notes
            }
        }
    )
    
    if approval.approved:
        # Add balance to vendor
        await db.users.update_one(
            {"id": deposit["user_id"]},
            {"$inc": {"balance": deposit["amount"]}}
        )
        
        # Add balance to bank account
        bank_account = await db.bank_accounts.find_one({"id": deposit["bank_account_id"]})
        new_bank_balance = bank_account["balance"] + deposit["amount"]
        await db.bank_accounts.update_one(
            {"id": deposit["bank_account_id"]},
            {"$set": {"balance": new_bank_balance}}
        )
        
        # Log bank transaction
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "bank_account_id": deposit["bank_account_id"],
            "type": "deposit",
            "amount": deposit["amount"],
            "balance_after": new_bank_balance,
            "description": f"Depósito de {deposit['user_name']} - {deposit['deposit_method']}",
            "reference_id": deposit_id,
            "user_id": deposit["user_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow()
        }
        await db.bank_transactions.insert_one(transaction_doc)
        
        # Re-activate vendor if they were blocked due to zero balance
        vendor = await db.users.find_one({"id": deposit["user_id"]})
        if vendor and not vendor.get("active", True) and vendor.get("blocked_reason") == "zero_balance":
            await db.users.update_one(
                {"id": deposit["user_id"]},
                {"$set": {"active": True}, "$unset": {"blocked_reason": ""}}
            )
    
    # Notify vendor
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": deposit["user_id"],
        "title": "✅ Depósito Aprobado" if approval.approved else "❌ Depósito Rechazado",
        "message": f"Tu depósito de {deposit['currency']} {deposit['amount']:,.2f} fue {'aprobado' if approval.approved else 'rechazado'}." + (f" Nota: {approval.admin_notes}" if approval.admin_notes else ""),
        "type": "deposit_processed",
        "reference_id": deposit_id,
        "read": False,
        "created_at": datetime.utcnow()
    }
    await db.notifications.insert_one(notification_doc)
    
    return {"message": f"Depósito {'aprobado' if approval.approved else 'rechazado'}"}


# ==================== SUMMARY ====================
@router.get("/summary")
async def get_bank_summary(current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN]))):
    """Get summary of all bank accounts and pending deposits"""
    db = get_db()
    
    accounts = await db.bank_accounts.find({"active": True}, {"_id": 0}).to_list(100)
    
    total_rd = sum(a["balance"] for a in accounts if a["currency"] == "RD$")
    total_usd = sum(a["balance"] for a in accounts if a["currency"] == "USD")
    
    pending_deposits = await db.deposit_requests.count_documents({"status": "pending"})
    
    pending_amount_rd = await db.deposit_requests.aggregate([
        {"$match": {"status": "pending", "currency": "RD$"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    pending_amount_usd = await db.deposit_requests.aggregate([
        {"$match": {"status": "pending", "currency": "USD"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    return {
        "accounts": accounts,
        "totals": {
            "RD$": total_rd,
            "USD": total_usd
        },
        "pending_deposits": {
            "count": pending_deposits,
            "amount_rd": pending_amount_rd[0]["total"] if pending_amount_rd else 0,
            "amount_usd": pending_amount_usd[0]["total"] if pending_amount_usd else 0
        }
    }
