"""Seed sample data for new trial tenants"""
import uuid
from datetime import datetime, timezone


async def seed_trial_data(db, tenant_id: str, admin_id: str, country: str = "RD"):
    """Create sample data for a new trial tenant"""
    from utils.helpers import hash_password
    from models.enums import Currency

    now = datetime.now(timezone.utc)
    currency = Currency.USD.value if country == "US" else Currency.RD.value

    lottery_ids = []
    lotteries = await db.lotteries.find({"country": country, "active": True}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
    if not lotteries:
        lotteries = [{"id": "demo_lottery", "name": "Loteria Demo"}]
    lottery_ids = lotteries[:4]

    seller_id = str(uuid.uuid4())
    seller = {
        "id": seller_id,
        "email": f"vendedor-demo-{tenant_id[:8]}@demo.com",
        "password": hash_password("demo1234"),
        "name": "Vendedor Demo",
        "role": "vendedor",
        "credit_limit": 50000,
        "balance": 0.0,
        "commission_rate": 10.0,
        "currency": currency,
        "country": country,
        "created_by": admin_id,
        "created_at": now,
        "active": True,
        "total_sales": 1500.0,
        "total_commission": 150.0,
        "last_activity": now,
        "notification_token": None,
        "phone": "809-000-0001",
        "address": "Calle Demo #1",
        "cedula": "000-0000001-1",
        "terminal_id": None,
        "tenant_id": tenant_id,
    }
    await db.users.insert_one(seller)

    client_id = str(uuid.uuid4())
    client = {
        "id": client_id,
        "name": "Cliente Demo",
        "phone": "809-000-0002",
        "email": "cliente-demo@demo.com",
        "pin": "1234",
        "balance": 0.0,
        "created_by": seller_id,
        "created_at": now.isoformat(),
        "active": True,
        "tenant_id": tenant_id,
    }
    await db.clients.insert_one(client)

    sample_tickets = []
    for i in range(3):
        ticket_id = str(uuid.uuid4())
        ticket_num = f"DEMO{tenant_id[:4].upper()}{10000 + i}"
        lot1 = lottery_ids[i % len(lottery_ids)]
        lot2 = lottery_ids[(i + 1) % len(lottery_ids)]
        plays = [
            {
                "lottery_id": lot1["id"],
                "lottery_name": lot1["name"],
                "lottery_type": "quiniela",
                "numbers": [15 + i],
                "amount": 100,
            },
            {
                "lottery_id": lot2["id"],
                "lottery_name": lot2["name"],
                "lottery_type": "pale",
                "numbers": [22 + i, 45 + i],
                "amount": 50,
            },
        ]
        ticket = {
            "id": ticket_id,
            "ticket_number": ticket_num,
            "ticket_type": "multi_play",
            "seller_id": seller_id,
            "seller_name": "Vendedor Demo",
            "client_id": client_id,
            "client_name": "Cliente Demo",
            "plays": plays,
            "total_amount": 150.0,
            "currency": currency,
            "status": "pending" if i == 0 else ("won" if i == 1 else "lost"),
            "created_at": now,
            "country": country,
            "tenant_id": tenant_id,
        }
        sample_tickets.append(ticket)

    if sample_tickets:
        await db.tickets.insert_many(sample_tickets)
