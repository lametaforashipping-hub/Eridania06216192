"""Accounting routes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import Optional
from models.enums import UserRole, TicketStatus, TransactionType
from utils.database import get_db
from utils.helpers import serialize_doc
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/accounting", tags=["Accounting"])


async def get_period_stats(db, query_base: dict, start: datetime, end: datetime):
    """Helper to get stats for a specific period"""
    query = {**query_base, "created_at": {"$gte": start, "$lte": end}}
    tickets = await db.tickets.find(query).to_list(10000)
    
    sales = sum(t.get("amount") or t.get("total_amount", 0) for t in tickets if t.get("status") != TicketStatus.CANCELLED.value)
    wins = sum(t.get("prize") or t.get("total_prize", 0) for t in tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
    
    return {
        "sales": sales,
        "wins": wins,
        "profit": sales - wins,
        "tickets": len([t for t in tickets if t.get("status") != TicketStatus.CANCELLED.value])
    }


@router.get("/summary")
async def get_accounting_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get accounting summary with today, week, month breakdowns"""
    db = get_db()
    now = datetime.utcnow()
    
    # Build base query
    query_base = {}
    user_country = current_user.get("country", "RD")
    filter_country = None
    
    if current_user["role"] == UserRole.SUPER_ADMIN.value:
        filter_country = country
    else:
        filter_country = user_country
        query_base["seller_id"] = current_user["id"]
    
    if filter_country:
        country_lotteries = await db.lotteries.find({"country": filter_country}).to_list(1000)
        lottery_ids = [l["id"] for l in country_lotteries]
        if lottery_ids:
            query_base["lottery_id"] = {"$in": lottery_ids}
    
    # Today stats
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_stats = await get_period_stats(db, query_base, today_start, now)
    
    # Week stats (last 7 days)
    week_start = today_start - timedelta(days=7)
    week_stats = await get_period_stats(db, query_base, week_start, now)
    
    # Month stats (last 30 days)
    month_start = today_start - timedelta(days=30)
    month_stats = await get_period_stats(db, query_base, month_start, now)
    
    return {
        "today": today_stats,
        "week": week_stats,
        "month": month_stats,
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


@router.get("/detailed-seller-report")
async def get_detailed_seller_report(
    period: str = "daily",
    seller_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed seller report with breakdown and ticket details"""
    db = get_db()
    now = datetime.utcnow()
    
    # Determine period boundaries
    if period == "daily":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"Hoy - {now.strftime('%d/%m/%Y')}"
    elif period == "weekly":
        start_date = now - timedelta(days=7)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"Últimos 7 días ({start_date.strftime('%d/%m')} - {now.strftime('%d/%m/%Y')})"
    elif period == "biweekly":
        start_date = now - timedelta(days=15)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"Últimos 15 días ({start_date.strftime('%d/%m')} - {now.strftime('%d/%m/%Y')})"
    elif period == "monthly":
        start_date = now - timedelta(days=30)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"Últimos 30 días ({start_date.strftime('%d/%m')} - {now.strftime('%d/%m/%Y')})"
    else:
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_label = f"Hoy - {now.strftime('%d/%m/%Y')}"
    
    # Determine which seller to report on
    target_seller = None
    if seller_id and current_user["role"] in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        target_seller = await db.users.find_one({"id": seller_id})
    
    if not target_seller:
        target_seller = current_user
    
    seller_info = {
        "id": target_seller["id"],
        "name": target_seller.get("name", "N/A"),
        "commission_rate": target_seller.get("commission_rate", 10.0),
        "currency": target_seller.get("currency", "RD$"),
        "country": target_seller.get("country", "RD")
    }
    
    # Get tickets for this seller in the period
    ticket_query = {
        "seller_id": target_seller["id"],
        "created_at": {"$gte": start_date, "$lte": now}
    }
    
    tickets = await db.tickets.find(ticket_query).sort("created_at", -1).to_list(1000)
    
    # Calculate summary statistics
    total_sales = 0
    total_wins = 0
    total_paid = 0
    total_pending_wins = 0
    
    ticket_counts = {
        "total": 0,
        "pending": 0,
        "won": 0,
        "paid": 0,
        "lost": 0,
        "cancelled": 0
    }
    
    ticket_details = []
    
    for ticket in tickets:
        amount = ticket.get("amount") or ticket.get("total_amount", 0)
        potential_win = ticket.get("potential_win") or ticket.get("total_potential_win", 0)
        status = ticket.get("status", "pending")
        is_multi_play = ticket.get("is_multi_play", False) or "plays" in ticket
        
        # Count by status
        ticket_counts["total"] += 1
        if status == TicketStatus.PENDING.value:
            ticket_counts["pending"] += 1
            total_pending_wins += potential_win
        elif status == TicketStatus.WON.value:
            ticket_counts["won"] += 1
            total_wins += ticket.get("prize", potential_win)
        elif status == TicketStatus.PAID.value:
            ticket_counts["paid"] += 1
            total_paid += ticket.get("prize", potential_win)
        elif status == TicketStatus.LOST.value:
            ticket_counts["lost"] += 1
        elif status == TicketStatus.CANCELLED.value:
            ticket_counts["cancelled"] += 1
        
        # Add to sales if not cancelled
        if status != TicketStatus.CANCELLED.value:
            total_sales += amount
        
        # Get lottery name
        lottery_name = ticket.get("lottery_name")
        if not lottery_name and ticket.get("lottery_id"):
            lottery = await db.lotteries.find_one({"id": ticket.get("lottery_id")})
            lottery_name = lottery.get("name") if lottery else "N/A"
        
        # Add to ticket details
        ticket_detail = {
            "id": ticket.get("id"),
            "ticket_number": ticket.get("ticket_number"),
            "is_multi_play": is_multi_play,
            "lottery_name": lottery_name or "N/A",
            "numbers": ticket.get("numbers", []),
            "plays": ticket.get("plays", []),
            "amount": amount if not is_multi_play else None,
            "total_amount": amount if is_multi_play else None,
            "potential_win": potential_win if not is_multi_play else None,
            "total_potential_win": potential_win if is_multi_play else None,
            "status": status,
            "created_at": ticket.get("created_at").isoformat() if ticket.get("created_at") else "",
            "customer_name": ticket.get("customer_name"),
            "currency": ticket.get("currency", seller_info["currency"])
        }
        ticket_details.append(ticket_detail)
    
    # Calculate commission and profit
    commission_rate = seller_info["commission_rate"]
    total_commission = total_sales * (commission_rate / 100)
    total_actual_wins = total_wins + total_paid
    net_profit = total_sales - total_actual_wins
    net_after_commission = net_profit - total_commission
    
    summary = {
        "total_sales": total_sales,
        "total_wins": total_actual_wins,
        "total_paid": total_paid,
        "total_pending_wins": total_pending_wins,
        "total_commission": total_commission,
        "commission_rate": commission_rate,
        "net_profit": net_profit,
        "net_after_commission": net_after_commission,
        "currency": seller_info["currency"]
    }
    
    # Calculate daily breakdown (only for weekly, biweekly, monthly)
    daily_breakdown = []
    if period in ["weekly", "biweekly", "monthly"]:
        days_count = 7 if period == "weekly" else (15 if period == "biweekly" else 30)
        day_names_es = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        
        for i in range(days_count - 1, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            day_tickets = [t for t in tickets 
                          if t.get("created_at") and day_start <= t.get("created_at") < day_end]
            
            day_sales = sum(t.get("amount") or t.get("total_amount", 0) 
                           for t in day_tickets if t.get("status") != TicketStatus.CANCELLED.value)
            day_wins = sum(t.get("prize") or t.get("potential_win") or t.get("total_potential_win", 0) 
                          for t in day_tickets if t.get("status") in [TicketStatus.WON.value, TicketStatus.PAID.value])
            
            day_name = day_names_es[day_start.weekday()]
            
            daily_breakdown.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "label": day_start.strftime("%d/%m"),
                "day_name": day_name,
                "sales": day_sales,
                "wins": day_wins,
                "profit": day_sales - day_wins,
                "tickets": len([t for t in day_tickets if t.get("status") != TicketStatus.CANCELLED.value])
            })
    
    return {
        "period": period,
        "period_label": period_label,
        "seller": seller_info,
        "summary": summary,
        "ticket_counts": ticket_counts,
        "daily_breakdown": daily_breakdown,
        "tickets": ticket_details
    }
