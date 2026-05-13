const API = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';

const Session = {
  get: () => JSON.parse(localStorage.getItem('hw_user') || 'null'),
  set: (u) => localStorage.setItem('hw_user', JSON.stringify(u)),
  clear: () => localStorage.removeItem('hw_user'),
};

function toast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

async function apiFetch(path, options = {}) {
  const user = Session.get();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (user) { headers.phone = user.phone; headers.password = user.password; }
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function updateCartBadge() {
  const user = Session.get();
  if (!user) return;
  try {
    const data = await apiFetch('/cart/' + user.phone);
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = data.itemCount || 0;
  } catch(e) {}
}

async function addToCart(itemId, name) {
  const user = Session.get();
  if (!user) { toast('Please login to add items to cart', 'error'); setTimeout(() => window.location.href = '/account', 1200); return; }
  try {
    await apiFetch('/cart/' + user.phone + '/add', { method: 'POST', body: JSON.stringify({ itemId, quantity: 1 }) });
    toast(name + ' added to cart');
    updateCartBadge();
  } catch(err) { toast(err.message, 'error'); }
}

function updateAuthUI() {
  const user = Session.get();
  const loginBtn = document.getElementById('login-btn');
  const userInfo = document.getElementById('user-info');
  if (!loginBtn) return;
  if (user) {
    loginBtn.style.display = 'none';
    if (userInfo) { userInfo.style.display = 'flex'; const n = document.getElementById('user-name'); if (n) n.textContent = user.name.split(' ')[0]; }
  } else {
    loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
  }
}

function logout() { Session.clear(); toast('Logged out'); setTimeout(() => window.location.href = '/', 800); }

document.addEventListener('DOMContentLoaded', () => { updateAuthUI(); updateCartBadge(); });
