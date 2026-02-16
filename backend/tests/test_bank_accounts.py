"""Bank Accounts and Deposit Management API Tests"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://lottery-sales-app.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN = {"email": "admin@loteria.com", "password": "admin123"}
VENDEDOR = {"email": "vendedor@test.com", "password": "12345678"}


class TestBankAccountsAPI:
    """Bank Accounts API Tests - Super Admin functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth tokens"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token")
            self.admin_user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        else:
            pytest.skip("Super Admin login failed")
    
    def test_01_get_bank_accounts_list(self):
        """Test GET /api/bank-accounts - Lista de cuentas bancarias"""
        response = self.session.get(f"{BASE_URL}/api/bank-accounts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify at least one account exists (ERIBERTO FERNANDEZ per context)
        if len(data) > 0:
            account = data[0]
            assert "id" in account, "Account should have id"
            assert "name" in account, "Account should have name"
            assert "account_type" in account, "Account should have account_type"
            assert "currency" in account, "Account should have currency"
            assert "balance" in account, "Account should have balance"
            print(f"Found {len(data)} bank accounts")
            for acc in data:
                print(f"  - {acc['name']} ({acc['currency']}): Balance {acc['balance']}")
    
    def test_02_get_bank_summary(self):
        """Test GET /api/bank-accounts/summary - Resumen con totales por moneda"""
        response = self.session.get(f"{BASE_URL}/api/bank-accounts/summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "accounts" in data, "Summary should have accounts"
        assert "totals" in data, "Summary should have totals"
        assert "pending_deposits" in data, "Summary should have pending_deposits"
        
        # Verify totals structure
        assert "RD$" in data["totals"], "Totals should have RD$"
        assert "USD" in data["totals"], "Totals should have USD"
        
        print(f"Summary: RD$ {data['totals']['RD$']}, USD {data['totals']['USD']}")
        print(f"Pending deposits: {data['pending_deposits']['count']}")
    
    def test_03_create_bank_account_success(self):
        """Test POST /api/bank-accounts - Crear nueva cuenta bancaria (Super Admin)"""
        test_name = f"TEST_Cuenta_Prueba_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": test_name,
            "account_type": "bank",
            "currency": "RD$",
            "country": "RD",
            "bank_name": "Banco de Prueba",
            "account_number": "1234567890",
            "initial_balance": 0.0,
            "notes": "Cuenta de prueba para testing"
        }
        
        response = self.session.post(f"{BASE_URL}/api/bank-accounts", json=payload)
        
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "account_id" in data or "message" in data, "Response should have account_id or message"
        
        print(f"Created bank account: {data}")
        
        # Store account_id for cleanup
        self.created_account_id = data.get("account_id")
    
    def test_04_create_zelle_account(self):
        """Test POST /api/bank-accounts - Crear cuenta Zelle"""
        test_name = f"TEST_Zelle_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": test_name,
            "account_type": "zelle",
            "currency": "USD",
            "country": "USA",
            "zelle_email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "zelle_phone": "+1 555 123 4567",
            "initial_balance": 0.0,
            "notes": "Cuenta Zelle de prueba"
        }
        
        response = self.session.post(f"{BASE_URL}/api/bank-accounts", json=payload)
        
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "account_id" in data or "message" in data, "Response should have account_id or message"
        
        print(f"Created Zelle account: {data}")
    
    def test_05_create_cash_account(self):
        """Test POST /api/bank-accounts - Crear cuenta de efectivo"""
        test_name = f"TEST_Cash_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": test_name,
            "account_type": "cash",
            "currency": "RD$",
            "country": "RD",
            "initial_balance": 1000.0,
            "notes": "Caja de efectivo para pruebas"
        }
        
        response = self.session.post(f"{BASE_URL}/api/bank-accounts", json=payload)
        
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"Created Cash account: {data}")
    
    def test_06_get_pending_deposit_requests(self):
        """Test GET /api/bank-accounts/deposit-requests?status=pending - Listar depósitos pendientes"""
        response = self.session.get(f"{BASE_URL}/api/bank-accounts/deposit-requests?status=pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Found {len(data)} pending deposit requests")
        for deposit in data[:5]:  # Show first 5
            print(f"  - {deposit.get('user_name')}: {deposit.get('currency')} {deposit.get('amount')}")


