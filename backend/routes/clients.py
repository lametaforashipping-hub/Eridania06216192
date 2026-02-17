"""Client routes - Public registration and client-specific endpoints"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from datetime import datetime, timedelta
import uuid
import os
import shutil
from typing import Optional
from pydantic import BaseModel, EmailStr
from models.enums import UserRole, Currency, TicketStatus, PaymentMethod, PaymentStatus
from utils.database import get_db
from utils.helpers import hash_password, verify_password, create_token, serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/clients", tags=["Clients"])

# Directory for payment receipts
RECEIPTS_DIR = "/app/frontend/public/receipts"
os.makedirs(RECEIPTS_DIR, exist_ok=True)


class ClientRegister(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: str
    password: str
    country: str = "RD"


class ClientTicketCreate(BaseModel):
    plays: list  # List of plays similar to multi-play
    payment_method: PaymentMethod
    bank_account_id: Optional[str] = None  # ID de la cuenta bancaria seleccionada


@router.post("/register")
async def register_client(data: ClientRegister):
    """Public endpoint for client self-registration"""
    db = get_db()
    
    # Check if email or phone already exists
    if data.email:
        existing_email = await db.users.find_one({"email": data.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Este correo ya está registrado")
    
    existing_phone = await db.users.find_one({"phone": data.phone, "role": UserRole.CLIENTE.value})
    if existing_phone:
        raise HTTPException(status_code=400, detail="Este teléfono ya está registrado")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    
    currency = Currency.USD.value if data.country == "US" else Currency.RD.value
    
    client = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "phone": data.phone,
        "password": hash_password(data.password),
        "name": data.name,
        "role": UserRole.CLIENTE.value,
        "credit_limit": 0,  # Clients don't have credit
        "balance": 0.0,
        "commission_rate": 0,
        "currency": currency,
        "country": data.country,
        "created_at": datetime.utcnow(),
        "active": True,
        "total_plays": 0,
        "total_won": 0.0,
        "last_activity": datetime.utcnow(),
        "notification_token": None,
        "verified": False  # For future phone verification
    }
    
    await db.users.insert_one(client)
    
    # Auto-login after registration
    token = create_token(client["id"], client["role"])
    
    return {
        "message": "Registro exitoso",
        "token": token,
        "user": {
            "id": client["id"],
            "name": client["name"],
            "email": client["email"],
            "phone": client["phone"],
            "role": client["role"],
            "country": client["country"]
        }
    }


@router.post("/login")
async def login_client(phone: str, password: str):
    """Login with phone number for clients"""
    db = get_db()
    
    # Find by phone
    user = await db.users.find_one({
        "phone": phone,
        "role": UserRole.CLIENTE.value
    })
    
    if not user:
        # Try email as fallback
        user = await db.users.find_one({
            "email": phone,
            "role": UserRole.CLIENTE.value
        })
    
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Cuenta desactivada")
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_activity": datetime.utcnow()}})
    
    token = create_token(user["id"], user["role"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user.get("email"),
            "phone": user["phone"],
            "role": user["role"],
            "country": user.get("country", "RD"),
            "balance": user.get("balance", 0),
            "total_plays": user.get("total_plays", 0),
            "total_won": user.get("total_won", 0)
        }
    }


@router.get("/me")
async def get_client_profile(current_user: dict = Depends(require_role([UserRole.CLIENTE]))):
    """Get current client's profile"""
    db = get_db()
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Get client's tickets
    tickets = await db.tickets.find({
        "client_id": current_user["id"]
    }).sort("created_at", -1).limit(10).to_list(10)
    
    # Get pending payments
    pending_payments = await db.client_payments.find({
        "client_id": current_user["id"],
        "status": PaymentStatus.PENDING.value
    }).to_list(100)
    
    return {
        **serialize_doc(user),
        "recent_tickets": serialize_doc(tickets),
        "pending_payments": len(pending_payments)
    }


class ClientProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


