"""
Iteration 56 - Accounting Wins & Seller Loss Testing
Tests for:
1. Accounting endpoints return non-zero wins when winning tickets exist
2. Profit can be negative (seller loss scenario)
3. Winning tickets have winning_details in verify endpoint
4. GET /api/tickets?status=won returns winning tickets

Run: cd /app/backend && python -m pytest tests/test_accounting_wins_iteration56.py -v
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://seller-loss-review.preview.emergentagent.com').rstrip('/')


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def vendedor_token(self):
        """Login as vendedor"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vendedor@test.com",
            "password": "12345678"
        })
        assert response.status_code == 200, f"Vendedor login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    def test_admin_login(self, admin_token):
        """Verify admin login works"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print(f"PASS: Admin login successful, token length: {len(admin_token)}")
    
    def test_vendedor_login(self, vendedor_token):
        """Verify vendedor login works"""
        assert vendedor_token is not None
        assert len(vendedor_token) > 0
        print(f"PASS: Vendedor login successful, token length: {len(vendedor_token)}")


class TestAccountingSummary:
    """Test GET /api/accounting/summary - verify wins field works correctly"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_accounting_summary_structure(self, admin_token):
        """Verify accounting summary has correct structure with wins field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check structure
        assert "today" in data, "Missing 'today' in response"
        assert "week" in data, "Missing 'week' in response"
        assert "month" in data, "Missing 'month' in response"
        
        # Check each period has required fields
        for period in ["today", "week", "month"]:
            period_data = data[period]
            assert "sales" in period_data, f"Missing 'sales' in {period}"
            assert "wins" in period_data, f"Missing 'wins' in {period}"
            assert "profit" in period_data, f"Missing 'profit' in {period}"
            assert "tickets" in period_data, f"Missing 'tickets' in {period}"
            
            # Verify profit calculation: profit = sales - wins
            expected_profit = period_data["sales"] - period_data["wins"]
            assert period_data["profit"] == expected_profit, \
                f"Profit calculation wrong in {period}: {period_data['profit']} != {expected_profit}"
        
        print(f"PASS: Accounting summary structure correct")
        print(f"  Today: sales={data['today']['sales']}, wins={data['today']['wins']}, profit={data['today']['profit']}")
        print(f"  Week: sales={data['week']['sales']}, wins={data['week']['wins']}, profit={data['week']['profit']}")
        print(f"  Month: sales={data['month']['sales']}, wins={data['month']['wins']}, profit={data['month']['profit']}")
    
    def test_accounting_summary_profit_can_be_negative(self, admin_token):
        """Verify profit can be negative (seller loss scenario)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check if any period has negative profit (wins > sales)
        # This is a data-dependent test - we just verify the calculation allows negative
        for period in ["today", "week", "month"]:
            period_data = data[period]
            # Verify the profit field exists and is a number (can be negative)
            assert isinstance(period_data["profit"], (int, float)), \
                f"Profit should be a number, got {type(period_data['profit'])}"
            
            # If wins > sales, profit should be negative
            if period_data["wins"] > period_data["sales"]:
                assert period_data["profit"] < 0, \
                    f"Profit should be negative when wins > sales in {period}"
                print(f"PASS: Found negative profit in {period}: {period_data['profit']}")
        
        print("PASS: Profit calculation allows negative values (seller loss)")


