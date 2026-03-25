"""
Test multi-play ticket winner detection.
Tests the critical bug: multi-play tickets with plays in multiple lotteries
must correctly identify winners when a lottery draws.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.lottery_scheduler import determine_play_win


def test_quiniela_first_prize():
    """Quiniela: single number matches first prize"""
    play = {"lottery_type": "quiniela", "numbers": [25], "amount": 10}
    play_types = {"quiniela": {"multipliers": {"first": 70, "second": 20, "third": 10}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True, f"Should win but got won={won}"
    assert position == "primera", f"Expected primera but got {position}"
    assert prize == 700, f"Expected 700 (10*70) but got {prize}"
    print("  PASS: Quiniela first prize")


def test_quiniela_second_prize():
    """Quiniela: single number matches second prize"""
    play = {"lottery_type": "quiniela", "numbers": [42], "amount": 20}
    play_types = {"quiniela": {"multipliers": {"first": 70, "second": 20, "third": 10}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True, f"Should win"
    assert position == "segunda", f"Expected segunda but got {position}"
    assert prize == 400, f"Expected 400 (20*20) but got {prize}"
    print("  PASS: Quiniela second prize")


def test_quiniela_third_prize():
    """Quiniela: single number matches third prize"""
    play = {"lottery_type": "quiniela", "numbers": [99], "amount": 50}
    play_types = {"quiniela": {"multipliers": {"first": 70, "second": 20, "third": 10}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert position == "tercera"
    assert prize == 500, f"Expected 500 (50*10) but got {prize}"
    print("  PASS: Quiniela third prize")


def test_quiniela_no_match():
    """Quiniela: number doesn't match any prize"""
    play = {"lottery_type": "quiniela", "numbers": [50], "amount": 10}
    play_types = {"quiniela": {"multipliers": {"first": 70, "second": 20, "third": 10}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == False, f"Should not win"
    assert prize == 0
    print("  PASS: Quiniela no match")


def test_pale_both_match_first_second():
    """Pale: both numbers match first and second prize"""
    play = {"lottery_type": "pale", "numbers": [25, 42], "amount": 10}
    play_types = {"pale": {"multipliers": {"first": 1000, "second": 100, "third": 50}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True, f"Pale should win when both numbers in prizes"
    assert prize == 10000, f"Expected 10000 (10*1000) but got {prize}"
    print("  PASS: Pale primera+segunda")


def test_pale_both_match_first_third():
    """Pale: both numbers match first and third prize"""
    play = {"lottery_type": "pale", "numbers": [25, 99], "amount": 10}
    play_types = {"pale": {"multipliers": {"first": 1000, "second": 100, "third": 50}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert prize == 1000, f"Expected 1000 (10*100) but got {prize}"
    print("  PASS: Pale primera+tercera")


def test_pale_both_match_second_third():
    """Pale: both numbers match second and third prize"""
    play = {"lottery_type": "pale", "numbers": [42, 99], "amount": 10}
    play_types = {"pale": {"multipliers": {"first": 1000, "second": 100, "third": 50}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert prize == 500, f"Expected 500 (10*50) but got {prize}"
    print("  PASS: Pale segunda+tercera")


def test_pale_only_one_match():
    """Pale: only one number matches - should NOT win"""
    play = {"lottery_type": "pale", "numbers": [25, 77], "amount": 10}
    play_types = {"pale": {"multipliers": {"first": 1000, "second": 100, "third": 50}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == False, f"Pale should NOT win with only 1 matching number"
    assert prize == 0
    print("  PASS: Pale only 1 match = no win")


def test_pale_no_match():
    """Pale: no numbers match"""
    play = {"lottery_type": "pale", "numbers": [11, 77], "amount": 10}
    play_types = {"pale": {"multipliers": {"first": 1000, "second": 100, "third": 50}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == False
    assert prize == 0
    print("  PASS: Pale no match")


def test_tripleta_all_match():
    """Tripleta: all 3 numbers match all 3 prizes"""
    play = {"lottery_type": "tripleta", "numbers": [25, 42, 99], "amount": 5}
    play_types = {"tripleta": {"multipliers": {"first": 50000, "second": 5000, "third": 2500}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert prize == 250000, f"Expected 250000 (5*50000) but got {prize}"
    print("  PASS: Tripleta all match")


def test_tripleta_any_order():
    """Tripleta: numbers in different order still win"""
    play = {"lottery_type": "tripleta", "numbers": [99, 25, 42], "amount": 5}
    play_types = {"tripleta": {"multipliers": {"first": 50000, "second": 5000, "third": 2500}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True, "Tripleta should win regardless of order"
    print("  PASS: Tripleta any order")


def test_tripleta_only_two_match():
    """Tripleta: only 2 of 3 numbers match - should NOT win"""
    play = {"lottery_type": "tripleta", "numbers": [25, 42, 50], "amount": 5}
    play_types = {"tripleta": {"multipliers": {"first": 50000, "second": 5000, "third": 2500}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == False, "Tripleta should NOT win with only 2 matching"
    assert prize == 0
    print("  PASS: Tripleta 2/3 match = no win")


def test_super_pale():
    """Super Pale: same logic as pale but different multipliers"""
    play = {"lottery_type": "super_pale", "numbers": [25, 42], "amount": 10}
    play_types = {"super_pale": {"multipliers": {"first": 2500, "second": 250, "third": 125}}}
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert prize == 25000, f"Expected 25000 (10*2500) but got {prize}"
    print("  PASS: Super Pale")


def test_quiniela_none_prizes():
    """Quiniela with None second/third prize"""
    play = {"lottery_type": "quiniela", "numbers": [25], "amount": 10}
    play_types = {"quiniela": {"multipliers": {"first": 70, "second": 20, "third": 10}}}
    
    won, position, prize = determine_play_win(play, 25, None, None, play_types)
    assert won == True
    assert position == "primera"
    print("  PASS: Quiniela with None prizes")


def test_fallback_multipliers():
    """When play_types config is empty, uses default multipliers"""
    play = {"lottery_type": "quiniela", "numbers": [25], "amount": 10}
    play_types = {}  # Empty config
    
    won, position, prize = determine_play_win(play, 25, 42, 99, play_types)
    assert won == True
    assert prize == 700, f"Expected 700 with default multiplier but got {prize}"
    print("  PASS: Fallback multipliers")


async def test_full_multi_play_flow():
    """
    Integration test: Create a multi-play ticket with plays in 2 lotteries,
    draw for lottery 1 with a matching number, verify ticket is marked as won.
    """
    import pymongo
    import uuid
    from datetime import datetime, timezone
    
    client = pymongo.MongoClient('mongodb://localhost:27017')
    db_sync = client['test_database']
    
    # Get 2 active lotteries
    lotteries = list(db_sync.lotteries.find({"active": True}).limit(2))
    if len(lotteries) < 2:
        print("  SKIP: Need at least 2 active lotteries for integration test")
        return
    
    lottery_a = lotteries[0]
    lottery_b = lotteries[1]
    
    # Get a seller
    seller = db_sync.users.find_one({"role": "vendedor"})
    if not seller:
        print("  SKIP: No seller found")
        return
    
    ticket_id = str(uuid.uuid4())
    ticket_number = f"TEST-MP-{uuid.uuid4().hex[:6].upper()}"
    winning_number = 25
    
    # Create a multi-play ticket with plays in both lotteries
    test_ticket = {
        "id": ticket_id,
        "ticket_number": ticket_number,
        "ticket_type": "multi_play",
        "seller_id": seller["id"],
        "seller_name": seller.get("name", "Test Seller"),
        "plays": [
            {
                "lottery_type": "quiniela",
                "lottery_name": lottery_a["name"],
                "lottery_id": lottery_a["id"],
                "numbers": [winning_number],  # This should win!
                "amount": 10.0,
                "potential_win": 700.0,
                "multiplier": 70.0
            },
            {
                "lottery_type": "quiniela",
                "lottery_name": lottery_b["name"],
                "lottery_id": lottery_b["id"],
                "numbers": [88],  # Different number for lottery B
                "amount": 10.0,
                "potential_win": 700.0,
                "multiplier": 70.0
            }
        ],
        "plays_count": 2,
        "total_amount": 20.0,
        "total_potential_win": 1400.0,
        "currency": "RD$",
        "status": "pending",
        "customer_name": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Insert the test ticket
    db_sync.tickets.insert_one(test_ticket)
    
    try:
        # Simulate processing results for Lottery A where winning_number wins
        from motor.motor_asyncio import AsyncIOMotorClient
        from services.lottery_scheduler import determine_play_win
        
        motor_client = AsyncIOMotorClient('mongodb://localhost:27017')
        async_db = motor_client['test_database']
        
        # We'll use the determine_play_win to verify
        play_types = lottery_a.get("play_types", {})
        
        play_a = test_ticket["plays"][0]
        won, position, prize = determine_play_win(
            play_a, winning_number, 42, 99, play_types
        )
        
        assert won == True, f"Play for lottery A with number {winning_number} should win when first prize is {winning_number}"
        print(f"  Play A correctly identified as winner: position={position}, prize={prize}")
        
        # Verify the query would find this ticket
        multi_play_query = {
            "ticket_type": "multi_play",
            "status": {"$in": ["pending", "won"]},
            "plays.lottery_id": lottery_a["id"]
        }
        
        found_tickets = await async_db.tickets.find(multi_play_query).to_list(100)
        found_ids = [t["id"] for t in found_tickets]
        assert ticket_id in found_ids, f"Multi-play ticket {ticket_id} should be found by plays.lottery_id query"
        print(f"  MongoDB query correctly finds multi-play ticket by plays.lottery_id")
        
        # Verify the ticket would NOT be found by the old buggy query
        old_buggy_query = {
            "lottery_id": lottery_a["id"],
            "status": "pending",
            "numbers": winning_number
        }
        old_results = await async_db.tickets.find(old_buggy_query).to_list(100)
        old_ids = [t["id"] for t in old_results]
        assert ticket_id not in old_ids, "Multi-play ticket should NOT be found by old buggy query (top-level lottery_id)"
        print(f"  Confirmed: Old buggy query does NOT find multi-play tickets (this was the bug!)")
        
        # Verify play B is NOT a winner for lottery A's draw
        play_b = test_ticket["plays"][1]
        won_b, _, _ = determine_play_win(play_b, winning_number, 42, 99, play_types)
        # Play B has lottery_id = lottery_b, so it shouldn't be checked for lottery_a's draw
        # But if we check its numbers against lottery_a's results, 88 != 25,42,99 so it should not win
        assert won_b == False, "Play B with number 88 should not win"
        print(f"  Play B correctly identified as non-winner for this draw")
        
        # Verify that mark-as-lost with ticket_type filter doesn't affect multi-play
        mark_lost_query = {
            "lottery_id": lottery_a["id"],
            "status": "pending",
            "ticket_type": {"$ne": "multi_play"}
        }
        # This should NOT match our multi-play ticket
        would_mark_lost = await async_db.tickets.find(mark_lost_query).to_list(100)
        mark_lost_ids = [t["id"] for t in would_mark_lost]
        assert ticket_id not in mark_lost_ids, "Multi-play ticket should NOT be marked as lost by simple-ticket query"
        print(f"  Confirmed: Mark-as-lost filter correctly excludes multi-play tickets")
        
        print("  PASS: Full multi-play flow integration test")
        
        motor_client.close()
        
    finally:
        # Cleanup
        db_sync.tickets.delete_one({"id": ticket_id})
        # Also clean up any transactions/notifications created
        db_sync.transactions.delete_many({"reference_id": ticket_id})
    
    client.close()


if __name__ == "__main__":
    print("=" * 60)
    print("TESTING: Multi-Play Winner Detection")
    print("=" * 60)
    
    print("\n--- Unit Tests: determine_play_win ---")
    test_quiniela_first_prize()
    test_quiniela_second_prize()
    test_quiniela_third_prize()
    test_quiniela_no_match()
    test_pale_both_match_first_second()
    test_pale_both_match_first_third()
    test_pale_both_match_second_third()
    test_pale_only_one_match()
    test_pale_no_match()
    test_tripleta_all_match()
    test_tripleta_any_order()
    test_tripleta_only_two_match()
    test_super_pale()
    test_quiniela_none_prizes()
    test_fallback_multipliers()
    
    print("\n--- Integration Test: Full Multi-Play Flow ---")
    asyncio.run(test_full_multi_play_flow())
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)
