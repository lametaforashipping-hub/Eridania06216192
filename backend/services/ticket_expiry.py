"""
Ticket Expiry Service
Automatically marks old pending tickets as 'lost' after their lottery's closing time has passed.
Handles multi-play tickets correctly: only marks as lost when ALL lotteries have closed.
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
    
    For SIMPLE tickets: mark as lost when that lottery's last draw is past.
    For MULTI-PLAY tickets: only mark as lost when ALL lotteries in the ticket have closed.
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
            {"_id": 0, "id": 1, "name": 1, "closing_time": 1, "schedule": 1}
        ).to_list(100)
        
        # Build a map of lottery_id -> has_closed_today
        lottery_closed_map = {}
        for lottery in lotteries:
            lottery_id = lottery["id"]
            schedule = lottery.get("schedule", [])
            closing_time_str = lottery.get("closing_time", "22:00")
            
            # Check if the last draw time for today has passed
            last_draw_passed = False
            if schedule:
                for draw_time_str in sorted(schedule, reverse=True):
                    try:
                        parts = draw_time_str.split(":")
                        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                        draw_dt = dr_now.replace(hour=h, minute=m, second=0, microsecond=0)
                        if draw_dt < dr_now:
                            last_draw_passed = True
                            break
                    except (ValueError, IndexError):
                        continue
            
            # Fallback: use closing_time
            if not last_draw_passed and closing_time_str:
                try:
                    parts = closing_time_str.split(":")
                    h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
                    close_dt = dr_now.replace(hour=h, minute=m, second=0, microsecond=0)
                    if close_dt < dr_now:
                        last_draw_passed = True
                except (ValueError, IndexError):
                    pass
            
            lottery_closed_map[lottery_id] = last_draw_passed
        
        total_expired = 0
        
        # DR today start in UTC
        dr_today_start = dr_now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = dr_today_start - DR_OFFSET
        
        # ═══════════════════════════════════════════════════
        # STEP 1: Expire SIMPLE tickets (not multi-play)
        # ═══════════════════════════════════════════════════
        for lottery in lotteries:
            lottery_id = lottery["id"]
            if not lottery_closed_map.get(lottery_id, False):
                continue
            
            schedule = lottery.get("schedule", [])
            last_draw_time = None
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
            
            if not last_draw_time:
                continue
            
            cutoff_utc = last_draw_time - DR_OFFSET
            
            result = await db.tickets.update_many(
                {
                    "lottery_id": lottery_id,
                    "status": TicketStatus.PENDING.value,
                    "ticket_type": {"$ne": "multi_play"},
                    "created_at": {"$gte": today_start_utc, "$lte": cutoff_utc}
                },
                {"$set": {"status": TicketStatus.LOST.value}}
            )
            if result.modified_count > 0:
                total_expired += result.modified_count
                logger.info(f"  Expired {result.modified_count} simple tickets for {lottery['name']}")
        
        # ═══════════════════════════════════════════════════
        # STEP 2: Expire MULTI-PLAY tickets
        # Only mark as lost when ALL lotteries in the ticket have closed
        # ═══════════════════════════════════════════════════
        pending_multi = await db.tickets.find(
            {
                "ticket_type": "multi_play",
                "status": TicketStatus.PENDING.value,
                "created_at": {"$gte": today_start_utc}
            }
        ).to_list(10000)
        
        for ticket in pending_multi:
            plays = ticket.get("plays", [])
            if not plays:
                continue
            
            # Get unique lottery_ids from plays
            ticket_lottery_ids = set(p.get("lottery_id") for p in plays if p.get("lottery_id"))
            
            # Check if ALL lotteries in this ticket have closed
            all_closed = all(
                lottery_closed_map.get(lid, False) for lid in ticket_lottery_ids
            )
            
            if all_closed:
                # All lotteries have drawn - if ticket is still pending, mark as lost
                await db.tickets.update_one(
                    {"id": ticket["id"], "status": TicketStatus.PENDING.value},
                    {"$set": {"status": TicketStatus.LOST.value}}
                )
                total_expired += 1
                logger.info(f"  Expired multi-play ticket {ticket.get('ticket_number', '?')} (all {len(ticket_lottery_ids)} lotteries closed)")
        
        # ═══════════════════════════════════════════════════
        # STEP 3: Safety net - tickets older than 24 hours
        # ═══════════════════════════════════════════════════
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
