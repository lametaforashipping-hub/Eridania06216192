"""
Ticket Expiry Service
Automatically marks old pending tickets as 'lost' after their lottery's closing time has passed.
Also handles multi-play tickets where lottery_id is stored in individual plays.
"""
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Dominican Republic timezone offset (UTC-4)
DR_OFFSET = timedelta(hours=-4)


def get_dr_now():
    """Get current datetime in Dominican Republic timezone (UTC-4)"""
    return datetime.now(timezone.utc).replace(tzinfo=None) + DR_OFFSET


async def expire_old_pending_tickets():
    """
    Mark pending tickets as 'lost' if their lottery's closing time has passed.
    Runs every 30 minutes.
    
    Logic:
    1. Find all pending tickets
    2. For each lottery, check if its closing_time for today has passed
    3. If yes, mark all pending tickets for that lottery as 'lost'
    4. For tickets older than 24 hours that are still pending, mark as 'lost' (safety net)
    """
    from utils.database import get_db
    from models.enums import TicketStatus
    
    try:
        db = get_db()
        dr_now = get_dr_now()
        
        logger.info(f"Running ticket expiry check (DR time: {dr_now.strftime('%Y-%m-%d %H:%M')})")
        
        # Get all active lotteries with their closing times
        lotteries = await db.lotteries.find(
            {"active": True},
            {"_id": 0, "id": 1, "name": 1, "closing_time": 1, "schedule": 1, "closing_minutes_before": 1}
        ).to_list(100)
        
        total_expired = 0
        
        for lottery in lotteries:
            lottery_id = lottery["id"]
            lottery_name = lottery.get("name", "Unknown")
            closing_time_str = lottery.get("closing_time", "22:00")
            schedule = lottery.get("schedule", [])
            
            # Determine the last draw time for today
            last_draw_time = None
            if schedule:
                for draw_time_str in sorted(schedule, reverse=True):
                    try:
                        parts = draw_time_str.split(":")
                        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                        draw_dt = dr_now.replace(hour=h, minute=m, second=0, microsecond=0)
                        if draw_dt < dr_now:
                            last_draw_time = draw_dt
                            break
                    except (ValueError, IndexError):
                        continue
            
            # Use closing_time as fallback
            if not last_draw_time and closing_time_str:
                try:
                    parts = closing_time_str.split(":")
                    h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                    close_dt = dr_now.replace(hour=h, minute=m, second=0, microsecond=0)
                    if close_dt < dr_now:
                        last_draw_time = close_dt
                except (ValueError, IndexError):
                    pass
            
            if not last_draw_time:
                continue
            
            # Convert back to UTC for MongoDB query
            cutoff_utc = last_draw_time - DR_OFFSET
            
            # Today start in UTC (based on DR day)
            dr_today_start = dr_now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_start_utc = dr_today_start - DR_OFFSET
            
            # Mark single-play tickets as lost (where lottery_id matches)
            result = await db.tickets.update_many(
                {
                    "lottery_id": lottery_id,
                    "status": TicketStatus.PENDING.value,
                    "created_at": {"$gte": today_start_utc, "$lte": cutoff_utc}
                },
                {"$set": {"status": TicketStatus.LOST.value}}
            )
            if result.modified_count > 0:
                total_expired += result.modified_count
                logger.info(f"  Expired {result.modified_count} single tickets for {lottery_name}")
            
            # Mark multi-play tickets as lost (where lottery_id is in plays)
            result2 = await db.tickets.update_many(
                {
                    "ticket_type": "multi_play",
                    "status": TicketStatus.PENDING.value,
                    "plays.lottery_id": lottery_id,
                    "created_at": {"$gte": today_start_utc, "$lte": cutoff_utc}
                },
                {"$set": {"status": TicketStatus.LOST.value}}
            )
            if result2.modified_count > 0:
                total_expired += result2.modified_count
                logger.info(f"  Expired {result2.modified_count} multi-play tickets for {lottery_name}")
        
        # Safety net: Mark ALL pending tickets older than 24 hours as lost
        cutoff_24h = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
        old_result = await db.tickets.update_many(
            {
                "status": TicketStatus.PENDING.value,
                "created_at": {"$lt": cutoff_24h}
            },
            {"$set": {"status": TicketStatus.LOST.value}}
        )
        if old_result.modified_count > 0:
            total_expired += old_result.modified_count
            logger.info(f"  Expired {old_result.modified_count} tickets older than 24 hours")
        
        if total_expired > 0:
            logger.info(f"Ticket expiry complete: {total_expired} tickets marked as lost")
        
    except Exception as e:
        logger.error(f"Error in ticket expiry job: {e}", exc_info=True)
