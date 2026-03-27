"""
Automatic Lottery Results Scheduler
Fetches lottery results automatically every 5-10 minutes and processes winning tickets.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from services.lottery_scraper import get_scraper, LotteryResult

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None
_is_running = False

# Store last fetched results to detect new draws
_last_results: Dict[str, LotteryResult] = {}
_last_fetch_time: Optional[datetime] = None


def determine_play_win(play, first_prize, second_prize, third_prize, lottery_play_types):
    """
    Determine if a play wins based on its type and the winning numbers.
    
    Rules:
    - quiniela (1 number): wins if the number matches any prize position
    - pale (2 numbers): wins if BOTH numbers appear among the 3 prizes
    - tripleta (3 numbers): wins if ALL 3 numbers match the 3 prizes (any order)
    - super_pale (2 numbers): same logic as pale, different multipliers
    
    Returns: (won: bool, position: str, prize_amount: float)
    """
    play_type = play.get("lottery_type", "quiniela").lower()
    numbers = play.get("numbers", [])
    amount = play.get("amount", 0)
    
    # Get multipliers for this specific play type from lottery config
    type_config = lottery_play_types.get(play_type, {})
    multipliers = type_config.get("multipliers", {})
    
    # Fallback multipliers if not configured
    if not multipliers:
        default_multipliers = {
            "quiniela": {"first": 70, "second": 20, "third": 10},
            "pale": {"first": 1000, "second": 100, "third": 50},
            "tripleta": {"first": 50000, "second": 5000, "third": 2500},
            "super_pale": {"first": 2500, "second": 250, "third": 125},
        }
        multipliers = default_multipliers.get(play_type, {"first": 70, "second": 20, "third": 10})
    
    # Build the set of winning numbers (non-None values)
    winning_set = set()
    if first_prize is not None:
        winning_set.add(first_prize)
    if second_prize is not None:
        winning_set.add(second_prize)
    if third_prize is not None:
        winning_set.add(third_prize)
    
    if play_type == "quiniela":
        # Single number: check against each prize position
        if len(numbers) >= 1:
            num = numbers[0]
            if num == first_prize:
                return True, "primera", amount * multipliers.get("first", 70)
            elif num == second_prize:
                return True, "segunda", amount * multipliers.get("second", 20)
            elif num == third_prize:
                return True, "tercera", amount * multipliers.get("third", 10)
        return False, None, 0
    
    elif play_type in ("pale", "super_pale"):
        # Both numbers must appear among the winning numbers
        if len(numbers) >= 2 and all(n in winning_set for n in numbers):
            # Determine which prize positions matched to select correct multiplier
            matched_positions = set()
            for n in numbers:
                if n == first_prize:
                    matched_positions.add("first")
                elif n == second_prize:
                    matched_positions.add("second")
                elif n == third_prize:
                    matched_positions.add("third")
            
            # Pale primera+segunda = best, primera+tercera = medium, segunda+tercera = lowest
            if "first" in matched_positions and "second" in matched_positions:
                tier = "first"
                pos = "primera"
            elif "first" in matched_positions and "third" in matched_positions:
                tier = "second"
                pos = "primera"
            else:  # segunda + tercera
                tier = "third"
                pos = "segunda"
            
            return True, pos, amount * multipliers.get(tier, 1000)
        return False, None, 0
    
    elif play_type == "tripleta":
        # All 3 numbers must match the 3 prizes (any order) for first tier
        # If only 2 out of 3 match, second tier applies
        if len(numbers) >= 3 and first_prize is not None and second_prize is not None and third_prize is not None:
            if set(numbers) == winning_set:
                # All 3 match - first tier
                return True, "primera", amount * multipliers.get("first", 10000)
            else:
                # Check if 2 out of 3 match (partial tripleta)
                matches = len(set(numbers).intersection(winning_set))
                if matches >= 2:
                    return True, "segunda", amount * multipliers.get("second", 150)
        elif len(numbers) >= 3 and first_prize is not None and second_prize is not None:
            # Only 2 prizes available, check if 2 numbers match
            partial_set = {first_prize, second_prize}
            matches = len(set(numbers).intersection(partial_set))
            if matches >= 2:
                return True, "segunda", amount * multipliers.get("second", 150)
        return False, None, 0
    
    return False, None, 0


async def process_new_results(db, validated_result: LotteryResult, lottery_doc: dict):
    """Process a validated lottery result and update winning tickets.
    
    Handles both simple (single-play) tickets and multi-play tickets.
    Multi-play tickets have plays in multiple lotteries and should only be 
    marked as lost when ALL their lotteries have been drawn.
    """
    from models.enums import TicketStatus, TransactionType
    from services.notifications import notify_winner, notify_draw_complete, notify_client_winner
    import uuid
    
    lottery_id = lottery_doc["id"]
    lottery_name = lottery_doc["name"]
    first_prize = validated_result.first_prize
    second_prize = validated_result.second_prize
    third_prize = validated_result.third_prize
    play_types_config = lottery_doc.get("play_types", {})
    currency = lottery_doc.get("currency", "RD$")
    
    # Create the draw record
    draw = {
        "id": str(uuid.uuid4()),
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "winning_numbers": [first_prize],
        "first_prize": first_prize,
        "second_prize": second_prize,
        "third_prize": third_prize,
        "position": "primera",
        "draw_time": datetime.now(timezone.utc),
        "draw_date": validated_result.draw_date,
        "total_tickets": 0,
        "total_winners": 0,
        "total_paid": 0.0,
        "currency": currency,
        "is_manual": False,
        "is_automated": True,
        "source": validated_result.source,
        "validated": validated_result.validated,
        "validation_sources": validated_result.validation_sources
    }
    
    total_winners = 0
    total_paid = 0.0
    winner_notifications = []
    client_winner_notifications = []
    
    # Load country-specific prize configs from DB
    country_configs = {}
    async for config in db.prize_config.find({}, {"_id": 0}):
        country_configs[config.get("country", "RD")] = config
    
    def get_play_types_for_country(seller_country):
        """Get multipliers based on seller's country, fallback to lottery config"""
        cc = country_configs.get(seller_country)
        if cc:
            result = {}
            for ptype in ("quiniela", "pale", "tripleta", "super_pale"):
                if ptype in cc:
                    result[ptype] = {"multipliers": cc[ptype]}
            if result:
                return result
        return play_types_config
    
    # Get default quiniela multipliers for simple tickets (fallback)
    quiniela_config = play_types_config.get("quiniela", {})
    quiniela_multipliers = quiniela_config.get("multipliers", {"first": 70, "second": 20, "third": 10})
    
    # ═══════════════════════════════════════════════════════════════
    # STEP 1: Process SIMPLE seller tickets (non multi-play)
    # These have lottery_id and numbers at the top level
    # ═══════════════════════════════════════════════════════════════
    for position, prize_number, tier_key in [
        ("primera", first_prize, "first"),
        ("segunda", second_prize, "second"),
        ("tercera", third_prize, "third")
    ]:
        if prize_number is None:
            continue
        
        # Only match simple tickets (not multi-play) with top-level lottery_id and numbers
        ticket_query = {
            "lottery_id": lottery_id,
            "status": TicketStatus.PENDING.value,
            "numbers": prize_number,
            "ticket_type": {"$ne": "multi_play"},
            "client_id": {"$exists": False}
        }
        
        matching_tickets = await db.tickets.find(ticket_query).to_list(10000)
        
        for ticket in matching_tickets:
            # Use country-specific multipliers
            seller_country = ticket.get("seller_country") or ticket.get("country", "RD")
            ticket_play_types = get_play_types_for_country(seller_country)
            ticket_q_config = ticket_play_types.get("quiniela", {})
            ticket_q_mults = ticket_q_config.get("multipliers", quiniela_multipliers)
            multiplier = ticket_q_mults.get(tier_key, 70)
            
            prize = ticket.get("amount", 0) * multiplier
            
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {
                    "status": TicketStatus.WON.value,
                    "draw_id": draw["id"],
                    "potential_win": prize,
                    "won_position": position,
                    "automated_result": True
                }}
            )
            total_winners += 1
            total_paid += prize
            
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ticket["seller_id"],
                "user_name": ticket["seller_name"],
                "transaction_type": TransactionType.WIN.value,
                "amount": prize,
                "currency": ticket.get("currency", currency),
                "description": f"Premio {position} (Auto) - {lottery_name} - {ticket['numbers']}",
                "reference_id": ticket["id"],
                "created_at": datetime.now(timezone.utc)
            })
            
            winner_notifications.append({
                "user_id": ticket["seller_id"],
                "ticket_number": ticket["ticket_number"],
                "prize": prize
            })
    
    # ═══════════════════════════════════════════════════════════════
    # STEP 2: Process MULTI-PLAY seller tickets
    # These have plays[] array where each play has its own lottery_id
    # ═══════════════════════════════════════════════════════════════
    multi_play_query = {
        "ticket_type": "multi_play",
        "status": {"$in": [TicketStatus.PENDING.value, TicketStatus.WON.value]},
        "plays.lottery_id": lottery_id,
        "client_id": {"$exists": False}
    }
    
    multi_play_tickets = await db.tickets.find(multi_play_query).to_list(10000)
    logger.info(f"Found {len(multi_play_tickets)} multi-play seller tickets with plays for {lottery_name}")
    
    for ticket in multi_play_tickets:
        ticket_won_any = False
        ticket_total_prize = ticket.get("potential_win", 0) or 0  # Keep existing wins from other lotteries
        winning_plays_info = []
        plays = ticket.get("plays", [])
        plays_updated = False
        
        # Use country-specific multipliers for this ticket
        seller_country = ticket.get("seller_country") or ticket.get("country", "RD")
        ticket_play_types = get_play_types_for_country(seller_country)
        
        for i, play in enumerate(plays):
            # Only check plays for THIS lottery that haven't been resolved yet
            if play.get("lottery_id") != lottery_id:
                continue
            if play.get("play_result") in ("won", "lost"):
                continue  # Already resolved by a previous draw
            
            won, position, prize = determine_play_win(
                play, first_prize, second_prize, third_prize, ticket_play_types
            )
            
            if won:
                plays[i]["play_result"] = "won"
                plays[i]["won_position"] = position
                plays[i]["won_prize"] = prize
                plays[i]["draw_id"] = draw["id"]
                ticket_won_any = True
                ticket_total_prize += prize
                plays_updated = True
                
                winning_plays_info.append({
                    "play_index": i,
                    "lottery_name": play.get("lottery_name", lottery_name),
                    "numbers": play.get("numbers", []),
                    "prize": prize,
                    "position": position
                })
                
                logger.info(
                    f"  WINNER: Ticket {ticket['ticket_number']} play #{i+1} "
                    f"({play.get('lottery_type','?')}) {play.get('numbers',[])} "
                    f"won {position} = {currency} {prize:,.2f}"
                )
            else:
                # Mark this play as lost for this lottery
                plays[i]["play_result"] = "lost"
                plays[i]["draw_id"] = draw["id"]
                plays_updated = True
        
        if plays_updated:
            update_fields = {"plays": plays}
            
            if ticket_won_any:
                update_fields["status"] = TicketStatus.WON.value
                update_fields["potential_win"] = ticket_total_prize
                update_fields["automated_result"] = True
                update_fields["draw_id"] = draw["id"]
                total_winners += 1
                total_paid += sum(wp["prize"] for wp in winning_plays_info)
                
                # Create transactions for each winning play
                for wp in winning_plays_info:
                    await db.transactions.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": ticket["seller_id"],
                        "user_name": ticket["seller_name"],
                        "transaction_type": TransactionType.WIN.value,
                        "amount": wp["prize"],
                        "currency": ticket.get("currency", currency),
                        "description": f"Premio {wp['position']} (Auto) - {wp['lottery_name']} - {wp['numbers']}",
                        "reference_id": ticket["id"],
                        "created_at": datetime.now(timezone.utc)
                    })
                
                winner_notifications.append({
                    "user_id": ticket["seller_id"],
                    "ticket_number": ticket["ticket_number"],
                    "prize": sum(wp["prize"] for wp in winning_plays_info)
                })
            else:
                # Check if ALL plays in this ticket have been resolved
                all_resolved = all(p.get("play_result") in ("won", "lost") for p in plays)
                if all_resolved and ticket.get("status") != TicketStatus.WON.value:
                    # All plays resolved and none won -> ticket is lost
                    update_fields["status"] = TicketStatus.LOST.value
                    update_fields["draw_id"] = draw["id"]
                # If not all resolved, keep ticket as pending (other lotteries haven't drawn yet)
            
            await db.tickets.update_one({"id": ticket["id"]}, {"$set": update_fields})
    
    # ═══════════════════════════════════════════════════════════════
    # STEP 3: Process CLIENT tickets (both simple and multi-play)
    # ═══════════════════════════════════════════════════════════════
    
    # 3a: Simple client tickets
    for position, prize_number, tier_key in [
        ("primera", first_prize, "first"),
        ("segunda", second_prize, "second"),
        ("tercera", third_prize, "third")
    ]:
        if prize_number is None:
            continue
        
        client_simple_query = {
            "lottery_id": lottery_id,
            "status": TicketStatus.PENDING.value,
            "numbers": prize_number,
            "ticket_type": {"$ne": "multi_play"},
            "client_id": {"$exists": True}
        }
        
        client_simple_tickets = await db.tickets.find(client_simple_query).to_list(10000)
        multiplier = quiniela_multipliers.get(tier_key, 70)
        
        for ticket in client_simple_tickets:
            prize = ticket.get("amount", 0) * multiplier
            await db.tickets.update_one(
                {"id": ticket["id"]},
                {"$set": {
                    "status": TicketStatus.WON.value,
                    "draw_id": draw["id"],
                    "potential_win": prize,
                    "won_position": position,
                    "automated_result": True
                }}
            )
            total_winners += 1
            total_paid += prize
            client_winner_notifications.append({
                "client_id": ticket["client_id"],
                "ticket_number": ticket.get("ticket_number", ""),
                "prize": prize,
                "lottery_name": lottery_name
            })
    
    # 3b: Multi-play client tickets
    client_multi_query = {
        "ticket_type": "multi_play",
        "status": {"$in": [TicketStatus.PENDING.value, TicketStatus.WON.value]},
        "plays.lottery_id": lottery_id,
        "client_id": {"$exists": True}
    }
    
    client_multi_tickets = await db.tickets.find(client_multi_query).to_list(10000)
    
    for ticket in client_multi_tickets:
        ticket_won_any = False
        ticket_total_prize = ticket.get("potential_win", 0) or 0
        plays = ticket.get("plays", [])
        plays_updated = False
        
        # Use country-specific multipliers for client tickets too
        client_country = ticket.get("seller_country") or ticket.get("country", "RD")
        client_ticket_play_types = get_play_types_for_country(client_country)
        
        for i, play in enumerate(plays):
            if play.get("lottery_id") != lottery_id:
                continue
            if play.get("play_result") in ("won", "lost"):
                continue
            
            won, position, prize = determine_play_win(
                play, first_prize, second_prize, third_prize, client_ticket_play_types
            )
            
            if won:
                plays[i]["play_result"] = "won"
                plays[i]["won_prize"] = prize
                plays[i]["draw_id"] = draw["id"]
                ticket_won_any = True
                ticket_total_prize += prize
                plays_updated = True
                
                client_winner_notifications.append({
                    "client_id": ticket["client_id"],
                    "ticket_number": ticket.get("ticket_number", ""),
                    "prize": prize,
                    "lottery_name": lottery_name
                })
            else:
                plays[i]["play_result"] = "lost"
                plays[i]["draw_id"] = draw["id"]
                plays_updated = True
        
        if plays_updated:
            update_fields = {"plays": plays}
            if ticket_won_any:
                update_fields["status"] = TicketStatus.WON.value
                update_fields["potential_win"] = ticket_total_prize
                update_fields["automated_result"] = True
                total_winners += 1
                total_paid += ticket_total_prize - (ticket.get("potential_win", 0) or 0)
            else:
                all_resolved = all(p.get("play_result") in ("won", "lost") for p in plays)
                if all_resolved and ticket.get("status") != TicketStatus.WON.value:
                    update_fields["status"] = TicketStatus.LOST.value
                    update_fields["draw_id"] = draw["id"]
            
            await db.tickets.update_one({"id": ticket["id"]}, {"$set": update_fields})
    
    # ═══════════════════════════════════════════════════════════════
    # STEP 4: Mark remaining SIMPLE tickets as lost
    # IMPORTANT: Only mark simple tickets, NOT multi-play tickets
    # Multi-play tickets are handled per-play above
    # ═══════════════════════════════════════════════════════════════
    await db.tickets.update_many(
        {
            "lottery_id": lottery_id,
            "status": TicketStatus.PENDING.value,
            "ticket_type": {"$ne": "multi_play"}
        },
        {"$set": {"status": TicketStatus.LOST.value, "draw_id": draw["id"]}}
    )
    
    # Update draw totals
    draw["total_winners"] = total_winners
    draw["total_paid"] = total_paid
    
    # Save draw
    await db.draws.insert_one(draw)
    
    # Create draw result notification for all users
    notification = {
        "id": str(uuid.uuid4()),
        "type": "draw_result",
        "lottery_id": lottery_id,
        "lottery_name": lottery_name,
        "winning_numbers": [first_prize, second_prize, third_prize],
        "first_prize": first_prize,
        "second_prize": second_prize,
        "third_prize": third_prize,
        "total_winners": total_winners,
        "is_automated": True,
        "created_at": datetime.now(timezone.utc),
        "read_by": []
    }
    await db.notifications.insert_one(notification)
    
    # Send winner notifications
    for winner in winner_notifications:
        seller_notification = {
            "id": str(uuid.uuid4()),
            "type": "winner_alert",
            "user_id": winner["user_id"],
            "lottery_id": lottery_id,
            "lottery_name": lottery_name,
            "ticket_number": winner["ticket_number"],
            "prize_amount": winner["prize"],
            "currency": currency,
            "message": f"GANADOR! Boleto {winner['ticket_number']} gano {currency} {winner['prize']:,.2f}",
            "is_automated": True,
            "created_at": datetime.now(timezone.utc),
            "read": False
        }
        await db.notifications.insert_one(seller_notification)
        
        await notify_winner(
            winner["user_id"],
            winner["ticket_number"],
            winner["prize"],
            currency,
            lottery_name
        )
    
    # Send CLIENT winner notifications
    for client_winner in client_winner_notifications:
        await notify_client_winner(
            client_winner["client_id"],
            client_winner["ticket_number"],
            client_winner["prize"],
            client_winner["lottery_name"]
        )
        
        await db.users.update_one(
            {"id": client_winner["client_id"]},
            {"$inc": {"total_won": client_winner["prize"]}}
        )
        
        logger.info(f"Client winner notification sent: {client_winner['ticket_number']} - ${client_winner['prize']}")
    
    # Send draw complete notification to admins
    await notify_draw_complete(
        lottery_name,
        [first_prize, second_prize, third_prize],
        total_winners,
        total_paid,
        currency
    )
    
    logger.info(f"Processed draw for {lottery_name}: {total_winners} winners, {total_paid} paid")
    return draw


