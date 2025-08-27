const form = document.getElementById('login-form');
const msg = document.getElementById('login-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const res = await B2B.api('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    msg.textContent = 'Logged in! Redirecting...';
    msg.style.color = 'green';
    setTimeout(()=> location.href = '/account.html', 600);
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'crimson';
  }
});

