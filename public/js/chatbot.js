(() => {
  const root = document.getElementById('chatbot-root');
  if (!root) return;
  const btn = document.createElement('button');
  btn.className = 'chatbot-btn';
  btn.title = 'Ask Bin 2 Basket';
  btn.innerText = 'B2B';
  root.appendChild(btn);
  const panel = document.createElement('div');
  panel.className = 'chatbot-panel';
  panel.innerHTML = `
    <div class="chat-header">Bin 2 Basket Assistant</div>
    <div class="chat-body" id="chat-body"></div>
    <div class="chat-input">
      <input id="chat-input" placeholder="Ask about how B2B works..." />
      <button id="chat-send">Send</button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#chat-body');
  const input = panel.querySelector('#chat-input');
  const send = panel.querySelector('#chat-send');

  const KNOWLEDGE = [
    { q: /register|sign\s*up|create.*account/i, a: 'Go to Register, fill details, submit. You will receive a unique User ID (starts with B2B-). Use it when you hand over waste.' },
    { q: /login/i, a: 'Use your email and password on the Login page. If you forgot your password, contact support.' },
    { q: /waste|submit|recycl/i, a: 'Submit waste physically at partner centers. The admin records your User ID, waste type, and weight. Points are added automatically.' },
    { q: /point|earn|score/i, a: 'Points are calculated by type and weight. Example per kg: plastic 5, metal 10, paper 3, glass 6, e-waste 15, organic 2.' },
    { q: /redeem|discount/i, a: 'You can redeem points for grocery discounts, capped at 20% of the order subtotal. Unused points remain.' },
    { q: /history|balance|usage/i, a: 'Check My Account for waste submissions, points balance, ledger changes, and orders.' },
    { q: /grocery|shop|buy/i, a: 'Open Groceries to browse items, add to cart, and checkout. You can choose how many points to redeem at checkout (up to 20% cap).' },
    { q: /contact|help|support/i, a: 'For additional help, reach out to support@bin2basket.com.' },
  ];

  function reply(text){
    const div = document.createElement('div');
    div.className = 'bubble bot';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  function ask(text){
    const div = document.createElement('div');
    div.className = 'bubble user';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }
  function handle(inputText){
    const text = inputText.trim();
    if (!text) return;
    ask(text);
    const found = KNOWLEDGE.find(k => k.q.test(text));
    if (found) reply(found.a);
    else reply('I can answer questions about Bin 2 Basket registration, waste submissions, points, discounts, history, and groceries.');
  }

  btn.addEventListener('click', () => panel.classList.toggle('open'));
  send.addEventListener('click', () => { handle(input.value); input.value=''; });
  input.addEventListener('keydown', e => { if (e.key==='Enter'){ handle(input.value); input.value=''; }});

  // Welcome message
  reply('Hi! I am your Bin 2 Basket assistant. Ask me about how the site works.');
})();

