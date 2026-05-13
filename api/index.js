require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    clientX509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
  }),
});

const db = admin.firestore();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DISCOUNT = { platinum: 0.15, gold: 0.10, silver: 0.05, none: 0 };

function getDiscount(tier) { return DISCOUNT[tier?.toLowerCase()] || 0; }

function applyDiscount(price, tier) {
  const discount = getDiscount(tier);
  return {
    original: price,
    discountPercent: discount * 100,
    discounted: Math.round(price * (1 - discount) * 100) / 100,
  };
}

function estimateDelivery() {
  const days = Math.floor(Math.random() * 3) + 3;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toDateString();
}

async function authMiddleware(req, res, next) {
  const { phone, password } = req.headers;
  if (!phone || !password) return res.status(401).json({ error: 'Phone and password required in headers' });
  const snap = await db.collection('users').where('phone', '==', phone).where('password', '==', password).get();
  if (snap.empty) return res.status(401).json({ error: 'Invalid credentials' });
  req.user = snap.docs[0].data();
  next();
}

// USER ENDPOINTS
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'name, phone and password are required' });
    const existing = await db.collection('users').where('phone', '==', phone).get();
    if (!existing.empty) return res.status(409).json({ error: 'Phone number already registered' });
    const count = (await db.collection('users').get()).size;
    const customerId = String(count + 1).padStart(5, '0');
    const user = { customerId, name, phone, email: email || '', password, membershipTier: 'silver', createdAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection('users').doc(phone).set(user);
    const { password: _p, ...safeUser } = user;
    res.status(201).json({ message: 'Account created successfully', user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const snap = await db.collection('users').where('phone', '==', phone).where('password', '==', password).get();
    if (snap.empty) return res.status(401).json({ error: 'Invalid phone or password' });
    const user = snap.docs[0].data();
    const { password: _p, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
  try {
    const snap = await db.collection('users').get();
    const users = snap.docs.map(d => { const { password: _p, ...u } = d.data(); return u; });
    res.json({ count: users.length, users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:phone', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.phone).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const { password: _p, ...safeUser } = doc.data();
    res.json(safeUser);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/users/:phone/membership', async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['silver','gold','platinum'].includes(tier?.toLowerCase())) return res.status(400).json({ error: 'Tier must be silver, gold, or platinum' });
    await db.collection('users').doc(req.params.phone).update({ membershipTier: tier.toLowerCase() });
    res.json({ message: `Membership updated to ${tier}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/membership/purchase', authMiddleware, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['silver','gold','platinum'].includes(tier?.toLowerCase())) return res.status(400).json({ error: 'Invalid membership tier' });
    const prices = { silver: 499, gold: 999, platinum: 1999 };
    const price = prices[tier.toLowerCase()];
    await db.collection('users').doc(req.user.phone).update({ membershipTier: tier.toLowerCase() });
    const order = { orderId: `MEM-${Date.now()}`, customerId: req.user.customerId, phone: req.user.phone, name: req.user.name, type: 'membership', tier: tier.toLowerCase(), amount: price, status: 'confirmed', estimatedDelivery: 'Instant activation', createdAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection('orders').add(order);
    if (process.env.WEBHOOK_URL) {
      axios.post(process.env.WEBHOOK_URL, { event: 'membership_purchased', orderId: order.orderId, customer: { name: req.user.name, phone: req.user.phone, customerId: req.user.customerId }, membership: { tier: tier.toLowerCase(), price }, timestamp: new Date().toISOString() }).catch(() => {});
    }
    res.json({ message: `${tier} membership activated!`, orderId: order.orderId, amountPaid: price });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// INVENTORY ENDPOINTS
app.get('/api/inventory', async (req, res) => {
  try {
    let query = db.collection('inventory');
    if (req.query.category) query = query.where('category', '==', req.query.category);
    const snap = await query.get();
    res.json({ count: snap.size, products: snap.docs.map(d => d.data()) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/search', async (req, res) => {
  try {
    const { q, itemId } = req.query;
    if (!q && !itemId) return res.status(400).json({ error: 'Provide q (name) or itemId' });
    if (itemId) {
      const snap = await db.collection('inventory').where('itemId', '==', itemId).get();
      if (snap.empty) return res.status(404).json({ error: 'Product not found' });
      return res.json(snap.docs[0].data());
    }
    const term = q.toLowerCase();
    const snap = await db.collection('inventory').get();
    const results = snap.docs.map(d => d.data()).filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
    res.json({ count: results.length, products: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/:itemId', async (req, res) => {
  try {
    const snap = await db.collection('inventory').where('itemId', '==', req.params.itemId).get();
    if (snap.empty) return res.status(404).json({ error: 'Product not found' });
    res.json(snap.docs[0].data());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CART ENDPOINTS
app.get('/api/cart/:phone', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.phone).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    const user = userDoc.data();
    const cartDoc = await db.collection('carts').doc(req.params.phone).get();
    const items = cartDoc.exists ? (cartDoc.data().items || []) : [];
    const discountRate = getDiscount(user.membershipTier);
    let subtotal = 0;
    const enrichedItems = items.map(item => {
      const pricing = applyDiscount(item.price, user.membershipTier);
      subtotal += pricing.discounted * item.quantity;
      return { ...item, pricing };
    });
    res.json({ phone: req.params.phone, membershipTier: user.membershipTier, discountPercent: discountRate * 100, items: enrichedItems, subtotal: Math.round(subtotal * 100) / 100, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cart/:phone/add', async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    const productSnap = await db.collection('inventory').where('itemId', '==', itemId).get();
    if (productSnap.empty) return res.status(404).json({ error: 'Product not found' });
    const product = productSnap.docs[0].data();
    if (product.stock < quantity) return res.status(400).json({ error: `Only ${product.stock} units in stock` });
    const cartRef = db.collection('carts').doc(req.params.phone);
    const cartDoc = await cartRef.get();
    let items = cartDoc.exists ? (cartDoc.data().items || []) : [];
    const idx = items.findIndex(i => i.itemId === itemId);
    if (idx > -1) { items[idx].quantity += quantity; } else { items.push({ itemId: product.itemId, name: product.name, price: product.price, image: product.image, quantity }); }
    await cartRef.set({ phone: req.params.phone, items, updatedAt: new Date().toISOString() });
    res.json({ message: `${product.name} added to cart`, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cart/:phone/remove/:itemId', async (req, res) => {
  try {
    const cartRef = db.collection('carts').doc(req.params.phone);
    const cartDoc = await cartRef.get();
    if (!cartDoc.exists) return res.status(404).json({ error: 'Cart not found' });
    let items = cartDoc.data().items || [];
    const before = items.length;
    items = items.filter(i => i.itemId !== req.params.itemId);
    if (items.length === before) return res.status(404).json({ error: 'Item not in cart' });
    await cartRef.update({ items });
    res.json({ message: 'Item removed from cart' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/cart/:phone/update', async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    if (!itemId || quantity == null) return res.status(400).json({ error: 'itemId and quantity required' });
    const cartRef = db.collection('carts').doc(req.params.phone);
    const cartDoc = await cartRef.get();
    if (!cartDoc.exists) return res.status(404).json({ error: 'Cart not found' });
    let items = cartDoc.data().items || [];
    const idx = items.findIndex(i => i.itemId === itemId);
    if (idx === -1) return res.status(404).json({ error: 'Item not in cart' });
    if (quantity <= 0) { items.splice(idx, 1); } else { items[idx].quantity = quantity; }
    await cartRef.update({ items });
    res.json({ message: 'Cart updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/cart/:phone/clear', async (req, res) => {
  try {
    await db.collection('carts').doc(req.params.phone).set({ phone: req.params.phone, items: [] });
    res.json({ message: 'Cart cleared' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CHECKOUT
app.post('/api/orders/checkout', authMiddleware, async (req, res) => {
  try {
    const { address, paymentMethod = 'card' } = req.body;
    const phone = req.user.phone;
    const cartDoc = await db.collection('carts').doc(phone).get();
    if (!cartDoc.exists || !(cartDoc.data().items || []).length) return res.status(400).json({ error: 'Cart is empty' });
    const items = cartDoc.data().items;
    const discountRate = getDiscount(req.user.membershipTier);
    let subtotal = 0;
    const orderedItems = items.map(item => {
      const pricing = applyDiscount(item.price, req.user.membershipTier);
      const lineTotal = pricing.discounted * item.quantity;
      subtotal += lineTotal;
      return { itemId: item.itemId, name: item.name, quantity: item.quantity, unitPrice: item.price, discountedPrice: pricing.discounted, lineTotal: Math.round(lineTotal * 100) / 100 };
    });
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const delivery = estimateDelivery();
    const orderId = `HW-${Date.now()}`;
    const order = { orderId, customerId: req.user.customerId, name: req.user.name, phone, email: req.user.email, membershipTier: req.user.membershipTier, discountPercent: discountRate * 100, items: orderedItems, subtotal: Math.round(subtotal * 100) / 100, tax, total, address: address || 'Not provided', paymentMethod, paymentStatus: 'paid', status: 'confirmed', estimatedDelivery: delivery, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection('orders').add(order);
    await db.collection('carts').doc(phone).set({ phone, items: [] });
    if (process.env.WEBHOOK_URL) {
      axios.post(process.env.WEBHOOK_URL, { event: 'order_placed', orderId, timestamp: new Date().toISOString(), customer: { customerId: req.user.customerId, name: req.user.name, phone, email: req.user.email, membershipTier: req.user.membershipTier }, order: { items: orderedItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, discountedPrice: i.discountedPrice, lineTotal: i.lineTotal })), subtotal: Math.round(subtotal * 100) / 100, discountApplied: discountRate * 100 + '%', tax, totalAmountPaid: total, paymentMethod }, delivery: { estimatedDelivery: delivery, address: address || 'Not provided' } }, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }).catch(err => console.error('Webhook failed:', err.message));
    }
    res.json({ message: 'Order placed successfully!', orderId, summary: { itemCount: orderedItems.reduce((s, i) => s + i.quantity, 0), subtotal: Math.round(subtotal * 100) / 100, discountApplied: `${discountRate * 100}% (${req.user.membershipTier} membership)`, tax, totalPaid: total, estimatedDelivery: delivery, paymentStatus: 'paid' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/:phone', async (req, res) => {
  try {
    const snap = await db.collection('orders').where('phone', '==', req.params.phone).orderBy('createdAt', 'desc').get();
    res.json({ count: snap.size, orders: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Himalaya Wellness API', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Himalaya Wellness API running on http://localhost:${PORT}`));
module.exports = app;
