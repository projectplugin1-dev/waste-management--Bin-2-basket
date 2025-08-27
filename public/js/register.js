const form = document.getElementById('reg-form');
const msg = document.getElementById('reg-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  try {
    const res = await B2B.api('/api/auth/register', { method:'POST', body: JSON.stringify({ name, email, phone, password }) });
    msg.textContent = `Account created! Your User ID is ${res.user_uid}. Please login.`;
    msg.style.color = 'green';
    setTimeout(()=> location.href = '/login.html', 1500);
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'crimson';
  }
});

