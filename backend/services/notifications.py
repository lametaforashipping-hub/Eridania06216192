"""Push notification services"""
import httpx
import logging
from typing import List, Optional
from utils.database import get_db

logger = logging.getLogger(__name__)


async def send_push_notification(expo_push_tokens: List[str], title: str, body: str, data: dict = None):
    """
    Send push notifications to Expo push tokens.
    Uses the Expo Push API to send notifications to mobile devices.
    """
    if not expo_push_tokens:
        return
    
    valid_tokens = [t for t in expo_push_tokens if t and t.startswith('ExponentPushToken')]
    
    if not valid_tokens:
        logger.info("No valid Expo push tokens found")
        return
    
    messages = []
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
        messages.append(message)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                }
            )
            if response.status_code == 200:
                logger.info(f"Push notifications sent successfully to {len(valid_tokens)} devices")
            else:
                logger.error(f"Push notification error: {response.text}")
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