async def check_and_process_results():
    """Main job: Fetch results and process any new draws"""
    global _last_results, _last_fetch_time
    
    from utils.database import get_db
    from services.notifications import notify_new_lottery_results
    
    logger.info("🔄 Starting automatic lottery results check...")
    
    try:
        db = get_db()
        scraper = get_scraper()
        
        # Fetch latest results from all sources
        current_results = await scraper.fetch_all_results()
        _last_fetch_time = datetime.now(timezone.utc)
        
        if not current_results:
            logger.warning("No results fetched from any source")
            return
        
        # Get all active lotteries from DB
        active_lotteries = await db.lotteries.find({"active": True}).to_list(100)
        
        # Create comprehensive mapping of lottery names to DB records
        # This maps various name variations to the actual lottery document
        lottery_map = {}
        for lot in active_lotteries:
            name_lower = lot["name"].lower()
            lottery_map[name_lower] = lot
            
            # Create variations
            # "Quiniela Leidsa" -> "leidsa", "quiniela leidsa"
            # "Lotería Nacional" -> "nacional", "loteria nacional"
            words = name_lower.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").split()
            for word in words:
                if word not in ["quiniela", "loteria", "lotería", "la", "de", "el"]:
                    lottery_map[word] = lot
            
            # Add specific mappings based on lottery name patterns
            if "leidsa" in name_lower:
                lottery_map["leidsa"] = lot
            if "nacional" in name_lower and "gana" not in name_lower:
                lottery_map["nacional"] = lot
            if "gana" in name_lower and "mas" in name_lower.replace("á", "a"):
                lottery_map["gana_mas"] = lot
            if "real" in name_lower:
                lottery_map["real"] = lot
            if "loteka" in name_lower:
                lottery_map["loteka"] = lot
            if "lotedom" in name_lower:
                lottery_map["lotedom"] = lot
            if "pega" in name_lower and "3" in name_lower:
                lottery_map["pega_3_mas"] = lot
            if "florida" in name_lower:
                if "día" in name_lower or "dia" in name_lower or "day" in name_lower:
                    lottery_map["florida_dia"] = lot
                elif "noche" in name_lower or "night" in name_lower:
                    lottery_map["florida_noche"] = lot
                else:
                    lottery_map["florida"] = lot
            if "new york" in name_lower or "ny" in name_lower:
                if "tarde" in name_lower or "midday" in name_lower:
                    lottery_map["new_york_tarde"] = lot
                elif "noche" in name_lower or "evening" in name_lower or "night" in name_lower:
                    lottery_map["new_york_noche"] = lot
            # La Primera - check before Leidsa to avoid conflicts
            if "primera" in name_lower:
                if "día" in name_lower or "dia" in name_lower:
                    lottery_map["la_primera_dia"] = lot
                    lottery_map["primera_dia"] = lot  # Alternative key
                elif "noche" in name_lower:
                    lottery_map["la_primera_noche"] = lot
                    lottery_map["primera_noche"] = lot  # Alternative key
                else:
                    lottery_map["la_primera"] = lot
            if "suerte" in name_lower:
                if "12:30" in name_lower or "1230" in name_lower:
                    lottery_map["la_suerte_1230"] = lot
                elif "18:00" in name_lower or "1800" in name_lower:
                    lottery_map["la_suerte_1800"] = lot
                else:
                    lottery_map["la_suerte"] = lot
            if "anguila" in name_lower or "anguilla" in name_lower:
                if "mañana" in name_lower or "manana" in name_lower:
                    lottery_map["anguila_manana"] = lot
                elif "medio" in name_lower or "mediodía" in name_lower or "mediodia" in name_lower:
                    lottery_map["anguila_mediodia"] = lot
                elif "tarde" in name_lower:
                    lottery_map["anguila_tarde"] = lot
                elif "noche" in name_lower:
                    lottery_map["anguila_noche"] = lot
                else:
                    lottery_map["anguila"] = lot
            if "king" in name_lower:
                if "12:30" in name_lower or "1230" in name_lower:
                    lottery_map["king_lottery_1230"] = lot
                elif "7:30" in name_lower or "19:30" in name_lower or "730" in name_lower:
                    lottery_map["king_lottery_1930"] = lot
                else:
                    lottery_map["king_lottery"] = lot
        
        logger.info(f"Lottery map created with {len(lottery_map)} entries for {len(active_lotteries)} active lotteries")
        
        # Lotteries that don't require cross-validation (unique sources)
        SINGLE_SOURCE_LOTTERIES = [
            # American lotteries
            "florida_dia", "florida_noche", "florida",
            "new_york_tarde", "new_york_noche", "new_york",
            # Anguila (unique source)
            "anguila", "anguila_manana", "anguila_mediodia", "anguila_tarde", "anguila_noche",
            # King Lottery
            "king_lottery", "king_lottery_1230", "king_lottery_1930",
            # La Primera
            "la_primera", "la_primera_dia", "la_primera_noche",
            # La Suerte
            "la_suerte", "la_suerte_1230", "la_suerte_1800",
            # Gana Más
            "gana_mas",
            # Pega 3 Más
            "pega_3_mas",
        ]
        
        # Track new results for push notification
        new_results_for_notification = []
        
        # Process each result
        for lottery_key, result in current_results.items():
            # Check if validation is required
            requires_validation = lottery_key not in SINGLE_SOURCE_LOTTERIES
            
            if requires_validation and not result.validated:
                logger.debug(f"Skipping unvalidated result for {lottery_key}")
                continue
            
            # For single-source lotteries, mark as validated with single source
            if not requires_validation and not result.validated:
                result.validated = True
                logger.info(f"✓ Accepting single-source result for {lottery_key}: {result.first_prize}-{result.second_prize}-{result.third_prize}")
            
            # Find matching lottery in DB with improved matching
            matching_lottery = None
            
            # Direct match first
            if lottery_key in lottery_map:
                matching_lottery = lottery_map[lottery_key]
            else:
                # Try partial matching
                for db_key, lot_doc in lottery_map.items():
                    if lottery_key in db_key or db_key in lottery_key:
                        matching_lottery = lot_doc
                        break
                    # Check if any word matches
                    lottery_words = lottery_key.replace("_", " ").split()
                    db_words = db_key.replace("_", " ").split()
                    for lw in lottery_words:
                        if lw in db_words or any(lw in dw for dw in db_words):
                            matching_lottery = lot_doc
                            break
                    if matching_lottery:
                        break
            
            if not matching_lottery:
                logger.debug(f"No matching lottery in DB for: {lottery_key}")
                continue
            
            lottery_id = matching_lottery["id"]
            
            # Check if this is a new result (different from last fetch)
            last_result = _last_results.get(lottery_key)
            is_new = (
                last_result is None or 
                not result.matches(last_result)
            )
            
            if is_new:
                # Check if we already have a draw with these exact numbers today
                today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
                existing_draw = await db.draws.find_one({
                    "lottery_id": lottery_id,
                    "first_prize": result.first_prize,
                    "second_prize": result.second_prize,
                    "third_prize": result.third_prize,
                    "draw_time": {"$gte": today_start}
                })
                
                if existing_draw:
                    logger.info(f"Draw already exists for {lottery_key} with these numbers")
                    _last_results[lottery_key] = result
                    continue
                
                logger.info(f"🆕 New validated result for {lottery_key}: {result.first_prize}-{result.second_prize}-{result.third_prize}")
                
                # Process the new result
                try:
                    await process_new_results(db, result, matching_lottery)
                    _last_results[lottery_key] = result
                    
                    # Add to list for push notification
                    new_results_for_notification.append({
                        "lottery_name": matching_lottery["name"],
                        "first": result.first_prize,
                        "second": result.second_prize,
                        "third": result.third_prize
                    })
                except Exception as e:
                    logger.error(f"Error processing result for {lottery_key}: {e}")
            else:
                logger.debug(f"No change in {lottery_key} results")
        
        # Send push notification to all users about new results
        if new_results_for_notification:
            logger.info(f"📢 Sending push notifications for {len(new_results_for_notification)} new results")
            await notify_new_lottery_results(new_results_for_notification)
        
        logger.info(f"✅ Results check completed. {len(current_results)} lotteries checked.")
        
    except Exception as e:
        logger.error(f"Error in automatic results check: {e}", exc_info=True)


def start_scheduler(interval_minutes: int = 5):
    """Start the automatic results scheduler"""
    global _scheduler, _is_running
    
    if _is_running:
        logger.info("Scheduler already running")
        return
    
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        check_and_process_results,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="lottery_results_checker",
        name="Check Lottery Results",
        replace_existing=True,
        max_instances=1
    )
    
    try:
        _scheduler.start()
        _is_running = True
        logger.info(f"🚀 Lottery results scheduler started (interval: {interval_minutes} minutes)")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def stop_scheduler():
    """Stop the automatic results scheduler"""
    global _scheduler, _is_running
    
    if _scheduler:
        _scheduler.shutdown()
        _scheduler = None
        _is_running = False
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Get current scheduler status"""
    global _scheduler, _is_running, _last_fetch_time, _last_results
    
    return {
        "is_running": _is_running,
        "last_fetch_time": _last_fetch_time.isoformat() if _last_fetch_time else None,
        "last_results_count": len(_last_results),
        "last_results": {k: v.to_dict() for k, v in _last_results.items()}
    }