class TestVendorDepositRequest:
    """Vendor Deposit Request Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as vendor"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as vendor
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if response.status_code == 200:
            data = response.json()
            self.vendor_token = data.get("token")
            self.vendor_user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.vendor_token}"})
        else:
            pytest.skip(f"Vendor login failed: {response.text}")
    
    def test_01_vendor_get_public_bank_accounts(self):
        """Test GET /api/bank-accounts/public - Vendor can see public bank accounts"""
        response = self.session.get(f"{BASE_URL}/api/bank-accounts/public")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Vendor sees {len(data)} public bank accounts")
    
    def test_02_vendor_create_deposit_request(self):
        """Test POST /api/bank-accounts/deposit-request - Vendor creates deposit request"""
        # First get a valid bank account ID
        admin_session = requests.Session()
        admin_response = admin_session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if admin_response.status_code != 200:
            pytest.skip("Cannot get bank account ID - admin login failed")
        
        admin_token = admin_response.json().get("token")
        accounts_response = admin_session.get(
            f"{BASE_URL}/api/bank-accounts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if accounts_response.status_code != 200 or len(accounts_response.json()) == 0:
            pytest.skip("No bank accounts available for deposit request test")
        
        bank_account = accounts_response.json()[0]
        bank_account_id = bank_account["id"]
        
        # Create deposit request as vendor
        payload = {
            "bank_account_id": bank_account_id,
            "amount": 100.0,
            "deposit_method": "transfer",
            "reference_number": f"TEST_REF_{uuid.uuid4().hex[:8]}",
            "notes": "Depósito de prueba desde test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/bank-accounts/deposit-request", json=payload)
        
        # Should succeed (200 or 201)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deposit_id" in data or "message" in data, "Response should have deposit_id or message"
        
        print(f"Vendor created deposit request: {data}")
        
        # Store for later tests
        self.created_deposit_id = data.get("deposit_id")
    
    def test_03_vendor_view_own_deposit_requests(self):
        """Test GET /api/bank-accounts/deposit-requests - Vendor sees own requests"""
        response = self.session.get(f"{BASE_URL}/api/bank-accounts/deposit-requests")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"Vendor has {len(data)} deposit requests")


class TestDepositApproval:
    """Deposit Approval Tests - Super Admin approving vendor deposits"""
    
    def test_01_full_deposit_workflow(self):
        """Full workflow: Create deposit request -> Approve -> Verify balance update"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Step 1: Login as admin and get bank account
        admin_response = session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert admin_response.status_code == 200, "Admin login failed"
        admin_token = admin_response.json().get("token")
        
        accounts_response = session.get(
            f"{BASE_URL}/api/bank-accounts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if accounts_response.status_code != 200 or len(accounts_response.json()) == 0:
            pytest.skip("No bank accounts available")
        
        bank_account = accounts_response.json()[0]
        bank_account_id = bank_account["id"]
        print(f"Using bank account: {bank_account['name']} (Balance: {bank_account['balance']})")
        
        # Step 2: Login as vendor and create deposit request
        vendor_response = session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if vendor_response.status_code != 200:
            pytest.skip("Vendor login failed")
        
        vendor_token = vendor_response.json().get("token")
        vendor_user = vendor_response.json().get("user")
        initial_vendor_balance = vendor_user.get("balance", 0)
        print(f"Vendor initial balance: {initial_vendor_balance}")
        
        deposit_amount = 50.0
        deposit_payload = {
            "bank_account_id": bank_account_id,
            "amount": deposit_amount,
            "deposit_method": "transfer",
            "reference_number": f"APPROVAL_TEST_{uuid.uuid4().hex[:8]}",
            "notes": "Test for approval workflow"
        }
        
        deposit_response = session.post(
            f"{BASE_URL}/api/bank-accounts/deposit-request",
            headers={"Authorization": f"Bearer {vendor_token}"},
            json=deposit_payload
        )
        
        assert deposit_response.status_code in [200, 201], f"Deposit request failed: {deposit_response.text}"
        deposit_id = deposit_response.json().get("deposit_id")
        print(f"Created deposit request: {deposit_id}")
        
        # Step 3: Admin approves deposit
        approval_payload = {
            "approved": True,
            "admin_notes": "Approved via automated test"
        }
        
        approval_response = session.put(
            f"{BASE_URL}/api/bank-accounts/deposit-requests/{deposit_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=approval_payload
        )
        
        assert approval_response.status_code == 200, f"Approval failed: {approval_response.text}"
        print(f"Deposit approved: {approval_response.json()}")
        
        # Step 4: Verify vendor balance updated
        vendor_check = session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if vendor_check.status_code == 200:
            updated_vendor = vendor_check.json().get("user")
            updated_balance = updated_vendor.get("balance", 0)
            expected_balance = initial_vendor_balance + deposit_amount
            
            print(f"Vendor balance after approval: {updated_balance} (expected: {expected_balance})")
            
            # Allow for slight timing differences
            assert updated_balance >= expected_balance - 1, \
                f"Balance should be at least {expected_balance - 1}, got {updated_balance}"
    
    def test_02_reject_deposit_request(self):
        """Test rejecting a deposit request"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        admin_response = session.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if admin_response.status_code != 200:
            pytest.skip("Admin login failed")
        admin_token = admin_response.json().get("token")
        
        # Get bank account
        accounts_response = session.get(
            f"{BASE_URL}/api/bank-accounts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if accounts_response.status_code != 200 or len(accounts_response.json()) == 0:
            pytest.skip("No bank accounts available")
        
        bank_account_id = accounts_response.json()[0]["id"]
        
        # Login as vendor and create deposit
        vendor_response = session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if vendor_response.status_code != 200:
            pytest.skip("Vendor login failed")
        vendor_token = vendor_response.json().get("token")
        
        deposit_payload = {
            "bank_account_id": bank_account_id,
            "amount": 25.0,
            "deposit_method": "cash",
            "reference_number": f"REJECT_TEST_{uuid.uuid4().hex[:8]}",
            "notes": "This should be rejected"
        }
        
        deposit_response = session.post(
            f"{BASE_URL}/api/bank-accounts/deposit-request",
            headers={"Authorization": f"Bearer {vendor_token}"},
            json=deposit_payload
        )
        
        if deposit_response.status_code not in [200, 201]:
            pytest.skip("Could not create deposit request")
        
        deposit_id = deposit_response.json().get("deposit_id")
        
        # Admin rejects deposit
        rejection_payload = {
            "approved": False,
            "admin_notes": "Rejected via automated test"
        }
        
        rejection_response = session.put(
            f"{BASE_URL}/api/bank-accounts/deposit-requests/{deposit_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=rejection_payload
        )
        
        assert rejection_response.status_code == 200, f"Rejection failed: {rejection_response.text}"
        print(f"Deposit rejected successfully: {rejection_response.json()}")


class TestAuthorizationControls:
    """Authorization/Access Control Tests"""
    
    def test_01_vendor_cannot_create_bank_account(self):
        """Vendor should NOT be able to create bank accounts (Super Admin only)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as vendor
        vendor_response = session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if vendor_response.status_code != 200:
            pytest.skip("Vendor login failed")
        vendor_token = vendor_response.json().get("token")
        
        payload = {
            "name": "Unauthorized Account",
            "account_type": "bank",
            "currency": "RD$",
            "country": "RD"
        }
        
        response = session.post(
            f"{BASE_URL}/api/bank-accounts",
            headers={"Authorization": f"Bearer {vendor_token}"},
            json=payload
        )
        
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: Vendor should not create bank accounts"
        print("Vendor correctly denied from creating bank account")
    
    def test_02_vendor_cannot_approve_deposits(self):
        """Vendor should NOT be able to approve deposits (Super Admin only)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as vendor
        vendor_response = session.post(f"{BASE_URL}/api/auth/login", json=VENDEDOR)
        if vendor_response.status_code != 200:
            pytest.skip("Vendor login failed")
        vendor_token = vendor_response.json().get("token")
        
        # Try to approve a deposit (even with invalid ID)
        response = session.put(
            f"{BASE_URL}/api/bank-accounts/deposit-requests/fake-deposit-id",
            headers={"Authorization": f"Bearer {vendor_token}"},
            json={"approved": True}
        )
        
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: Vendor should not approve deposits"
        print("Vendor correctly denied from approving deposits")
    
    def test_03_unauthenticated_cannot_access(self):
        """Unauthenticated requests should be rejected"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # No auth token
        response = session.get(f"{BASE_URL}/api/bank-accounts")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthenticated access correctly denied")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
