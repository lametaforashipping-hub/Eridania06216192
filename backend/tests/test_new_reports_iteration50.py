"""
Test file for new report pages and endpoints - Iteration 50
Tests: country-comparison, sellers-report, accounting/report, commissions, detailed-seller-report
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('VITE_API_URL', 'https://receipt-redesign-6.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@loteria.com"
ADMIN_PASSWORD = "admin123"
VENDOR_EMAIL = "vendedor@test.com"
VENDOR_PASSWORD = "12345678"


class TestAuthentication:
    """Test login for both admin and vendor users"""
    
    def test_admin_login(self):
        """Test admin login returns correct user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("role") == "super_admin", f"Expected super_admin role, got {data.get('user', {}).get('role')}"
        assert data.get("user", {}).get("country") == "US", f"Expected US country, got {data.get('user', {}).get('country')}"
        print(f"Admin login SUCCESS - role: {data['user']['role']}, country: {data['user']['country']}")
    
    def test_vendor_login(self):
        """Test vendor login returns correct user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        assert response.status_code == 200, f"Vendor login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("role") == "vendedor", f"Expected vendedor role, got {data.get('user', {}).get('role')}"
        assert data.get("user", {}).get("country") == "RD", f"Expected RD country, got {data.get('user', {}).get('country')}"
        print(f"Vendor login SUCCESS - role: {data['user']['role']}, country: {data['user']['country']}")


@pytest.fixture
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def vendor_token():
    """Get vendor authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": VENDOR_EMAIL,
        "password": VENDOR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Vendor authentication failed")


class TestCountryComparison:
    """Test /api/accounting/country-comparison endpoint"""
    
    def test_country_comparison_month(self, admin_token):
        """Test country comparison with month period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/country-comparison?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Country comparison failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data, "Missing period field"
        assert "countries" in data, "Missing countries field"
        assert data["period"] == "month", f"Expected period=month, got {data['period']}"
        
        # Verify both countries present
        assert "RD" in data["countries"], "Missing RD country data"
        assert "US" in data["countries"], "Missing US country data"
        
        # Verify RD country fields
        rd = data["countries"]["RD"]
        assert rd["country"] == "RD"
        assert rd["currency"] == "RD$"
        assert "total_sales" in rd
        assert "total_wins" in rd
        assert "net_profit" in rd
        assert "total_tickets" in rd
        assert "active_sellers" in rd
        assert "daily" in rd
        assert "top_lotteries" in rd
        
        # Verify US country fields
        us = data["countries"]["US"]
        assert us["country"] == "US"
        assert us["currency"] == "US$"
        assert "total_sales" in us
        assert "daily" in us
        assert "top_lotteries" in us
        
        print(f"Country comparison SUCCESS - RD sales: {rd['total_sales']}, US sales: {us['total_sales']}")
    
    def test_country_comparison_day(self, admin_token):
        """Test country comparison with day period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/country-comparison?period=day",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Country comparison day failed: {response.text}"
        data = response.json()
        assert data["period"] == "day"
        assert "RD" in data["countries"]
        assert "US" in data["countries"]
        print("Country comparison day period SUCCESS")
    
    def test_country_comparison_week(self, admin_token):
        """Test country comparison with week period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/country-comparison?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Country comparison week failed: {response.text}"
        data = response.json()
        assert data["period"] == "week"
        assert "RD" in data["countries"]
        assert "US" in data["countries"]
        print("Country comparison week period SUCCESS")
    
    def test_country_comparison_requires_admin(self, vendor_token):
        """Test that vendor cannot access country comparison"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/country-comparison?period=month",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        # Should return 403 Forbidden for non-admin users
        assert response.status_code == 403, f"Expected 403 for vendor, got {response.status_code}"
        print("Country comparison correctly requires admin role")


class TestSellersReport:
    """Test /api/accounting/sellers-report endpoint"""
    
    def test_sellers_report_all(self, admin_token):
        """Test sellers report without country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Sellers report failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "sellers" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "total_sales" in totals
        assert "total_wins" in totals
        assert "total_commission" in totals
        assert "net_profit" in totals
        
        # Verify seller data structure if sellers exist
        if data["sellers"]:
            seller = data["sellers"][0]
            assert "seller_id" in seller
            assert "seller_name" in seller
            assert "seller_country" in seller
            assert "total_sales" in seller
            assert "currency" in seller
        
        print(f"Sellers report SUCCESS - {len(data['sellers'])} sellers found")
    
    def test_sellers_report_rd_filter(self, admin_token):
        """Test sellers report with RD country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report?country=RD",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Sellers report RD failed: {response.text}"
        data = response.json()
        assert data.get("country_filter") == "RD"
        
        # All sellers should be from RD
        for seller in data.get("sellers", []):
            assert seller.get("seller_country") == "RD", f"Found non-RD seller: {seller}"
        
        print(f"Sellers report RD filter SUCCESS - {len(data['sellers'])} RD sellers")
    
    def test_sellers_report_us_filter(self, admin_token):
        """Test sellers report with US country filter"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report?country=US",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Sellers report US failed: {response.text}"
        data = response.json()
        assert data.get("country_filter") == "US"
        print(f"Sellers report US filter SUCCESS - {len(data['sellers'])} US sellers")
    
    def test_sellers_report_requires_admin(self, vendor_token):
        """Test that vendor cannot access sellers report"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/sellers-report",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for vendor, got {response.status_code}"
        print("Sellers report correctly requires admin role")


