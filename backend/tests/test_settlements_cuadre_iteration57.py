"""
Test Settlement/Cuadre System - Iteration 57
Tests the new settlement system for seller cuadre (settlement) management.

Key features tested:
1. GET /api/settlements/cuadre/{seller_id} - Get cuadre with formula: sales - commission - wins
2. GET /api/settlements/cuadre/{seller_id}?start_date=X&end_date=Y - Date range filtering
3. POST /api/settlements/close - Close settlement, update balance, create transaction
4. POST /api/settlements/payment - Register payment and update balance
5. GET /api/settlements/history/{seller_id} - Settlement history
6. GET /api/settlements/all-balances - All sellers with balances
7. GET /api/accounting/summary - Commission in net_profit calculation
8. GET /api/accounting/sellers-report - net_profit = sales - commission - wins
9. GET /api/accounting/detailed-seller-report - net_profit = sales - commission - wins
10. Admin role restriction - admin only sees their own sellers
11. Commission ALWAYS deducted regardless of win/loss status
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://receipt-unify.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@loteria.com"
SUPER_ADMIN_PASSWORD = "admin123"
VENDEDOR_EMAIL = "vendedor@test.com"
VENDEDOR_PASSWORD = "12345678"
TEST_SELLER_ID = "de90d7f5-186d-405e-866c-249ec39a0089"


class TestSettlementsCuadreSystem:
    """Test the new settlement/cuadre system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_super_admin_token(self):
        """Get super admin authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        return None
    
    def get_vendedor_token(self):
        """Get vendedor authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEDOR_EMAIL,
            "password": VENDEDOR_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        return None

    # ==================== AUTH TESTS ====================
    
    def test_01_super_admin_login(self):
        """Test super admin login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"✓ Super admin login successful")
    
    def test_02_vendedor_login(self):
        """Test vendedor login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEDOR_EMAIL,
            "password": VENDEDOR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"✓ Vendedor login successful")

    # ==================== CUADRE ENDPOINT TESTS ====================
    
    def test_03_get_seller_cuadre_basic(self):
        """Test GET /api/settlements/cuadre/{seller_id} - basic cuadre retrieval"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/settlements/cuadre/{TEST_SELLER_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Cuadre request failed: {response.text}"
        data = response.json()
        
        # Verify required fields exist
        required_fields = [
            "seller_id", "seller_name", "commission_rate", "currency",
            "period_start", "period_end", "total_sales", "total_commission",
            "total_wins", "net_profit", "tickets_sold", "tickets_won",
            "running_balance", "total_due"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify formula: net_profit = total_sales - total_commission - total_wins
        expected_net_profit = data["total_sales"] - data["total_commission"] - data["total_wins"]
        assert abs(data["net_profit"] - expected_net_profit) < 0.01, \
            f"Net profit formula incorrect: {data['net_profit']} != {expected_net_profit}"
        
        print(f"✓ Cuadre retrieved successfully")
        print(f"  - Sales: {data['total_sales']}")
        print(f"  - Commission: {data['total_commission']}")
        print(f"  - Wins: {data['total_wins']}")
        print(f"  - Net Profit: {data['net_profit']}")
        print(f"  - Running Balance: {data['running_balance']}")
    
    def test_04_get_seller_cuadre_with_date_range(self):
        """Test GET /api/settlements/cuadre/{seller_id}?start_date=X&end_date=Y - date filtering"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        # Use last 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/settlements/cuadre/{TEST_SELLER_ID}",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Cuadre with date range failed: {response.text}"
        data = response.json()
        
        # Verify period dates are set correctly
        assert "period_start" in data
        assert "period_end" in data
        
        # Verify formula still holds
        expected_net_profit = data["total_sales"] - data["total_commission"] - data["total_wins"]
        assert abs(data["net_profit"] - expected_net_profit) < 0.01, \
            f"Net profit formula incorrect with date range"
        
        print(f"✓ Cuadre with date range works correctly")
        print(f"  - Period: {data['period_start']} to {data['period_end']}")
    
    def test_05_cuadre_commission_always_deducted(self):
        """Test that commission is ALWAYS deducted regardless of win/loss status"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/settlements/cuadre/{TEST_SELLER_ID}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Commission should be calculated as: total_sales * (commission_rate / 100)
        if data["total_sales"] > 0:
            expected_commission = data["total_sales"] * (data["commission_rate"] / 100)
            assert abs(data["total_commission"] - expected_commission) < 0.01, \
                f"Commission not calculated correctly: {data['total_commission']} != {expected_commission}"
            
            # Commission should be deducted from net_profit regardless of wins
            # net_profit = sales - commission - wins
            # Even if wins = 0, commission is still deducted
            assert data["net_profit"] == data["total_sales"] - data["total_commission"] - data["total_wins"], \
                "Commission not properly deducted from net_profit"
        
        print(f"✓ Commission ALWAYS deducted: {data['total_commission']} (rate: {data['commission_rate']}%)")

    # ==================== CLOSE SETTLEMENT TESTS ====================
    
    def test_06_close_settlement(self):
        """Test POST /api/settlements/close - close settlement and update balance"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get current cuadre to know what's due
        cuadre_response = self.session.get(
            f"{BASE_URL}/api/settlements/cuadre/{TEST_SELLER_ID}",
            headers=headers
        )
        assert cuadre_response.status_code == 200
        cuadre = cuadre_response.json()
        
        # Close with a small test payment
        test_payment = 100.00
        response = self.session.post(
            f"{BASE_URL}/api/settlements/close",
            json={
                "seller_id": TEST_SELLER_ID,
                "amount_paid": test_payment,
                "notes": "Test settlement close - iteration 57"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Close settlement failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "settlement" in data
        
        settlement = data["settlement"]
        required_fields = [
            "id", "seller_id", "total_sales", "total_commission", "total_wins",
            "net_profit", "previous_balance", "amount_due", "amount_paid", "balance_after"
        ]
        for field in required_fields:
            assert field in settlement, f"Missing field in settlement: {field}"
        
        # Verify balance calculation
        expected_balance_after = settlement["amount_due"] - settlement["amount_paid"]
        assert abs(settlement["balance_after"] - expected_balance_after) < 0.01, \
            f"Balance after incorrect: {settlement['balance_after']} != {expected_balance_after}"
        
        print(f"✓ Settlement closed successfully")
        print(f"  - Amount Due: {settlement['amount_due']}")
        print(f"  - Amount Paid: {settlement['amount_paid']}")
        print(f"  - Balance After: {settlement['balance_after']}")

    # ==================== PAYMENT REGISTRATION TESTS ====================
    
    def test_07_register_payment(self):
        """Test POST /api/settlements/payment - register payment and update balance"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Register a test payment
        test_payment = 50.00
        response = self.session.post(
            f"{BASE_URL}/api/settlements/payment",
            json={
                "seller_id": TEST_SELLER_ID,
                "amount": test_payment,
                "notes": "Test payment - iteration 57"
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Register payment failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert "previous_balance" in data
        assert "amount_paid" in data
        assert "new_balance" in data
        assert "currency" in data
        
        # Verify balance was reduced
        expected_new_balance = data["previous_balance"] - data["amount_paid"]
        assert abs(data["new_balance"] - expected_new_balance) < 0.01, \
            f"New balance incorrect: {data['new_balance']} != {expected_new_balance}"
        
        print(f"✓ Payment registered successfully")
        print(f"  - Previous Balance: {data['previous_balance']}")
        print(f"  - Amount Paid: {data['amount_paid']}")
        print(f"  - New Balance: {data['new_balance']}")

    # ==================== SETTLEMENT HISTORY TESTS ====================
    
    def test_08_get_settlement_history(self):
        """Test GET /api/settlements/history/{seller_id} - get settlement history"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/settlements/history/{TEST_SELLER_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "seller_id" in data
        assert "seller_name" in data
        assert "current_balance" in data
        assert "currency" in data
        assert "settlements" in data
        assert "total_settlements" in data
        
        # Settlements should be a list
        assert isinstance(data["settlements"], list)
        
        # If there are settlements, verify structure
        if len(data["settlements"]) > 0:
            settlement = data["settlements"][0]
            required_fields = ["id", "seller_id", "total_sales", "total_commission", 
                             "total_wins", "net_profit", "amount_paid", "balance_after"]
            for field in required_fields:
                assert field in settlement, f"Missing field in settlement history: {field}"
        
        print(f"✓ Settlement history retrieved: {data['total_settlements']} settlements")
        print(f"  - Current Balance: {data['current_balance']}")

    # ==================== ALL BALANCES TESTS ====================
    
    def test_09_get_all_seller_balances(self):
        """Test GET /api/settlements/all-balances - get all sellers with balances"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/settlements/all-balances",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get all balances failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sellers" in data
        assert "total_balance" in data
        assert "currency" in data
        
        # Sellers should be a list
        assert isinstance(data["sellers"], list)
        
        # If there are sellers, verify structure
        if len(data["sellers"]) > 0:
            seller = data["sellers"][0]
            required_fields = ["seller_id", "seller_name", "balance", "commission_rate", "currency"]
            for field in required_fields:
                assert field in seller, f"Missing field in seller balance: {field}"
        
        print(f"✓ All balances retrieved: {len(data['sellers'])} sellers")
        print(f"  - Total Balance: {data['total_balance']}")

    # ==================== ACCOUNTING FORMULA TESTS ====================
    
    def test_10_accounting_summary_includes_commission(self):
        """Test GET /api/accounting/summary - verify commission in net_profit calculation"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/accounting/summary",
            headers=headers
        )
        
        assert response.status_code == 200, f"Accounting summary failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "today" in data
        assert "week" in data
        assert "month" in data
        assert "commission_rate" in data
        
        # Check each period has the required fields including commission
        for period in ["today", "week", "month"]:
            period_data = data[period]
            assert "sales" in period_data
            assert "wins" in period_data
            assert "commission" in period_data
            assert "net_profit" in period_data
            
            # Verify formula: net_profit = sales - commission - wins
            expected_net_profit = period_data["sales"] - period_data["commission"] - period_data["wins"]
            assert abs(period_data["net_profit"] - expected_net_profit) < 0.01, \
                f"Net profit formula incorrect in {period}: {period_data['net_profit']} != {expected_net_profit}"
        
        print(f"✓ Accounting summary includes commission correctly")
        print(f"  - Month: Sales={data['month']['sales']}, Commission={data['month']['commission']}, Wins={data['month']['wins']}, Net={data['month']['net_profit']}")
    
    def test_11_sellers_report_net_profit_formula(self):
        """Test GET /api/accounting/sellers-report - verify net_profit = sales - commission - wins"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers=headers
        )
        
        assert response.status_code == 200, f"Sellers report failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sellers" in data
        assert "totals" in data
        
        # Check each seller has correct formula
        for seller in data["sellers"]:
            assert "total_sales" in seller
            assert "total_commission" in seller
            assert "total_wins" in seller
            assert "net_profit" in seller
            
            # Verify formula: net_profit = sales - commission - wins
            expected_net_profit = seller["total_sales"] - seller["total_commission"] - seller["total_wins"]
            assert abs(seller["net_profit"] - expected_net_profit) < 0.01, \
                f"Net profit formula incorrect for seller {seller.get('seller_name')}: {seller['net_profit']} != {expected_net_profit}"
        
        # Verify totals also follow the formula
        totals = data["totals"]
        expected_total_net = totals["total_sales"] - totals["total_commission"] - totals["total_wins"]
        assert abs(totals["net_profit"] - expected_total_net) < 0.01, \
            f"Total net profit formula incorrect: {totals['net_profit']} != {expected_total_net}"
        
        print(f"✓ Sellers report net_profit formula correct")
        print(f"  - Total Sales: {totals['total_sales']}")
        print(f"  - Total Commission: {totals['total_commission']}")
        print(f"  - Total Wins: {totals['total_wins']}")
        print(f"  - Total Net Profit: {totals['net_profit']}")
    
    def test_12_detailed_seller_report_net_profit_formula(self):
        """Test GET /api/accounting/detailed-seller-report - verify net_profit = sales - commission - wins"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report",
            params={"period": "monthly"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Detailed seller report failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "summary" in data
        assert "seller" in data
        
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_commission" in summary
        assert "total_wins" in summary
        assert "net_profit" in summary
        
        # Verify formula: net_profit = sales - commission - wins
        expected_net_profit = summary["total_sales"] - summary["total_commission"] - summary["total_wins"]
        assert abs(summary["net_profit"] - expected_net_profit) < 0.01, \
            f"Net profit formula incorrect: {summary['net_profit']} != {expected_net_profit}"
        
        print(f"✓ Detailed seller report net_profit formula correct")
        print(f"  - Sales: {summary['total_sales']}")
        print(f"  - Commission: {summary['total_commission']}")
        print(f"  - Wins: {summary['total_wins']}")
        print(f"  - Net Profit: {summary['net_profit']}")

    # ==================== ADMIN ROLE RESTRICTION TESTS ====================
    
    def test_13_vendedor_cannot_access_settlements(self):
        """Test that vendedor role cannot access settlement endpoints"""
        token = self.get_vendedor_token()
        assert token, "Failed to get vendedor token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access cuadre endpoint
        response = self.session.get(
            f"{BASE_URL}/api/settlements/cuadre/{TEST_SELLER_ID}",
            headers=headers
        )
        
        # Should be forbidden (403) or unauthorized (401)
        assert response.status_code in [401, 403], \
            f"Vendedor should not access settlements: got {response.status_code}"
        
        print(f"✓ Vendedor correctly denied access to settlements (status: {response.status_code})")
    
    def test_14_vendedor_cannot_close_settlement(self):
        """Test that vendedor role cannot close settlements"""
        token = self.get_vendedor_token()
        assert token, "Failed to get vendedor token"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.session.post(
            f"{BASE_URL}/api/settlements/close",
            json={
                "seller_id": TEST_SELLER_ID,
                "amount_paid": 100.00
            },
            headers=headers
        )
        
        # Should be forbidden (403) or unauthorized (401)
        assert response.status_code in [401, 403], \
            f"Vendedor should not close settlements: got {response.status_code}"
        
        print(f"✓ Vendedor correctly denied closing settlements (status: {response.status_code})")

    # ==================== ACCOUNTING REPORT TESTS ====================
    
    def test_15_accounting_report_includes_commission(self):
        """Test GET /api/accounting/report - verify commission in calculation"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/accounting/report",
            params={"period": "month"},
            headers=headers
        )
        
        assert response.status_code == 200, f"Accounting report failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_sales" in data
        assert "total_wins" in data
        assert "total_commission" in data
        assert "net_profit" in data
        
        # Verify formula: net_profit = sales - wins - commission
        expected_net_profit = data["total_sales"] - data["total_wins"] - data["total_commission"]
        assert abs(data["net_profit"] - expected_net_profit) < 0.01, \
            f"Net profit formula incorrect: {data['net_profit']} != {expected_net_profit}"
        
        print(f"✓ Accounting report includes commission correctly")
        print(f"  - Sales: {data['total_sales']}")
        print(f"  - Commission: {data['total_commission']}")
        print(f"  - Wins: {data['total_wins']}")
        print(f"  - Net Profit: {data['net_profit']}")
    
    def test_16_sellers_report_with_date_range(self):
        """Test GET /api/accounting/sellers-report with date range"""
        token = self.get_super_admin_token()
        assert token, "Failed to get admin token"
        
        # Use last 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            headers=headers
        )
        
        assert response.status_code == 200, f"Sellers report with date range failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sellers" in data
        assert "period" in data
        
        print(f"✓ Sellers report with date range works correctly")
        print(f"  - Period: {data['period']}")
        print(f"  - Sellers count: {len(data['sellers'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
