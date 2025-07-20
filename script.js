document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');
  const depositForm = document.getElementById('deposit-form');
  const landlordResponseForm = document.getElementById('landlord-response-form');
  const tenantResponseForm = document.getElementById('tenant-response-form');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const result = await response.json();
      document.getElementById('register-message').textContent = result.message;
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      document.getElementById('login-message').textContent = result.message;
      if (response.ok) window.location.href = '/dashboard';
    });
  }

  if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('amount').value;
      const response = await fetch('/api/deposit/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const result = await response.json();
      document.getElementById('deposit-status').textContent = result.message;
      checkDepositStatus();
    });
  }

  if (landlordResponseForm) {
    landlordResponseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const deduction = document.getElementById('deduction').value;
      const documentation = document.getElementById('documentation').files[0];
      const formData = new FormData();
      formData.append('deduction', deduction);
      formData.append('documentation', documentation);
      const response = await fetch('/api/deposit/respond', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      document.getElementById('deposit-status').textContent = result.message;
      checkDepositStatus();
    });
  }

  if (tenantResponseForm) {
    document.getElementById('accept-response').addEventListener('click', async () => {
      const response = await fetch('/api/deposit/accept', { method: 'POST' });
      const result = await response.json();
      document.getElementById('deposit-status').textContent = result.message;
      checkDepositStatus();
    });
    document.getElementById('dispute-response').addEventListener('click', async () => {
      const response = await fetch('/api/deposit/dispute', { method: 'POST' });
      const result = await response.json();
      document.getElementById('deposit-status').textContent = result.message;
      checkDepositStatus();
    });
  }

  async function checkDepositStatus() {
    const response = await fetch('/api/deposit/status');
    const result = await response.json();
    if (result.role === 'tenant' && result.depositStatus) {
      document.getElementById('deposit-status').textContent = `Deposit: €${result.depositStatus.amount}, Status: ${result.depositStatus.status}`;
      if (result.depositStatus.status === 'responded') {
        document.getElementById('landlord-response').textContent = `Deduction: €${result.depositStatus.deduction}`;
        document.getElementById('tenant-response-form').style.display = 'block';
      }
    } else if ((result.role === 'landlord' || result.role === 'agent') && result.depositStatus) {
      document.getElementById('deposit-status').textContent = `Tenant requested: €${result.depositStatus.amount}`;
      document.getElementById('landlord-response-form').style.display = 'block';
    }
    document.getElementById('user-info').textContent = `Logged in as: ${result.email} (${result.role})`;
  }

  if (document.getElementById('dashboard')) checkDepositStatus();
});