"""
Test suite for detailed-seller-report API endpoint
Tests: Period selector (daily, weekly, biweekly, monthly), seller filtering, ticket details
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lottery-shortcuts.preview.emergentagent.com').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@loteria.com",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Create headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDetailedSellerReportPeriods:
    """Tests for period selector functionality"""
    
    def test_daily_period(self, auth_headers):
        """Test daily period returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert data["period"] == "daily"
        assert "Hoy" in data["period_label"]
        assert "summary" in data
        assert "ticket_counts" in data
        assert "tickets" in data
        
        # Summary should have all required fields
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_wins" in summary
        assert "total_commission" in summary
        assert "commission_rate" in summary
        assert "net_profit" in summary
        assert "currency" in summary
    
    def test_weekly_period(self, auth_headers):
        """Test weekly period (7 days) returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=weekly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "weekly"
        assert "Última Semana" in data["period_label"]
        # Weekly should include daily_breakdown
        if data["summary"]["total_sales"] > 0:
            assert "daily_breakdown" in data
    
    def test_biweekly_period(self, auth_headers):
        """Test biweekly/quincenal period (15 days) returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=biweekly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "biweekly"
        assert "Quincenal" in data["period_label"]
    
    def test_monthly_period(self, auth_headers):
        """Test monthly period (30 days) returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=monthly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "monthly"
        assert "Último Mes" in data["period_label"]


class TestDetailedSellerReportFiltering:
    """Tests for seller filtering"""
    
    def test_with_seller_id(self, auth_headers):
        """Test filtering by specific seller_id"""
        # First get list of sellers
        sellers_response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers=auth_headers
        )
        assert sellers_response.status_code == 200
        sellers = sellers_response.json().get("sellers", [])
        
        if sellers:
            seller_id = sellers[0]["seller_id"]
            seller_name = sellers[0]["seller_name"]
            
            response = requests.get(
                f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily&seller_id={seller_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Validate seller info is included
            assert "seller" in data
            assert data["seller"]["id"] == seller_id
            assert data["seller"]["name"] == seller_name
    
    def test_without_seller_id_as_admin(self, auth_headers):
        """Test without seller_id - should return all tickets for admin"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Without seller_id, seller info should be None
        assert data.get("seller") is None


class TestDetailedSellerReportTicketCounts:
    """Tests for ticket counts in report"""
    
    def test_ticket_counts_structure(self, auth_headers):
        """Test ticket_counts has all status types"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        ticket_counts = data["ticket_counts"]
        assert "total" in ticket_counts
        assert "pending" in ticket_counts
        assert "won" in ticket_counts
        assert "paid" in ticket_counts
        assert "lost" in ticket_counts
        assert "cancelled" in ticket_counts
    
    def test_ticket_details_structure(self, auth_headers):
        """Test tickets array contains proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        tickets = data["tickets"]
        if tickets:
            ticket = tickets[0]
            assert "id" in ticket
            assert "ticket_number" in ticket
            assert "status" in ticket
            assert "created_at" in ticket
            assert "currency" in ticket
            
            # Check for multi-play vs simple ticket structure
            if ticket.get("is_multi_play"):
                assert "plays" in ticket
                assert "total_amount" in ticket
                assert "total_potential_win" in ticket
            else:
                assert "lottery_name" in ticket or "numbers" in ticket


class TestDailyBreakdown:
    """Tests for daily breakdown in non-daily periods"""
    
    def test_weekly_has_daily_breakdown(self, auth_headers):
        """Test weekly period includes daily breakdown array"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=weekly",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # daily_breakdown is included for non-daily periods
        assert "daily_breakdown" in data
        
        # Validate structure if there are entries
        if data["daily_breakdown"]:
            day = data["daily_breakdown"][0]
            assert "date" in day
            assert "label" in day
            assert "day_name" in day
            assert "sales" in day
            assert "wins" in day
            assert "profit" in day
            assert "tickets" in day


class TestGetTicketsEndpoint:
    """Tests for GET /api/tickets with multi-play support"""
    
    def test_get_all_tickets(self, auth_headers):
        """Test getting all tickets"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers=auth_headers
        )
        assert response.status_code == 200
        tickets = response.json()
        assert isinstance(tickets, list)
    
    def test_tickets_status_filter(self, auth_headers):
        """Test filtering tickets by status"""
        for status in ["pending", "won", "lost", "cancelled", "paid"]:
            response = requests.get(
                f"{BASE_URL}/api/tickets?status={status}",
                headers=auth_headers
            )
            assert response.status_code == 200
            tickets = response.json()
            # All returned tickets should have the requested status
            for ticket in tickets:
                assert ticket["status"] == status
    
    def test_multi_play_ticket_structure(self, auth_headers):
        """Test multi-play tickets have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers=auth_headers
        )
        assert response.status_code == 200
        tickets = response.json()
        
        multi_play_tickets = [t for t in tickets if t.get("ticket_type") == "multi_play"]
        if multi_play_tickets:
            ticket = multi_play_tickets[0]
            assert ticket["ticket_type"] == "multi_play"
            assert "plays" in ticket
            assert "plays_count" in ticket
            assert "total_amount" in ticket
            assert "total_potential_win" in ticket
            
            # Check plays structure
            if ticket["plays"]:
                play = ticket["plays"][0]
                assert "lottery_type" in play or "lottery_name" in play
                assert "numbers" in play
                assert "amount" in play


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
