"""Push notification services"""
import httpx
import logging
from typing import List, Optional
from utils.database import get_db

logger = logging.getLogger(__name__)

# Import email service (lazy import to avoid circular dependencies)
def get_email_service():
    try:
        from services.email_service import (
            send_winner_notification as email_winner,
            send_payment_confirmed_notification as email_payment_confirmed,
            send_payment_rejected_notification as email_payment_rejected
        )
        return {
            "winner": email_winner,
            "payment_confirmed": email_payment_confirmed,
            "payment_rejected": email_payment_rejected
        }
    except ImportError as e:
        logger.warning(f"Email service not available: {e}")
        return None


async def send_push_notification(expo_push_tokens: List[str], title: str, body: str, data: dict = None):
    """
    Send push notifications to Expo push tokens.
    Sends each token individually to avoid PUSH_TOO_MANY_EXPERIENCE_IDS error.
    """
    if not expo_push_tokens:
        return
    
    valid_tokens = [t for t in expo_push_tokens if t and t.startswith('ExponentPushToken')]
    
    if not valid_tokens:
        logger.info("No valid Expo push tokens found")
        return
    
    success_count = 0
    try:
        async with httpx.AsyncClient() as client:
            for token in valid_tokens:
                message = {
                    "to": token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "priority": "high",
                    "channelId": "lottery-winners"
                }
                try:
                    response = await client.post(
                        "https://exp.host/--/api/v2/push/send",
                        json=message,
                        headers={
                            "Accept": "application/json",
                            "Accept-Encoding": "gzip, deflate",
                            "Content-Type": "application/json",
                        }
                    )
                    if response.status_code == 200:
                        success_count += 1
                    else:
                        logger.warning(f"Push notification failed for token: {response.text}")
                except Exception as e:
                    logger.warning(f"Error sending to individual token: {e}")
            
            if success_count > 0:
                logger.info(f"Push notifications sent successfully to {success_count}/{len(valid_tokens)} devices")
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")


async def notify_winner(seller_id: str, ticket_number: str, prize: float, currency: str, lottery_name: str):
    """Send push notification to a winning ticket seller"""
    db = get_db()
    seller = await db.users.find_one({"id": seller_id})
    tokens = []
    
    if seller and seller.get("notification_token"):
        tokens.append(seller["notification_token"])
    
    super_admins = await db.users.find({"role": "super_admin"}).to_list(100)
    for admin in super_admins:
        if admin.get("notification_token"):
            tokens.append(admin["notification_token"])
    
    if tokens:
        await send_push_notification(
            tokens,
            "🎉 ¡GANADOR!",
            f"Boleto {ticket_number} ganó {currency} {prize:,.2f} en {lottery_name}",
            {
                "type": "winner_alert",
                "ticket_number": ticket_number,
                "prize": prize,
                "lottery_name": lottery_name
            }
        )


async def notify_draw_complete(lottery_name: str, winning_numbers: List[int], total_winners: int, total_paid: float, currency: str):
    """Send push notification to super admins about draw completion"""
    db = get_db()
    super_admins = await db.users.find({"role": "super_admin"}).to_list(100)
    tokens = [admin["notification_token"] for admin in super_admins if admin.get("notification_token")]
    
    if tokens:
        numbers_str = "-".join([str(n).zfill(2) for n in winning_numbers])
        await send_push_notification(
            tokens,
            f"🎰 Sorteo Completado: {lottery_name}",
            f"Números: {numbers_str} | {total_winners} ganadores | Total: {currency} {total_paid:,.2f}",
            {
                "type": "draw_result",
                "lottery_name": lottery_name,
                "winning_numbers": winning_numbers,
                "total_winners": total_winners
            }
        )


