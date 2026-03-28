"""
Test the winning ticket flow - ensures winning tickets store proper details.
Run: cd /app/backend && python -m pytest tests/test_winning_flow.py -v
"""
import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

# Import the function under test
from services.lottery_scheduler import determine_play_win, process_new_results
from services.lottery_scraper import LotteryResult


def test_determine_play_win_quiniela_first():
    """Quiniela matching first prize"""
    play = {"lottery_type": "quiniela", "numbers": [42], "amount": 100}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert position == "primera"
    assert prize == 100 * 70  # default first multiplier


def test_determine_play_win_quiniela_second():
    """Quiniela matching second prize"""
    play = {"lottery_type": "quiniela", "numbers": [15], "amount": 100}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert position == "segunda"
    assert prize == 100 * 20  # default second multiplier


def test_determine_play_win_quiniela_third():
    """Quiniela matching third prize"""
    play = {"lottery_type": "quiniela", "numbers": [78], "amount": 100}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert position == "tercera"
    assert prize == 100 * 10


def test_determine_play_win_quiniela_no_match():
    """Quiniela not matching"""
    play = {"lottery_type": "quiniela", "numbers": [99], "amount": 100}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is False
    assert position is None
    assert prize == 0


def test_determine_play_win_pale_first_second():
    """Pale matching first and second prize"""
    play = {"lottery_type": "pale", "numbers": [42, 15], "amount": 50}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert prize == 50 * 1000  # first tier


def test_determine_play_win_pale_first_third():
    """Pale matching first and third prize"""
    play = {"lottery_type": "pale", "numbers": [42, 78], "amount": 50}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert prize == 50 * 100  # second tier


def test_determine_play_win_tripleta_all():
    """Tripleta matching all 3"""
    play = {"lottery_type": "tripleta", "numbers": [42, 15, 78], "amount": 10}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert position == "primera"
    assert prize == 10 * 50000


def test_determine_play_win_tripleta_partial():
    """Tripleta matching 2 of 3"""
    play = {"lottery_type": "tripleta", "numbers": [42, 15, 99], "amount": 10}
    won, position, prize = determine_play_win(play, 42, 15, 78, {})
    assert won is True
    assert position == "segunda"
    assert prize == 10 * 5000


def test_determine_play_win_with_custom_multipliers():
    """Test with custom US multipliers"""
    play = {"lottery_type": "quiniela", "numbers": [42], "amount": 100}
    custom_types = {
        "quiniela": {"multipliers": {"first": 60, "second": 12, "third": 4}}
    }
    won, position, prize = determine_play_win(play, 42, 15, 78, custom_types)
    assert won is True
    assert position == "primera"
    assert prize == 100 * 60  # custom first multiplier


class FakeCollection:
    """Mock MongoDB collection with basic query filtering"""
    def __init__(self, docs=None):
        self._docs = docs or []
        self._inserts = []
        self._updates = []
        self._last_query = None
    
    def find(self, query=None, projection=None):
        self._last_query = query or {}
        # Basic filtering: if query has client_id.$exists: True, filter for docs with client_id
        # If query has client_id.$exists: False, filter for docs without client_id
        filtered = self._docs
        if query:
            client_exists = query.get("client_id", {})
            if isinstance(client_exists, dict) and "$exists" in client_exists:
                if client_exists["$exists"]:
                    filtered = [d for d in self._docs if "client_id" in d]
                else:
                    filtered = [d for d in self._docs if "client_id" not in d]
            # Filter by ticket_type
            tt = query.get("ticket_type")
            if tt == "multi_play":
                filtered = [d for d in filtered if d.get("ticket_type") == "multi_play"]
            elif isinstance(tt, dict) and "$ne" in tt:
                filtered = [d for d in filtered if d.get("ticket_type") != tt["$ne"]]
        self._filtered = filtered
        return self
    
    async def find_one(self, query=None, projection=None):
        return None
    
    async def to_list(self, length=None):
        return getattr(self, '_filtered', self._docs)
    
    async def insert_one(self, doc):
        self._inserts.append(doc)
    
    async def update_one(self, filter_q, update):
        self._updates.append({"filter": filter_q, "update": update})
    
    async def update_many(self, filter_q, update):
        self._updates.append({"filter": filter_q, "update": update, "many": True})
    
    def __aiter__(self):
        return self._async_iter()
    
    async def _async_iter(self):
        for doc in self._docs:
            yield doc


class FakeDB:
    """Mock DB with collections"""
    def __init__(self):
        self.tickets = FakeCollection()
        self.draws = FakeCollection()
        self.transactions = FakeCollection()
        self.notifications = FakeCollection()
        self.users = FakeCollection()
        self.prize_config = FakeCollection()