class TestAccountingReport:
    """Test /api/accounting/report endpoint"""
    
    def test_accounting_report_month(self, admin_token):
        """Test accounting report with month period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Accounting report failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "total_sales" in data
        assert "total_wins" in data
        assert "total_commission" in data
        assert "net_profit" in data
        assert "currency" in data
        assert "tickets_sold" in data
        assert "tickets_won" in data
        assert "transactions" in data
        
        print(f"Accounting report SUCCESS - sales: {data['total_sales']}, profit: {data['net_profit']}")
    
    def test_accounting_report_day(self, admin_token):
        """Test accounting report with day period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?period=day",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Accounting report day failed: {response.text}"
        data = response.json()
        assert "Hoy" in data.get("period", "")
        print("Accounting report day period SUCCESS")
    
    def test_accounting_report_week(self, admin_token):
        """Test accounting report with week period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Accounting report week failed: {response.text}"
        data = response.json()
        assert "Semana" in data.get("period", "")
        print("Accounting report week period SUCCESS")
    
    def test_accounting_report_vendor(self, vendor_token):
        """Test that vendor can access their own accounting report"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/report?period=month",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Vendor accounting report failed: {response.text}"
        data = response.json()
        assert "total_sales" in data
        print("Vendor accounting report SUCCESS")


class TestCommissions:
    """Test /api/accounting/commissions endpoint"""
    
    def test_commissions_day(self, admin_token):
        """Test commissions with day period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/commissions?period=day",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Commissions day failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "summary" in data
        assert "details" in data
        
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_commission" in summary
        assert "commission_rate" in summary
        assert "currency" in summary
        assert "ticket_count" in summary
        
        print(f"Commissions day SUCCESS - total commission: {summary['total_commission']}")
    
    def test_commissions_week(self, admin_token):
        """Test commissions with week period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/commissions?period=week",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Commissions week failed: {response.text}"
        print("Commissions week period SUCCESS")
    
    def test_commissions_month(self, admin_token):
        """Test commissions with month period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/commissions?period=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Commissions month failed: {response.text}"
        print("Commissions month period SUCCESS")
    
    def test_commissions_vendor(self, vendor_token):
        """Test that vendor can access their own commissions"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/commissions?period=day",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Vendor commissions failed: {response.text}"
        data = response.json()
        assert "summary" in data
        print("Vendor commissions SUCCESS")


class TestDetailedSellerReport:
    """Test /api/accounting/detailed-seller-report endpoint (UserReport page)"""
    
    def test_detailed_seller_report_daily(self, vendor_token):
        """Test detailed seller report with daily period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Detailed seller report failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "period_label" in data
        assert "seller" in data
        assert "summary" in data
        assert "ticket_counts" in data
        assert "tickets" in data
        
        # Verify seller info
        seller = data["seller"]
        assert "id" in seller
        assert "name" in seller
        assert "commission_rate" in seller
        assert "currency" in seller
        
        # Verify summary
        summary = data["summary"]
        assert "total_sales" in summary
        assert "total_wins" in summary
        assert "total_commission" in summary
        assert "net_profit" in summary
        
        # Verify ticket counts
        counts = data["ticket_counts"]
        assert "total" in counts
        assert "pending" in counts
        assert "won" in counts
        
        print(f"Detailed seller report daily SUCCESS - seller: {seller['name']}, sales: {summary['total_sales']}")
    
    def test_detailed_seller_report_weekly(self, vendor_token):
        """Test detailed seller report with weekly period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=weekly",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Detailed seller report weekly failed: {response.text}"
        data = response.json()
        assert data["period"] == "weekly"
        assert "daily_breakdown" in data
        print("Detailed seller report weekly SUCCESS")
    
    def test_detailed_seller_report_biweekly(self, vendor_token):
        """Test detailed seller report with biweekly period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=biweekly",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Detailed seller report biweekly failed: {response.text}"
        data = response.json()
        assert data["period"] == "biweekly"
        print("Detailed seller report biweekly SUCCESS")
    
    def test_detailed_seller_report_monthly(self, vendor_token):
        """Test detailed seller report with monthly period"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=monthly",
            headers={"Authorization": f"Bearer {vendor_token}"}
        )
        assert response.status_code == 200, f"Detailed seller report monthly failed: {response.text}"
        data = response.json()
        assert data["period"] == "monthly"
        assert "daily_breakdown" in data
        print("Detailed seller report monthly SUCCESS")
    
    def test_detailed_seller_report_admin(self, admin_token):
        """Test that admin can also access detailed seller report"""
        response = requests.get(
            f"{BASE_URL}/api/accounting/detailed-seller-report?period=daily",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Admin detailed seller report failed: {response.text}"
        print("Admin detailed seller report SUCCESS")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