async def notify_high_risk_bet(ticket_number: str, seller_name: str, amount: float, currency: str):
    """Send notification about high-risk bet to admins"""
    db = get_db()
    super_admins = await db.users.find({"role": "super_admin"}).to_list(100)
    tokens = [admin["notification_token"] for admin in super_admins if admin.get("notification_token")]
    
    if tokens:
        await send_push_notification(
            tokens,
            "⚠️ Alerta de Apuesta Alta",
            f"Boleto {ticket_number} por {currency} {amount:,.2f} - Vendedor: {seller_name}",
            {
                "type": "high_risk_alert",
                "ticket_number": ticket_number,
                "amount": amount,
                "seller_name": seller_name
            }
        )


async def notify_new_lottery_results(results: List[dict]):
    """
    Send push notification to ALL users when new lottery results are published.
    Results format: [{"lottery_name": "Nacional", "first": 38, "second": 74, "third": 79}, ...]
    """
    db = get_db()
    
    # Get all active users with notification tokens
    all_users = await db.users.find({"active": True}).to_list(10000)
    tokens = [user["notification_token"] for user in all_users if user.get("notification_token")]
    
    if not tokens:
        logger.info("No users with push tokens to notify about results")
        return
    
    # Build notification message
    if len(results) == 1:
        r = results[0]
        title = f"🎰 {r['lottery_name']}"
        numbers = f"{str(r['first']).zfill(2)}-{str(r.get('second', 0)).zfill(2)}-{str(r.get('third', 0)).zfill(2)}"
        body = f"Números ganadores: {numbers}"
    else:
        title = f"🎰 {len(results)} Resultados Nuevos"
        # Show first 3 lotteries
        lottery_names = [r['lottery_name'] for r in results[:3]]
        if len(results) > 3:
            body = f"{', '.join(lottery_names)} y {len(results) - 3} más"
        else:
            body = ", ".join(lottery_names)
    
    # Create in-app notification for all users
    import uuid
    from datetime import datetime, timezone
    
    notification_doc = {
        "id": str(uuid.uuid4()),
        "type": "lottery_results",
        "title": title,
        "message": body,
        "results": results,
        "created_at": datetime.now(timezone.utc),
        "read_by": []
    }
    await db.notifications.insert_one(notification_doc)
    
    # Send push notifications
    await send_push_notification(
        tokens,
        title,
        body,
        {
            "type": "lottery_results",
            "results": results,
            "notification_id": notification_doc["id"]
        }
    )
    
    logger.info(f"Lottery results notification sent to {len(tokens)} devices")


async def notify_client_payment_confirmed(client_id: str, ticket_number: str, total_amount: float):
    """Send push notification and email to client when their payment is confirmed"""
    db = get_db()
    client = await db.users.find_one({"id": client_id})
    
    if not client:
        logger.warning(f"Client not found: {client_id}")
        return
    
    # Send email notification
    email_service = get_email_service()
    if email_service and client.get("email"):
        try:
            email_service["payment_confirmed"](
                client_name=client.get("name", "Cliente"),
                client_email=client["email"],
                ticket_number=ticket_number,
                amount=total_amount,
                currency="RD$"
            )
            logger.info(f"Payment confirmation email sent to {client['email']}")
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email: {e}")
    
    # Send push notification
    if not client.get("notification_token"):
        logger.info(f"No notification token for client {client_id}")
        return
    
    tokens = [client["notification_token"]]
    
    # Create in-app notification
    import uuid
    from datetime import datetime, timezone
    
    notification_doc = {
        "id": str(uuid.uuid4()),
        "type": "payment_confirmed",
        "user_id": client_id,
        "title": "✅ Pago Confirmado",
        "message": f"Tu pago para el ticket {ticket_number} ha sido confirmado. ¡Buena suerte!",
        "ticket_number": ticket_number,
        "amount": total_amount,
        "created_at": datetime.now(timezone.utc),
        "read": False
    }
    await db.client_notifications.insert_one(notification_doc)
    
    await send_push_notification(
        tokens,
        "✅ Pago Confirmado",
        f"Tu pago de RD$ {total_amount:,.0f} ha sido confirmado. Ticket: {ticket_number}",
        {
            "type": "payment_confirmed",
            "ticket_number": ticket_number,
            "notification_id": notification_doc["id"]
        }
    )
    
    logger.info(f"Payment confirmation sent to client {client_id}")