def test_process_new_results_simple_ticket_stores_winning_info():
    """Test that simple winning tickets get winning_numbers and won_number stored"""
    from unittest.mock import patch, AsyncMock
    
    db = FakeDB()
    
    # Simple ticket matching first prize (number 42)
    simple_ticket = {
        "id": "ticket-001",
        "ticket_number": "T001",
        "lottery_id": "lot-1",
        "seller_id": "seller-1",
        "seller_name": "Test Seller",
        "numbers": 42,
        "amount": 100,
        "status": "pending",
        "currency": "RD$",
        "country": "RD"
    }
    db.tickets = FakeCollection([simple_ticket])
    
    result = LotteryResult(
        lottery_name="Test Lottery",
        first_prize=42,
        second_prize=15,
        third_prize=78,
        draw_date="2026-03-28",
        source="test"
    )
    
    lottery_doc = {
        "id": "lot-1",
        "name": "Test Lottery",
        "play_types": {},
        "currency": "RD$"
    }
    
    with patch("services.notifications.notify_winner", new_callable=AsyncMock), \
         patch("services.notifications.notify_draw_complete", new_callable=AsyncMock), \
         patch("services.notifications.notify_client_winner", new_callable=AsyncMock):
        loop = asyncio.new_event_loop()
        draw = loop.run_until_complete(process_new_results(db, result, lottery_doc))
        loop.close()
    
    # Check that the ticket update includes winning info
    ticket_updates = [u for u in db.tickets._updates if not u.get("many")]
    assert len(ticket_updates) >= 1
    
    update_set = ticket_updates[0]["update"]["$set"]
    assert update_set["won_number"] == 42, f"Expected won_number=42, got {update_set.get('won_number')}"
    assert update_set["winning_numbers"]["first"] == 42
    assert update_set["winning_numbers"]["second"] == 15
    assert update_set["winning_numbers"]["third"] == 78
    assert update_set["won_lottery_name"] == "Test Lottery"
    assert update_set["won_position"] == "primera"
    
    # Check transaction description includes prize amount
    tx = [t for t in db.transactions._inserts if t.get("transaction_type") == "win"]
    assert len(tx) >= 1
    assert "#42" in tx[0]["description"], f"Transaction should mention winning number: {tx[0]['description']}"
    assert "Ganó" in tx[0]["description"], f"Transaction should mention prize: {tx[0]['description']}"
    
    print("PASS: Simple ticket stores winning number, winning_numbers, and detailed transaction")


def test_process_new_results_multiplay_stores_winning_info():
    """Test that multi-play winning tickets get winning_numbers per play"""
    from unittest.mock import patch, AsyncMock
    
    db = FakeDB()
    
    multi_ticket = {
        "id": "ticket-002",
        "ticket_number": "T002",
        "ticket_type": "multi_play",
        "seller_id": "seller-1",
        "seller_name": "Test Seller",
        "status": "pending",
        "currency": "RD$",
        "country": "RD",
        "plays": [
            {
                "lottery_id": "lot-1",
                "lottery_name": "Test Lottery",
                "lottery_type": "quiniela",
                "numbers": [42],
                "amount": 100
            },
            {
                "lottery_id": "lot-1",
                "lottery_name": "Test Lottery",
                "lottery_type": "quiniela",
                "numbers": [99],
                "amount": 50
            }
        ]
    }
    db.tickets = FakeCollection([multi_ticket])
    
    result = LotteryResult(
        lottery_name="Test Lottery",
        first_prize=42,
        second_prize=15,
        third_prize=78,
        draw_date="2026-03-28",
        source="test"
    )
    
    lottery_doc = {
        "id": "lot-1",
        "name": "Test Lottery",
        "play_types": {},
        "currency": "RD$"
    }
    
    with patch("services.notifications.notify_winner", new_callable=AsyncMock), \
         patch("services.notifications.notify_draw_complete", new_callable=AsyncMock), \
         patch("services.notifications.notify_client_winner", new_callable=AsyncMock):
        loop = asyncio.new_event_loop()
        draw = loop.run_until_complete(process_new_results(db, result, lottery_doc))
        loop.close()
    
    # Check the ticket update
    ticket_updates = [u for u in db.tickets._updates if not u.get("many")]
    assert len(ticket_updates) >= 1
    
    update_set = ticket_updates[0]["update"]["$set"]
    plays = update_set["plays"]
    
    # Play 0 should have won
    assert plays[0]["play_result"] == "won"
    assert plays[0]["winning_numbers"]["first"] == 42
    assert plays[0]["winning_numbers"]["second"] == 15
    assert plays[0]["winning_numbers"]["third"] == 78
    
    # Play 1 should have lost
    assert plays[1]["play_result"] == "lost"
    
    # Ticket-level winning_numbers should be set
    assert update_set["winning_numbers"]["first"] == 42
    
    print("PASS: Multi-play ticket stores winning_numbers per play and at ticket level")


if __name__ == "__main__":
    test_determine_play_win_quiniela_first()
    test_determine_play_win_quiniela_second()
    test_determine_play_win_quiniela_third()
    test_determine_play_win_quiniela_no_match()
    test_determine_play_win_pale_first_second()
    test_determine_play_win_pale_first_third()
    test_determine_play_win_tripleta_all()
    test_determine_play_win_tripleta_partial()
    test_determine_play_win_with_custom_multipliers()
    test_process_new_results_simple_ticket_stores_winning_info()
    test_process_new_results_multiplay_stores_winning_info()
    print("\nAll tests passed!")
