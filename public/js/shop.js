const productsEl = document.getElementById('products');
const cartItemsEl = document.getElementById('cart-items');
const subtotalEl = document.getElementById('subtotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const pointsEl = document.getElementById('points');
const pointsRedeemEl = document.getElementById('pointsRedeem');
const cartMsg = document.getElementById('cart-msg');

let cart = [];

function renderProducts(products){
  productsEl.innerHTML = '';
  products.forEach(p => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <img src="${p.image_url}" alt="${p.name}" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:8px"/>
      <h3>${p.name}</h3>
      <div class="muted">${p.description||''}</div>
      <div class="price">${B2B.formatCurrency(p.price)}</div>
      <button data-id="${p.id}">Add to cart</button>
    `;
    div.querySelector('button').addEventListener('click', () => addToCart(p));
    productsEl.appendChild(div);
  });
}

function addToCart(product){
  const existing = cart.find(i => i.productId === product.id);
  if (existing) existing.quantity += 1; else cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
  renderCart();
}

function removeFromCart(productId){
  cart = cart.filter(i => i.productId !== productId);
  renderCart();
}

function renderCart(){
  cartItemsEl.innerHTML = '';
  let subtotal = 0;
  cart.forEach(it => {
    const line = it.quantity * it.price;
    subtotal += line;
    const div = document.createElement('div');
    div.className = 'row between center card';
    div.innerHTML = `
      <div>
        <strong>${it.name}</strong>
        <div class="muted">${B2B.formatCurrency(it.price)} × <input data-id="${it.productId}" type="number" min="1" value="${it.quantity}" style="width:80px"/></div>
      </div>
      <div>
        <strong>${B2B.formatCurrency(line)}</strong>
        <button data-remove="${it.productId}" style="margin-left:10px">Remove</button>
      </div>
    `;
    div.querySelector('input').addEventListener('change', (e) => {
      const v = Math.max(1, parseInt(e.target.value||'1',10));
      it.quantity = v; renderCart();
    });
    div.querySelector('[data-remove]').addEventListener('click', () => removeFromCart(it.productId));
    cartItemsEl.appendChild(div);
  });
  subtotalEl.textContent = B2B.formatCurrency(subtotal);
}

async function load(){
  try{
    const [products, me] = await Promise.all([
      B2B.api('/api/groceries'),
      B2B.api('/api/auth/me')
    ]);
    renderProducts(products);
    if (me.user) {
      const bal = await B2B.api('/api/user/points-balance');
      pointsEl.textContent = bal.points_balance;
    } else {
      pointsEl.textContent = '-';
    }
  }catch(err){
    console.error(err);
  }
}

checkoutBtn.addEventListener('click', async () => {
  cartMsg.textContent='';
  try {
    const items = cart.map(i => ({ productId: i.productId, quantity: i.quantity }));
    const pointsToRedeem = Math.max(0, parseInt(pointsRedeemEl.value||'0',10));
    const res = await B2B.api('/api/cart/checkout', { method:'POST', body: JSON.stringify({ items, pointsToRedeem }) });
    cart = []; renderCart(); pointsRedeemEl.value = '0';
    cartMsg.style.color='green';
    cartMsg.textContent = `Order placed! ID ${res.orderId}. Discount ${B2B.formatCurrency(res.discountApplied)} using ${res.pointsRedeemed} points.`;
  } catch (err) {
    cartMsg.style.color='crimson';
    cartMsg.textContent = err.message + ' (Login required?)';
  }
});

load();