@router.put("/me")
async def update_client_profile(
    data: ClientProfileUpdate,
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Update current client's profile"""
    db = get_db()
    
    update_data = {"updated_at": datetime.utcnow()}
    
    if data.name:
        update_data["name"] = data.name
    
    if data.email is not None:
        # Check if email is already in use by another user
        if data.email:
            existing = await db.users.find_one({
                "email": data.email,
                "id": {"$ne": current_user["id"]}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Este correo ya está en uso")
        update_data["email"] = data.email
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    return {"message": "Perfil actualizado correctamente"}




@router.get("/payment-accounts")
async def get_payment_accounts():
    """Get available payment accounts (uses existing bank accounts system)"""
    db = get_db()
    
    # Get active bank accounts that are available for client payments
    accounts = await db.bank_accounts.find(
        {"active": True},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "account_type": 1,
            "currency": 1,
            "country": 1,
            "bank_name": 1,
            "account_number": 1,
            "zelle_email": 1,
            "zelle_phone": 1,
            "notes": 1
        }
    ).to_list(100)
    
    # Separate by type for easier frontend handling
    zelle_accounts = [a for a in accounts if a.get("account_type") == "zelle"]
    bank_accounts = [a for a in accounts if a.get("account_type") == "bank"]
    
    return {
        "zelle_accounts": zelle_accounts,
        "bank_accounts": bank_accounts,
        "all_accounts": accounts
    }


@router.post("/tickets")
async def create_client_ticket(
    data: ClientTicketCreate,
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Create a ticket for a client (pending payment)"""
    db = get_db()
    
    if not data.plays or len(data.plays) == 0:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una jugada")
    
    # Get selected bank account info
    bank_account = None
    if data.bank_account_id:
        bank_account = await db.bank_accounts.find_one({"id": data.bank_account_id, "active": True})
        if not bank_account:
            raise HTTPException(status_code=400, detail="Cuenta de pago no encontrada")
    
    # Validate lotteries are open and within time limit
    now = datetime.utcnow()
    validated_plays = []
    total_amount = 0
    
    for play in data.plays:
        lottery = await db.lotteries.find_one({"id": play.get("lottery_id")})
        if not lottery:
            raise HTTPException(status_code=400, detail=f"Lotería no encontrada: {play.get('lottery_id')}")
        
        # Check if lottery closes within 15 minutes
        closing_time = lottery.get("closing_time")
        if closing_time:
            today = now.date()
            close_dt = datetime.combine(today, datetime.strptime(closing_time, "%H:%M").time())
            time_to_close = (close_dt - now).total_seconds() / 60
            
            if time_to_close < 15:
                raise HTTPException(
                    status_code=400, 
                    detail=f"La lotería {lottery['name']} cierra en menos de 15 minutos. No se puede jugar."
                )
        
        play_amount = play.get("amount", 20)
        validated_plays.append({
            "lottery_id": play["lottery_id"],
            "lottery_name": lottery["name"],
            "lottery_type": play.get("lottery_type", "quiniela"),
            "numbers": play.get("numbers"),
            "amount": play_amount,
            "status": "pending"
        })
        total_amount += play_amount
    
    # Generate ticket number
    ticket_number = f"CLT-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": ticket_number,
        "ticket_type": "client_multi_play",
        "client_id": current_user["id"],
        "client_name": current_user.get("name", "Cliente"),
        "plays": validated_plays,
        "total_amount": total_amount,
        "status": TicketStatus.PENDING_PAYMENT.value,
        "payment_method": data.payment_method.value,
        "payment_status": PaymentStatus.PENDING.value,
        "bank_account_id": data.bank_account_id,
        "bank_account_name": bank_account["name"] if bank_account else None,
        "payment_deadline": now + timedelta(hours=24),  # 24 hours to pay
        "created_at": now,
        "country": current_user.get("country", "RD")
    }
    
    await db.tickets.insert_one(ticket)
    
    # Return payment info based on selected account or all available
    payment_info = {}
    if bank_account:
        payment_info = {
            "name": bank_account.get("name"),
            "type": bank_account.get("account_type"),
            "bank_name": bank_account.get("bank_name"),
            "account_number": bank_account.get("account_number"),
            "zelle_email": bank_account.get("zelle_email"),
            "zelle_phone": bank_account.get("zelle_phone"),
            "currency": bank_account.get("currency"),
            "notes": bank_account.get("notes")
        }
    
    return {
        "ticket": serialize_doc(ticket),
        "payment_info": payment_info,
        "message": "Ticket creado. Sube tu comprobante de pago para validar la jugada."
    }


@router.post("/tickets/{ticket_id}/upload-receipt")
async def upload_payment_receipt(
    ticket_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Upload payment receipt for a ticket"""
    db = get_db()
    
    # Find ticket
    ticket = await db.tickets.find_one({
        "id": ticket_id,
        "client_id": current_user["id"],
        "status": TicketStatus.PENDING_PAYMENT.value
    })
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado o ya procesado")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes (JPG, PNG, GIF, WebP)")
    
    # Save file
    file_ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"receipt_{ticket_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(RECEIPTS_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    receipt_url = f"/receipts/{filename}"
    
    # Create payment record
    payment = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "client_id": current_user["id"],
        "client_name": current_user.get("name", "Cliente"),
        "amount": ticket["total_amount"],
        "payment_method": ticket["payment_method"],
        "receipt_url": receipt_url,
        "status": PaymentStatus.PENDING.value,
        "created_at": datetime.utcnow()
    }
    
    await db.client_payments.insert_one(payment)
    
    # Update ticket
    await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {
            "receipt_url": receipt_url,
            "receipt_uploaded_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "Comprobante subido exitosamente. Esperando confirmación del administrador.",
        "payment_id": payment["id"],
        "receipt_url": receipt_url
    }


@router.get("/tickets")
async def get_client_tickets(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Get client's tickets"""
    db = get_db()
    
    query = {"client_id": current_user["id"]}
    if status:
        query["status"] = status
    
    total = await db.tickets.count_documents(query)
    skip = (page - 1) * limit
    
    tickets = await db.tickets.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "tickets": serialize_doc(tickets),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/results")
async def get_lottery_results(
    date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Get lottery results"""
    db = get_db()
    
    query = {}
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            query["draw_date"] = {
                "$gte": datetime.combine(target_date, datetime.min.time()),
                "$lt": datetime.combine(target_date + timedelta(days=1), datetime.min.time())
            }
        except:
            pass
    else:
        # Today's results
        today = datetime.utcnow().date()
        query["draw_date"] = {
            "$gte": datetime.combine(today, datetime.min.time()),
            "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
        }
    
    results = await db.draws.find(query).sort("draw_date", -1).to_list(50)
    
    # Add lottery names
    for result in results:
        lottery = await db.lotteries.find_one({"id": result.get("lottery_id")})
        if lottery:
            result["lottery_name"] = lottery["name"]
    
    return serialize_doc(results)


@router.get("/notifications")
async def get_client_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Get client notifications (payment confirmations, winners, etc.)"""
    db = get_db()
    
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["read"] = False
    
    total = await db.client_notifications.count_documents(query)
    notifications = await db.client_notifications.find(query).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "notifications": serialize_doc(notifications),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }


@router.get("/notifications/unread-count")
async def get_unread_notifications_count(
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Get count of unread notifications"""
    db = get_db()
    count = await db.client_notifications.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    return {"count": count}


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Mark a notification as read"""
    db = get_db()
    result = await db.client_notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    return {"message": "Notificación marcada como leída"}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: dict = Depends(require_role([UserRole.CLIENTE]))
):
    """Mark all notifications as read"""
    db = get_db()
    await db.client_notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.utcnow()}}
    )
    return {"message": "Todas las notificaciones marcadas como leídas"}