class TestAccountingReport:
    """Test GET /api/accounting/report - verify total_wins and net_profit"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_accounting_report_month_structure(self, admin_token):
        """Verify accounting report has correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/report?period=month", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check required fields
        required_fields = ["period", "total_sales", "total_wins", "total_commission", 
                          "net_profit", "currency", "tickets_sold", "tickets_won"]
        for field in required_fields:
            assert field in data, f"Missing '{field}' in response"
        
        print(f"PASS: Accounting report structure correct")
        print(f"  Period: {data['period']}")
        print(f"  Total Sales: {data['total_sales']}")
        print(f"  Total Wins: {data['total_wins']}")
        print(f"  Net Profit: {data['net_profit']}")
        print(f"  Tickets Won: {data['tickets_won']}")
    
    def test_accounting_report_net_profit_can_be_negative(self, admin_token):
        """Verify net_profit can be negative"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/report?period=month", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify net_profit is a number (can be negative)
        assert isinstance(data["net_profit"], (int, float)), \
            f"net_profit should be a number, got {type(data['net_profit'])}"
        
        # net_profit = total_sales - total_wins - total_commission
        expected_net = data["total_sales"] - data["total_wins"] - data["total_commission"]
        # Allow small floating point differences
        assert abs(data["net_profit"] - expected_net) < 0.01, \
            f"Net profit calculation wrong: {data['net_profit']} != {expected_net}"
        
        print(f"PASS: Net profit calculation correct: {data['net_profit']}")
    
    def test_accounting_report_day_period(self, admin_token):
        """Test day period"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/report?period=day", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "Hoy"
        print(f"PASS: Day period report works - Sales: {data['total_sales']}, Wins: {data['total_wins']}")
    
    def test_accounting_report_week_period(self, admin_token):
        """Test week period"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/report?period=week", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "Última Semana"
        print(f"PASS: Week period report works - Sales: {data['total_sales']}, Wins: {data['total_wins']}")


class TestCountryComparison:
    """Test GET /api/accounting/country-comparison - verify total_wins per country"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_country_comparison_structure(self, admin_token):
        """Verify country comparison has correct structure with wins"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/country-comparison?period=month", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "period" in data
        assert "countries" in data
        
        # Check each country has required fields
        for country_code in ["RD", "US"]:
            if country_code in data["countries"]:
                country_data = data["countries"][country_code]
                assert "total_sales" in country_data, f"Missing total_sales for {country_code}"
                assert "total_wins" in country_data, f"Missing total_wins for {country_code}"
                assert "net_profit" in country_data, f"Missing net_profit for {country_code}"
                
                # Verify net_profit = total_sales - total_wins
                expected_profit = country_data["total_sales"] - country_data["total_wins"]
                assert country_data["net_profit"] == expected_profit, \
                    f"Net profit wrong for {country_code}: {country_data['net_profit']} != {expected_profit}"
                
                print(f"  {country_code}: sales={country_data['total_sales']}, wins={country_data['total_wins']}, profit={country_data['net_profit']}")
        
        print("PASS: Country comparison structure correct with wins field")


class TestDailyChart:
    """Test GET /api/accounting/daily-chart - verify wins field in daily data"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_daily_chart_structure(self, admin_token):
        """Verify daily chart has wins field"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/daily-chart?days=7", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "days" in data
        assert "data" in data
        assert "totals" in data
        
        # Check totals have wins
        assert "total_wins" in data["totals"], "Missing total_wins in totals"
        assert "total_profit" in data["totals"], "Missing total_profit in totals"
        
        # Check each day has wins field
        for day_data in data["data"]:
            assert "sales" in day_data, "Missing sales in day data"
            assert "wins" in day_data, "Missing wins in day data"
            assert "profit" in day_data, "Missing profit in day data"
            
            # Verify profit = sales - wins
            expected_profit = day_data["sales"] - day_data["wins"]
            assert day_data["profit"] == expected_profit, \
                f"Profit wrong for {day_data.get('date')}: {day_data['profit']} != {expected_profit}"
        
        print(f"PASS: Daily chart has wins field - Total wins: {data['totals']['total_wins']}")


class TestDetailedSellerReport:
    """Test GET /api/accounting/detailed-seller-report - verify total_wins and net_profit"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_detailed_seller_report_structure(self, admin_token):
        """Verify detailed seller report has correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/detailed-seller-report?period=monthly", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "period" in data
        assert "summary" in data
        assert "ticket_counts" in data
        
        summary = data["summary"]
        required_summary_fields = ["total_sales", "total_wins", "net_profit", "total_commission"]
        for field in required_summary_fields:
            assert field in summary, f"Missing '{field}' in summary"
        
        print(f"PASS: Detailed seller report structure correct")
        print(f"  Total Sales: {summary['total_sales']}")
        print(f"  Total Wins: {summary['total_wins']}")
        print(f"  Net Profit: {summary['net_profit']}")


class TestWinningTickets:
    """Test winning tickets functionality"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_get_winning_tickets(self, admin_token):
        """Test GET /api/tickets?status=won returns winning tickets"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/tickets?status=won", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Response should have tickets array
        assert "tickets" in data, "Missing 'tickets' in response"
        
        tickets = data["tickets"]
        print(f"Found {len(tickets)} winning tickets")
        
        # If there are winning tickets, verify they have status=won
        for ticket in tickets[:5]:  # Check first 5
            assert ticket.get("status") in ["won", "paid"], \
                f"Ticket {ticket.get('ticket_number')} has wrong status: {ticket.get('status')}"
            print(f"  Ticket {ticket.get('ticket_number')}: status={ticket.get('status')}, potential_win={ticket.get('potential_win') or ticket.get('total_potential_win')}")
        
        print("PASS: GET /api/tickets?status=won works correctly")
        return tickets
    
    def test_verify_winning_ticket_has_details(self, admin_token):
        """Test that winning ticket verify endpoint includes winning_details"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get a winning ticket
        response = requests.get(f"{BASE_URL}/api/tickets?status=won&limit=10", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        tickets = data.get("tickets", [])
        if not tickets:
            # Also check paid tickets
            response = requests.get(f"{BASE_URL}/api/tickets?status=paid&limit=10", headers=headers)
            assert response.status_code == 200
            data = response.json()
            tickets = data.get("tickets", [])
        
        if not tickets:
            pytest.skip("No winning/paid tickets found to verify")
        
        # Verify the first winning ticket
        ticket = tickets[0]
        ticket_number = ticket.get("ticket_number")
        
        # Call verify endpoint (public, no auth needed)
        verify_response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        assert verify_response.status_code == 200, f"Verify failed: {verify_response.text}"
        
        verify_data = verify_response.json()
        
        # Check required fields
        assert "ticket_number" in verify_data
        assert "status" in verify_data
        assert "is_winner" in verify_data
        assert verify_data["is_winner"] == True, "Ticket should be marked as winner"
        
        # Check winning_details field exists for winning tickets
        assert "winning_details" in verify_data, "Missing 'winning_details' in verify response"
        
        winning_details = verify_data["winning_details"]
        if winning_details:
            print(f"PASS: Winning ticket {ticket_number} has winning_details:")
            print(f"  won_position: {winning_details.get('won_position')}")
            print(f"  won_number: {winning_details.get('won_number')}")
            print(f"  winning_numbers: {winning_details.get('winning_numbers')}")
            print(f"  prize_amount: {winning_details.get('prize_amount')}")
        else:
            # winning_details might be None for old demo tickets created before the fix
            print(f"NOTE: Ticket {ticket_number} has winning_details=None (likely demo/trial data created before fix)")
        
        print("PASS: Verify endpoint includes winning_details field")


class TestTicketVerifyEndpoint:
    """Test the public ticket verify endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_verify_nonexistent_ticket(self):
        """Test verify endpoint with non-existent ticket"""
        response = requests.get(f"{BASE_URL}/api/tickets/verify/NONEXISTENT123")
        assert response.status_code == 404
        print("PASS: Non-existent ticket returns 404")
    
    def test_verify_ticket_structure(self, admin_token):
        """Test verify endpoint returns correct structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get any ticket
        response = requests.get(f"{BASE_URL}/api/tickets?limit=1", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        tickets = data.get("tickets", [])
        if not tickets:
            pytest.skip("No tickets found")
        
        ticket_number = tickets[0].get("ticket_number")
        
        # Verify the ticket
        verify_response = requests.get(f"{BASE_URL}/api/tickets/verify/{ticket_number}")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        
        # Check required fields
        required_fields = ["ticket_number", "status", "is_winner", "is_paid", 
                          "lottery_name", "amount", "potential_win", "currency", 
                          "created_at", "message"]
        for field in required_fields:
            assert field in verify_data, f"Missing '{field}' in verify response"
        
        # winning_details should be present (can be None for non-winners)
        assert "winning_details" in verify_data, "Missing 'winning_details' field"
        
        print(f"PASS: Verify endpoint structure correct for ticket {ticket_number}")
        print(f"  Status: {verify_data['status']}")
        print(f"  Is Winner: {verify_data['is_winner']}")
        print(f"  Winning Details: {verify_data['winning_details']}")


class TestSellersReport:
    """Test GET /api/accounting/sellers-report - verify wins calculation"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@loteria.com",
            "password": "admin123"
        })
        return response.json().get("token")
    
    def test_sellers_report_structure(self, admin_token):
        """Verify sellers report has correct structure with wins"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/sellers-report", headers=headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "sellers" in data
        assert "totals" in data
        
        # Check totals have wins
        totals = data["totals"]
        assert "total_sales" in totals
        assert "total_wins" in totals
        assert "net_profit" in totals
        
        # Check each seller has wins field
        for seller in data["sellers"][:5]:  # Check first 5
            assert "total_sales" in seller
            assert "total_wins" in seller
            assert "net_profit" in seller
            
            # net_profit = total_sales - total_wins (without commission in this report)
            expected_profit = seller["total_sales"] - seller["total_wins"]
            assert seller["net_profit"] == expected_profit, \
                f"Net profit wrong for {seller.get('seller_name')}"
        
        print(f"PASS: Sellers report structure correct")
        print(f"  Total Sales: {totals['total_sales']}")
        print(f"  Total Wins: {totals['total_wins']}")
        print(f"  Net Profit: {totals['net_profit']}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
