async function api(path, opts={}){
  const res = await fetch(path, { headers: { 'Content-Type':'application/json' }, credentials:'same-origin', ...opts });
  if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Request failed');
  return res.json();
}

const authCard = document.getElementById('auth-card');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authMsg = document.getElementById('auth-msg');

const userSearch = document.getElementById('userSearch');
const userSearchBtn = document.getElementById('userSearchBtn');
const usersTable = document.getElementById('users-table');

const wsUserUid = document.getElementById('ws_user_uid');
const wsType = document.getElementById('ws_type');
const wsWeight = document.getElementById('ws_weight');
const wsSubmit = document.getElementById('ws_submit');
const wsMsg = document.getElementById('ws_msg');

const orderFilter = document.getElementById('orderFilter');
const reloadOrders = document.getElementById('reloadOrders');
const ordersTable = document.getElementById('orders-table');

async function checkAdmin(){
  try{ const me = await api('/api/admin/me'); if (me.user && me.user.role==='admin'){ showDashboard(); } else showLogin(); }
  catch{ showLogin(); }
}

function showLogin(){
  authCard.style.display='block';
  dashboard.style.display='none';
}
function showDashboard(){
  authCard.style.display='none';
  dashboard.style.display='block';
  loadUsers(); loadOrders();
}

loginBtn.addEventListener('click', async () => {
  authMsg.textContent='';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try{
    await api('/api/admin/login', { method:'POST', body: JSON.stringify({ email, password }) });
    showDashboard();
  }catch(err){ authMsg.style.color='crimson'; authMsg.textContent = err.message; }
});

logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await api('/api/admin/logout', { method:'POST' }); showLogin(); }
  catch{}
});

async function loadUsers(){
  try{
    const q = userSearch.value.trim();
    const path = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users';
    const rows = await api(path);
    usersTable.innerHTML = '<tr><th>User ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Points</th><th>Created</th></tr>' +
      rows.map(u => `<tr><td>${u.user_uid}</td><td>${u.name}</td><td>${u.email}</td><td>${u.phone||''}</td><td>${u.points_balance}</td><td>${new Date(u.created_at).toLocaleString()}</td></tr>`).join('');
  }catch(err){ usersTable.innerHTML = `<tr><td>${err.message}</td></tr>`; }
}
userSearchBtn.addEventListener('click', loadUsers);

wsSubmit.addEventListener('click', async () => {
  wsMsg.textContent='';
  try{
    const user_uid = wsUserUid.value.trim();
    const waste_type = wsType.value;
    const weight_kg = parseFloat(wsWeight.value||'0');
    const res = await api('/api/admin/waste-submissions', { method:'POST', body: JSON.stringify({ user_uid, waste_type, weight_kg }) });
    wsMsg.style.color='green'; wsMsg.textContent = `Recorded. Points awarded: ${res.points_awarded}`;
    loadUsers();
  }catch(err){ wsMsg.style.color='crimson'; wsMsg.textContent = err.message; }
});

async function loadOrders(){
  try{
    const status = orderFilter.value;
    const rows = await api(status ? `/api/admin/orders?status=${encodeURIComponent(status)}` : '/api/admin/orders');
    ordersTable.innerHTML = '<tr><th>ID</th><th>User</th><th>Status</th><th>Subtotal</th><th>Discount</th><th>Points</th><th>Total</th><th>Actions</th></tr>' +
      rows.map(o => `<tr>
        <td>${o.id}</td><td>${o.user_id}</td><td>${o.status}</td>
        <td>${Number(o.subtotal).toFixed(2)}</td><td>${Number(o.discount_value).toFixed(2)}</td>
        <td>${o.points_redeemed}</td><td>${Number(o.total).toFixed(2)}</td>
        <td>${o.status==='PENDING' ? `<button data-accept="${o.id}">Accept</button> <button data-decline="${o.id}">Decline</button>` : ''}</td>
      </tr>`).join('');
    ordersTable.querySelectorAll('[data-accept]').forEach(btn => btn.addEventListener('click', () => acceptOrder(parseInt(btn.dataset.accept,10))));
    ordersTable.querySelectorAll('[data-decline]').forEach(btn => btn.addEventListener('click', () => declineOrder(parseInt(btn.dataset.decline,10))));
  }catch(err){ ordersTable.innerHTML = `<tr><td>${err.message}</td></tr>`; }
}
reloadOrders.addEventListener('click', loadOrders);
orderFilter.addEventListener('change', loadOrders);

async function acceptOrder(id){
  try{ await api(`/api/admin/orders/${id}/accept`, { method:'POST' }); loadOrders(); } catch(err){ alert(err.message); }
}
async function declineOrder(id){
  const reason = prompt('Reason for decline (optional):') || '';
  try{ await api(`/api/admin/orders/${id}/decline`, { method:'POST', body: JSON.stringify({ reason }) }); loadOrders(); } catch(err){ alert(err.message); }
}

checkAdmin();

