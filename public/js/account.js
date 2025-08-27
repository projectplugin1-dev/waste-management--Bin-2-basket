const profileEl = document.getElementById('profile');
const pointsEl = document.getElementById('points');
const wasteTable = document.getElementById('waste-table');
const ledgerTable = document.getElementById('ledger-table');
const ordersTable = document.getElementById('orders-table');
const logoutBtn = document.getElementById('logoutBtn');

async function load(){
  const me = await B2B.api('/api/auth/me');
  if (!me.user) { location.href = '/login.html'; return; }
  profileEl.innerHTML = `
    <div><strong>Name:</strong> ${me.user.name}</div>
    <div><strong>Email:</strong> ${me.user.email}</div>
    <div><strong>User ID:</strong> <span class="badge">${me.user.user_uid}</span></div>`;
  const h = await B2B.api('/api/user/history');
  pointsEl.textContent = h.points_balance;
  wasteTable.innerHTML = '<tr><th>Date</th><th>Type</th><th>Weight (kg)</th><th>Points</th></tr>' +
    h.waste_submissions.map(w => `<tr><td>${new Date(w.created_at).toLocaleString()}</td><td>${w.waste_type}</td><td>${w.weight_kg}</td><td>${w.points_awarded}</td></tr>`).join('');
  ledgerTable.innerHTML = '<tr><th>Date</th><th>Change</th><th>Reason</th><th>Ref</th></tr>' +
    h.points_ledger.map(l => `<tr><td>${new Date(l.created_at).toLocaleString()}</td><td>${l.change_amount}</td><td>${l.reason}</td><td>${l.reference_id||''}</td></tr>`).join('');
  ordersTable.innerHTML = '<tr><th>Date</th><th>Status</th><th>Subtotal</th><th>Discount</th><th>Points</th><th>Total</th></tr>' +
    h.orders.map(o => `<tr><td>${new Date(o.created_at).toLocaleString()}</td><td>${o.status}</td><td>${B2B.formatCurrency(o.subtotal)}</td><td>${B2B.formatCurrency(o.discount_value)}</td><td>${o.points_redeemed}</td><td>${B2B.formatCurrency(o.total)}</td></tr>`).join('');
}

logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await B2B.api('/api/auth/logout', { method:'POST' }); location.href='/'; } catch {}
});

load();