async def notify_client_payment_rejected(client_id: str, ticket_number: str, reason: str = None):
    """Send push notification and email to client when their payment is rejected"""
    db = get_db()
    client = await db.users.find_one({"id": client_id})
    
    if not client:
        logger.warning(f"Client not found: {client_id}")
        return
    
    # Send email notification
    email_service = get_email_service()
    if email_service and client.get("email"):
        try:
            email_service["payment_rejected"](
                client_name=client.get("name", "Cliente"),
                client_email=client["email"],
                ticket_number=ticket_number,
                reason=reason
            )
            logger.info(f"Payment rejection email sent to {client['email']}")
        except Exception as e:
            logger.error(f"Failed to send payment rejection email: {e}")
    
    # Send push notification
    if not client.get("notification_token"):
        logger.info(f"No notification token for client {client_id}")
        return
    
    tokens = [client["notification_token"]]
    
    message = f"Tu pago para el ticket {ticket_number} no pudo ser verificado."
    if reason:
        message += f" Razón: {reason}"
    
    # Create in-app notification
    import uuid
    from datetime import datetime, timezone
    
    notification_doc = {
        "id": str(uuid.uuid4()),
        "type": "payment_rejected",
        "user_id": client_id,
        "title": "❌ Pago Rechazado",
        "message": message,
        "ticket_number": ticket_number,
        "reason": reason,
        "created_at": datetime.now(timezone.utc),
        "read": False
    }
    await db.client_notifications.insert_one(notification_doc)
    
    await send_push_notification(
        tokens,
        "❌ Pago Rechazado",
        message,
        {
            "type": "payment_rejected",
            "ticket_number": ticket_number,
            "reason": reason,
            "notification_id": notification_doc["id"]
        }
    )
    
    logger.info(f"Payment rejection sent to client {client_id}")


async def notify_client_winner(client_id: str, ticket_number: str, prize: float, lottery_name: str, winning_numbers: str = ""):
    """Send push notification and email to client when they win"""
    db = get_db()
    client = await db.users.find_one({"id": client_id})
    
    if not client:
        logger.warning(f"Client not found: {client_id}")
        return
    
    # Send email notification
    email_service = get_email_service()
    if email_service and client.get("email"):
        try:
            email_service["winner"](
                client_name=client.get("name", "Cliente"),
                client_email=client["email"],
                ticket_number=ticket_number,
                lottery_name=lottery_name,
                winning_numbers=winning_numbers,
                prize_amount=prize,
                currency="RD$"
            )
            logger.info(f"Winner email sent to {client['email']}")
        except Exception as e:
            logger.error(f"Failed to send winner email: {e}")
    
    # Send push notification
    if not client.get("notification_token"):
        logger.info(f"No notification token for client {client_id}")
        return
    
    tokens = [client["notification_token"]]
    
    # Create in-app notification
    import uuid
    from datetime import datetime, timezone
    
    notification_doc = {
        "id": str(uuid.uuid4()),
        "type": "winner",
        "user_id": client_id,
        "title": "🎉 ¡FELICIDADES! ¡GANASTE!",
        "message": f"Tu ticket {ticket_number} ganó RD$ {prize:,.0f} en {lottery_name}",
        "ticket_number": ticket_number,
        "prize": prize,
        "lottery_name": lottery_name,
        "created_at": datetime.now(timezone.utc),
        "read": False
    }
    await db.client_notifications.insert_one(notification_doc)
    
    await send_push_notification(
        tokens,
        "🎉 ¡FELICIDADES! ¡GANASTE!",
        f"Tu ticket {ticket_number} ganó RD$ {prize:,.0f} en {lottery_name}",
        {
            "type": "winner",
            "ticket_number": ticket_number,
            "prize": prize,
            "lottery_name": lottery_name,
            "notification_id": notification_doc["id"]
        }
    )
    
    logger.info(f"Winner notification sent to client {client_id}")


