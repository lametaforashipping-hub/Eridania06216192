"""
Test cases for Lottery Results automatic scraping and scheduler system
Tests: sources-check, latest results, preview, fetch-now, scheduler control
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@loteria.com"
SUPER_ADMIN_PASSWORD = "admin123"
VENDEDOR_EMAIL = "vendedor@test.com"
VENDEDOR_PASSWORD = "12345678"


class TestLotteryResultsAuth:
    """Test authentication and get tokens"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get super admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def vendedor_token(self):
        """Get vendedor auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEDOR_EMAIL,
            "password": VENDEDOR_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Vendedor account not found - skipping vendedor tests")
        data = response.json()
        return data.get("token")


class TestSourcesCheck:
    """Test /api/lottery-results/sources-check endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_sources_check_returns_4_sources(self, admin_token):
        """Verify all 4 lottery data sources are checked"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/sources-check",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have 4 sources
        assert "sources" in data
        assert len(data["sources"]) == 4
        
        # Verify expected sources
        source_names = [s["name"] for s in data["sources"]]
        expected_sources = ["conectate.com.do", "loteriasdominicanas.com", "quinielasrd.com", "loteriard.com"]
        for expected in expected_sources:
            assert expected in source_names, f"Missing source: {expected}"
        
        # Verify validation_possible field exists
        assert "validation_possible" in data
        assert "online_count" in data
        assert "total_sources" in data
        print(f"✓ Sources check: {data['online_count']}/{data['total_sources']} online")
    
    def test_sources_check_at_least_2_online_for_validation(self, admin_token):
        """Verify at least 2 sources are online for cross-validation"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/sources-check",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        
        online_count = data.get("online_count", 0)
        assert online_count >= 2, f"Need at least 2 online sources for validation, got {online_count}"
        assert data.get("validation_possible") == True
        print(f"✓ Validation possible: {online_count} sources online")


class TestLatestResults:
    """Test /api/lottery-results/latest endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_latest_results_structure(self, admin_token):
        """Verify latest results response structure"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/latest",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "results" in data
        assert "total" in data
        assert "validated_count" in data
        assert "timestamp" in data
        
        print(f"✓ Got {data['total']} results, {data['validated_count']} validated")
    
    def test_latest_results_contain_validated_lotteries(self, admin_token):
        """Verify results contain validated lottery data with correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/latest",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        results = data.get("results", [])
        
        # Should have results
        assert len(results) > 0, "No lottery results found"
        
        # Verify result structure
        for result in results:
            assert "lottery_name" in result
            assert "first_prize" in result
            assert "second_prize" in result
            assert "third_prize" in result
            assert "validated" in result
            assert "validation_sources" in result
            assert "source" in result
            
            # Prizes should be valid numbers (0-99 for 2-digit lottery)
            assert 0 <= result["first_prize"] <= 99
            
        print(f"✓ Result structure valid for {len(results)} lotteries")
    
    def test_validated_results_have_multiple_sources(self, admin_token):
        """Verify validated results have 2+ confirmation sources"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/latest",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        
        validated_results = [r for r in data.get("results", []) if r.get("validated")]
        
        for result in validated_results:
            sources = result.get("validation_sources", [])
            assert len(sources) >= 2, f"Validated result for {result['lottery_name']} has only {len(sources)} sources"
        
        print(f"✓ All {len(validated_results)} validated results have 2+ sources")


class TestPreviewResults:
    """Test /api/lottery-results/preview endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_preview_returns_matched_lotteries(self, admin_token):
        """Verify preview shows lottery matches and potential winners"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/preview",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "preview" in data
        assert "total_lotteries" in data
        assert "validated_count" in data
        
        # Verify preview item structure
        if len(data["preview"]) > 0:
            preview_item = data["preview"][0]
            assert "scraped_name" in preview_item
            assert "matched_lottery" in preview_item  # Can be null if no match
            assert "results" in preview_item
            assert "validated" in preview_item
            assert "pending_winners" in preview_item
            assert "total_potential_winners" in preview_item
            
            # Verify results structure
            results = preview_item["results"]
            assert "first" in results
            assert "second" in results
            assert "third" in results
        
        print(f"✓ Preview returned {data['total_lotteries']} lotteries")


class TestFetchNow:
    """Test /api/lottery-results/fetch-now endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_fetch_now_triggers_search(self, admin_token):
        """Verify manual fetch can be triggered"""
        response = requests.post(
            f"{BASE_URL}/api/lottery-results/fetch-now",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "status" in data
        assert data["status"] == "processing"
        print(f"✓ Fetch triggered: {data['message']}")


class TestSchedulerStatus:
    """Test /api/lottery-results/status endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_status_returns_scheduler_info(self, admin_token):
        """Verify scheduler status endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "scheduler" in data
        assert "timestamp" in data
        
        scheduler = data["scheduler"]
        assert "is_running" in scheduler
        print(f"✓ Scheduler status: {'RUNNING' if scheduler['is_running'] else 'STOPPED'}")


class TestSchedulerControl:
    """Test scheduler start/stop endpoints (Super Admin only)"""
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def vendedor_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": VENDEDOR_EMAIL,
            "password": VENDEDOR_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Vendedor account not available")
        return response.json()["token"]
    
    def test_scheduler_start_super_admin_only(self, super_admin_token):
        """Verify scheduler can be started by super admin"""
        response = requests.post(
            f"{BASE_URL}/api/lottery-results/scheduler/start",
            headers={
                "Authorization": f"Bearer {super_admin_token}",
                "Content-Type": "application/json"
            },
            json={"interval_minutes": 5, "enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "status" in data
        print(f"✓ Scheduler started: {data['message']}")
    
    def test_scheduler_stop_super_admin_only(self, super_admin_token):
        """Verify scheduler can be stopped by super admin"""
        response = requests.post(
            f"{BASE_URL}/api/lottery-results/scheduler/stop",
            headers={
                "Authorization": f"Bearer {super_admin_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "status" in data
        print(f"✓ Scheduler stopped: {data['message']}")
    
    def test_vendedor_cannot_start_scheduler(self, vendedor_token):
        """Verify vendedor cannot control scheduler"""
        response = requests.post(
            f"{BASE_URL}/api/lottery-results/scheduler/start",
            headers={
                "Authorization": f"Bearer {vendedor_token}",
                "Content-Type": "application/json"
            },
            json={"interval_minutes": 5, "enabled": True}
        )
        # Should return 403 Forbidden for non-super_admin
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Vendedor correctly denied scheduler access")


class TestResultsHistory:
    """Test /api/lottery-results/history endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_history_returns_draws(self, admin_token):
        """Verify history endpoint returns draw data"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/history",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "draws" in data
        assert "total" in data
        print(f"✓ History returned {data['total']} draws")


class TestExpectedLotteryResults:
    """Verify the expected lottery results are present in the scraper output"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_expected_lotteries_present(self, admin_token):
        """Verify expected lotteries are in results"""
        response = requests.get(
            f"{BASE_URL}/api/lottery-results/latest",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        results = data.get("results", [])
        
        lottery_names = [r["lottery_name"].lower() for r in results]
        
        # Expected lotteries mentioned in problem statement
        expected_lotteries = ["nacional", "leidsa", "real", "loteka", "lotedom"]
        found = []
        
        for expected in expected_lotteries:
            if expected in lottery_names:
                found.append(expected)
        
        print(f"✓ Found {len(found)}/{len(expected_lotteries)} expected lotteries: {found}")
        
        # At least some expected lotteries should be found
        assert len(found) >= 3, f"Expected at least 3 lotteries, found only {found}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
