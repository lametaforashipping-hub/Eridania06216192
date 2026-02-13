"""Accounting routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional
from models.enums import UserRole, TicketStatus, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/accounting", tags=["Accounting"])


@router.get("/summary")
async def get_accounting_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get accounting summary for the period"""
    db = get_db()
    
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    query = {"created_at": {"$gte": start, "$lte": end}}
    
    user_country = current_user.get("country", "RD")
    filter_country = None
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        filter_country = country
    else:
        filter_country = user_country
        query["seller_id"] = current_user["id"]
    
    if filter_country:
        country_lotteries = await db.lotteries.find({"country": filter_country}).to_list(1000)
        lottery_ids = [l["id"] for l in country_lotteries]
        if lottery_ids:
            query["lottery_id"] = {"$in": lottery_ids}
    
    tickets = await db.tickets.find(query).to_list(10000)
    
    total_sales = sum(t.get("amount") or t.get("total_amount", 0) for t in tickets if t.get("status") != TicketStatus.CANCELLED.value)
    total_wins = sum(t.get("potential_win") or t.get("total_potential_win", 0) for t in tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    total_cancelled = sum(t.get("amount") or t.get("total_amount", 0) for t in tickets if t.get("status") == TicketStatus.CANCELLED.value)
    
    commission_rate = current_user.get("commission_rate", 10.0)
    total_commission = total_sales * (commission_rate / 100)
    
    return {
        "period": {"start": start.isoformat(), "end": end.isoformat()},
        "total_sales": total_sales,
        "total_wins": total_wins,
        "total_cancelled": total_cancelled,
        "net_profit": total_sales - total_wins,
        "total_commission": total_commission,
        "tickets_count": len([t for t in tickets if t.get("status") != TicketStatus.CANCELLED.value]),
        "currency": current_user.get("currency", "RD$"),
        "country_filter": filter_country
    }


@router.get("/transactions")
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get transactions for the period"""
    db = get_db()
    
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    query = {"created_at": {"$gte": start, "$lte": end}}
    
    if current_user["role"] != UserRole.SUPER_ADMIN.value:
        query["user_id"] = current_user["id"]
    
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(500)
    return serialize_doc(transactions)


@router.get("/commissions-report")
async def get_commissions_report(
    period: str = "day",
    current_user: dict = Depends(get_current_user)
):
    """Get commissions report"""
    db = get_db()
    now = datetime.utcnow()
    
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    query = {
        "transaction_type": TransactionType.COMMISSION.value,
        "created_at": {"$gte": start_date}
    }
    
    is_super_admin = current_user["role"] == UserRole.SUPER_ADMIN.value
    
    if not is_super_admin:
        query["user_id"] = current_user["id"]
    
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(500)
    
    details = []
    total_sales = 0
    total_commission = 0
    commission_rate = current_user.get("commission_rate", 10.0)
    
    for tx in transactions:
        ticket_number = tx.get("description", "").split()[-1] if "venta" in tx.get("description", "") else ""
        
        if ticket_number:
            ticket = await db.tickets.find_one({"ticket_number": ticket_number})
            if ticket:
                sale_amount = ticket.get("amount") or ticket.get("total_amount", 0)
                lottery = await db.lotteries.find_one({"id": ticket.get("lottery_id")})
                seller = await db.users.find_one({"id": ticket.get("seller_id")}) if is_super_admin else None
                
                detail = {
                    "id": tx.get("id"),
                    "ticket_number": ticket_number,
                    "lottery_name": lottery.get("name") if lottery else ticket.get("lottery_name", "N/A"),
                    "sale_amount": sale_amount,
                    "commission_rate": commission_rate,
                    "commission_earned": tx.get("amount", 0),
                    "currency": tx.get("currency", "RD$"),
                    "created_at": tx.get("created_at").isoformat() if tx.get("created_at") else "",
                    "seller_name": seller.get("name") if seller else None
                }
                
                try:
                    desc = tx.get("description", "")
                    if "%" in desc:
                        rate_str = desc.split("Comisión")[1].split("%")[0].strip() if "Comisión" in desc else "10"
                        detail["commission_rate"] = float(rate_str)
                except:
                    pass
                
                details.append(detail)
                total_sales += sale_amount
                total_commission += tx.get("amount", 0)
    
    seller_breakdown = []
    if is_super_admin:
        seller_commissions = {}
        for detail in details:
            seller_name = detail.get("seller_name") or "Desconocido"
            if seller_name not in seller_commissions:
                seller_commissions[seller_name] = {
                    "seller_name": seller_name,
                    "total_sales": 0,
                    "total_commission": 0,
                    "commission_rate": detail.get("commission_rate", 10),
                    "ticket_count": 0
                }
            seller_commissions[seller_name]["total_sales"] += detail.get("sale_amount", 0)
            seller_commissions[seller_name]["total_commission"] += detail.get("commission_earned", 0)
            seller_commissions[seller_name]["ticket_count"] += 1
        
        seller_breakdown = list(seller_commissions.values())
    
    ticket_count = len(details)
    average_sale = total_sales / ticket_count if ticket_count > 0 else 0
    
    summary = {
        "total_sales": total_sales,
        "total_commission": total_commission,
        "commission_rate": commission_rate,
        "currency": current_user.get("currency", "RD$"),
        "ticket_count": ticket_count,
        "average_sale": average_sale
    }
    
    return {
        "summary": summary,
        "details": details,
        "seller_breakdown": seller_breakdown
    }


@router.get("/sellers-report")
async def get_sellers_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    country: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN]))
):
    """Get sellers performance report"""
    db = get_db()
    
    if not start_date:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = datetime.fromisoformat(start_date)
    
    if not end_date:
        end = datetime.utcnow()
    else:
        end = datetime.fromisoformat(end_date)
    
    user_country = current_user.get("country", "RD")
    filter_country = None
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        filter_country = country
    else:
        filter_country = user_country
    
    seller_query = {"role": UserRole.VENDEDOR.value}
    if current_user["role"] != UserRole.SUPER_ADMIN.value:
        seller_query["created_by"] = current_user["id"]
    
    if filter_country:
        seller_query["country"] = filter_country
    
    sellers = await db.users.find(seller_query).to_list(1000)
    
    country_lottery_ids = None
    if filter_country:
        country_lotteries = await db.lotteries.find({"country": filter_country}).to_list(1000)
        country_lottery_ids = [l["id"] for l in country_lotteries]
    
    reports = []
    
    for seller in sellers:
        ticket_query = {
            "seller_id": seller["id"],
            "created_at": {"$gte": start, "$lte": end}
        }
        if country_lottery_ids is not None:
            ticket_query["lottery_id"] = {"$in": country_lottery_ids}
        
        tickets = await db.tickets.find(ticket_query).to_list(10000)
        
        total_sales = sum(t.get("amount", t.get("total_amount", 0)) for t in tickets if t["status"] != TicketStatus.CANCELLED.value)
        total_wins = sum(t.get("potential_win", t.get("total_potential_win", 0)) for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value])
        tickets_sold = len([t for t in tickets if t["status"] != TicketStatus.CANCELLED.value])
        tickets_won = len([t for t in tickets if t["status"] in [TicketStatus.WON.value, TicketStatus.PAID.value]])
        
        commission_rate = seller.get("commission_rate", 10.0)
        total_commission = total_sales * (commission_rate / 100)
        
        reports.append({
            "seller_id": seller["id"],
            "seller_name": seller["name"],
            "seller_country": seller.get("country", "RD"),
            "total_sales": total_sales,
            "total_wins": total_wins,
            "total_commission": total_commission,
            "net_profit": total_sales - total_wins,
            "tickets_sold": tickets_sold,
            "tickets_won": tickets_won,
            "commission_rate": commission_rate,
            "currency": seller["currency"]
        })
    
    reports.sort(key=lambda x: x["total_sales"], reverse=True)
    
    return {
        "period": f"{start.date()} - {end.date()}",
        "sellers": reports,
        "totals": {
            "total_sales": sum(r["total_sales"] for r in reports),
            "total_wins": sum(r["total_wins"] for r in reports),
            "total_commission": sum(r["total_commission"] for r in reports),
            "net_profit": sum(r["net_profit"] for r in reports)
        },
        "country_filter": filter_country
    }


@router.get("/daily-chart")
async def get_daily_chart_data(
    days: int = 7,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get daily chart data for the last N days"""
    db = get_db()
    data = []
    
    user_country = current_user.get("country", "RD")
    filter_country = None
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        filter_country = country
    else:
        filter_country = user_country
    
    country_lottery_ids = None
    if filter_country:
        country_lotteries = await db.lotteries.find({"country": filter_country}).to_list(1000)
        country_lottery_ids = [l["id"] for l in country_lotteries]
    
    for i in range(days - 1, -1, -1):
        day_start = (datetime.utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        query = {"created_at": {"$gte": day_start, "$lt": day_end}}
        
        if current_user["role"] == UserRole.VENDEDOR.value:
            query["seller_id"] = current_user["id"]
        elif current_user["role"] == UserRole.ADMIN.value:
            vendors = await db.users.find({"created_by": current_user["id"]}).to_list(1000)
            vendor_ids = [v["id"] for v in vendors] + [current_user["id"]]
            query["seller_id"] = {"$in": vendor_ids}
        
        if country_lottery_ids is not None:
            query["lottery_id"] = {"$in": country_lottery_ids}
        
        tickets = await db.tickets.find(query).to_list(10000)
        
        day_sales = sum(t.get("amount") or t.get("total_amount", 0) for t in tickets if t.get("status") != TicketStatus.CANCELLED.value)
        day_wins = sum(t.get("potential_win") or t.get("total_potential_win", 0) for t in tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
        
        data.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "day_name": day_start.strftime("%a"),
            "sales": day_sales,
            "wins": day_wins,
            "profit": day_sales - day_wins,
            "tickets_count": len([t for t in tickets if t.get("status") != TicketStatus.CANCELLED.value])
        })
    
    return {
        "days": days,
        "data": data,
        "totals": {
            "total_sales": sum(d["sales"] for d in data),
            "total_wins": sum(d["wins"] for d in data),
            "total_profit": sum(d["profit"] for d in data),
            "total_tickets": sum(d["tickets_count"] for d in data)
        },
        "country_filter": filter_country
    }