async def notify_admin_pending_payments_summary():
    """Send daily summary of pending payments to admins"""
    db = get_db()
    
    # Count pending payments
    from models.enums import PaymentStatus
    pending_count = await db.client_payments.count_documents({"status": PaymentStatus.PENDING.value})
    
    if pending_count == 0:
        logger.info("No pending payments for daily summary")
        return
    
    # Get admin tokens
    admins = await db.users.find({"role": {"$in": ["super_admin", "admin"]}}).to_list(100)
    tokens = [admin["notification_token"] for admin in admins if admin.get("notification_token")]
    
    if not tokens:
        logger.info("No admin tokens for pending payments summary")
        return
    
    # Calculate total pending amount
    pipeline = [
        {"$match": {"status": PaymentStatus.PENDING.value}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    result = await db.client_payments.aggregate(pipeline).to_list(1)
    total_amount = result[0]["total"] if result else 0
    
    await send_push_notification(
        tokens,
        "📋 Resumen de Pagos Pendientes",
        f"Hay {pending_count} pagos pendientes por RD$ {total_amount:,.0f}",
        {
            "type": "pending_payments_summary",
            "pending_count": pending_count,
            "total_amount": total_amount
        }
    )
    
    logger.info(f"Pending payments summary sent to {len(tokens)} admins")



async def send_weekly_report_to_admins():
    """Send weekly sales and statistics report to admins via email"""
    from datetime import datetime, timedelta
    
    db = get_db()
    email_service = get_email_service()
    
    if not email_service:
        logger.warning("Email service not available for weekly report")
        return
    
    # Calculate date range (last 7 days)
    now = datetime.utcnow()
    start_date = now - timedelta(days=7)
    
    # Get weekly statistics
    try:
        # Total sales
        sales_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}}
        ]
        sales_result = await db.tickets.aggregate(sales_pipeline).to_list(1)
        total_sales = sales_result[0]["total"] if sales_result else 0
        total_tickets = sales_result[0]["count"] if sales_result else 0
        
        # Prizes paid
        prizes_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}, "status": "won"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_won"}}}
        ]
        prizes_result = await db.tickets.aggregate(prizes_pipeline).to_list(1)
        total_prizes = prizes_result[0]["total"] if prizes_result else 0
        
        # Top sellers
        sellers_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}, "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": "$seller_id", "sales": {"$sum": "$total_amount"}, "tickets": {"$sum": 1}}},
            {"$sort": {"sales": -1}},
            {"$limit": 5}
        ]
        top_sellers_raw = await db.tickets.aggregate(sellers_pipeline).to_list(5)
        
        # Get seller names
        top_sellers = []
        for seller in top_sellers_raw:
            user = await db.users.find_one({"id": seller["_id"]})
            top_sellers.append({
                "name": user.get("name", "Desconocido") if user else "Desconocido",
                "sales": seller["sales"],
                "tickets": seller["tickets"]
            })
        
        # New clients this week
        new_clients = await db.users.count_documents({
            "role": "cliente",
            "created_at": {"$gte": start_date}
        })
        
        # Top lotteries
        lotteries_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}, "status": {"$ne": "cancelled"}}},
            {"$unwind": "$plays"},
            {"$group": {"_id": "$plays.lottery", "revenue": {"$sum": "$plays.amount"}}},
            {"$sort": {"revenue": -1}},
            {"$limit": 5}
        ]
        top_lotteries = await db.tickets.aggregate(lotteries_pipeline).to_list(5)
        
        # Build sellers HTML
        sellers_html = ""
        for i, seller in enumerate(top_sellers, 1):
            sellers_html += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #334155;">#{i} {seller['name']}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right;">{seller['tickets']}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; color: #22c55e;">RD$ {seller['sales']:,.0f}</td>
                </tr>
            """
        
        # Build lotteries HTML
        lotteries_html = ""
        for lottery in top_lotteries:
            lotteries_html += f"""
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #334155;">{lottery['_id']}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; color: #22c55e;">RD$ {lottery['revenue']:,.0f}</td>
                </tr>
            """
        
        # Net profit
        net_profit = total_sales - total_prizes
        profit_color = "#22c55e" if net_profit >= 0 else "#ef4444"
        
        # Build email HTML
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; }}
                .header {{ background: linear-gradient(135deg, #22c55e, #16a34a); padding: 25px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px; }}
                .content {{ padding: 25px; color: #e2e8f0; }}
                .kpi-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }}
                .kpi-card {{ background: #334155; padding: 15px; border-radius: 8px; text-align: center; }}
                .kpi-value {{ font-size: 24px; font-weight: bold; color: #22c55e; }}
                .kpi-label {{ font-size: 12px; color: #94a3b8; margin-top: 5px; }}
                .section {{ margin-top: 20px; }}
                .section-title {{ font-size: 16px; font-weight: bold; color: #f8fafc; margin-bottom: 10px; border-bottom: 2px solid #22c55e; padding-bottom: 5px; }}
                table {{ width: 100%; border-collapse: collapse; color: #e2e8f0; font-size: 14px; }}
                .footer {{ background: #0f172a; padding: 15px; text-align: center; color: #64748b; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Reporte Semanal</h1>
                    <p>{start_date.strftime('%d/%m/%Y')} - {now.strftime('%d/%m/%Y')}</p>
                </div>
                <div class="content">
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-value">RD$ {total_sales:,.0f}</div>
                            <div class="kpi-label">Ventas Totales</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-value" style="color: {profit_color};">RD$ {net_profit:,.0f}</div>
                            <div class="kpi-label">Ganancia Neta</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-value">{total_tickets}</div>
                            <div class="kpi-label">Boletos Vendidos</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-value" style="color: #f59e0b;">RD$ {total_prizes:,.0f}</div>
                            <div class="kpi-label">Premios Pagados</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">🏆 Top Vendedores</div>
                        <table>
                            <tr style="color: #94a3b8;">
                                <th style="text-align: left; padding: 8px;">Vendedor</th>
                                <th style="text-align: right; padding: 8px;">Boletos</th>
                                <th style="text-align: right; padding: 8px;">Ventas</th>
                            </tr>
                            {sellers_html if sellers_html else '<tr><td colspan="3" style="padding: 8px; color: #64748b;">Sin datos</td></tr>'}
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">🎰 Top Loterías</div>
                        <table>
                            <tr style="color: #94a3b8;">
                                <th style="text-align: left; padding: 8px;">Lotería</th>
                                <th style="text-align: right; padding: 8px;">Ingresos</th>
                            </tr>
                            {lotteries_html if lotteries_html else '<tr><td colspan="2" style="padding: 8px; color: #64748b;">Sin datos</td></tr>'}
                        </table>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">👥 Nuevos Clientes</div>
                        <p style="font-size: 28px; font-weight: bold; color: #3b82f6; margin: 10px 0;">{new_clients}</p>
                        <p style="color: #94a3b8; font-size: 12px;">registrados esta semana</p>
                    </div>
                </div>
                <div class="footer">
                    <p>Lotería Mágica - Reporte automático semanal</p>
                    <p>Este reporte se genera cada lunes a las 8:00 AM</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Get admin emails
        admins = await db.users.find({"role": {"$in": ["super_admin", "admin"]}}).to_list(100)
        
        # Import send_email from email_service
        from services.email_service import send_email
        
        emails_sent = 0
        for admin in admins:
            if admin.get("email"):
                try:
                    result = send_email(
                        admin["email"],
                        f"📊 Reporte Semanal - Lotería Mágica ({start_date.strftime('%d/%m')} - {now.strftime('%d/%m')})",
                        html_content
                    )
                    if result:
                        emails_sent += 1
                except Exception as e:
                    logger.error(f"Failed to send weekly report to {admin['email']}: {e}")
        
        logger.info(f"Weekly report sent to {emails_sent} admins")
        
    except Exception as e:
        logger.error(f"Error generating weekly report: {e}")
