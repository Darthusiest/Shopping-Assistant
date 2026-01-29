/**
 * Market Shopper – Live price tracking backend (Option 2).
 * API: POST /api/track, POST /api/untrack, GET /api/prices.
 * Cron: fetches product URLs periodically and updates prices.
 */
const http = require('http');
const { parseProductFromHtml } = require('./parseProduct.js');

const PORT = process.env.PORT || 3000;

// In-memory store: deviceId -> Map(productId -> product)
const store = new Map();

function getProducts(deviceId) {
  if (!store.has(deviceId)) store.set(deviceId, new Map());
  return store.get(deviceId);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function handlePostTrack(req, res) {
  const body = await parseBody(req);
  const { deviceId, productId, url, name, currentPrice } = body;
  if (!deviceId || productId == null || !url) {
    send(res, 400, { error: 'Missing deviceId, productId, or url' });
    return;
  }
  const products = getProducts(deviceId);
  const existing = products.get(String(productId)) || {};
  const product = {
    productId: String(productId),
    url: String(url),
    name: name != null ? String(name) : (existing.name || ''),
    currentPrice: currentPrice != null ? Number(currentPrice) : (existing.currentPrice ?? 0),
    priceHistory: Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [],
    lastChecked: existing.lastChecked || null,
  };
  if (product.priceHistory.length === 0 && product.currentPrice) {
    product.priceHistory.push({ price: product.currentPrice, date: Date.now() });
  }
  products.set(String(productId), product);
  send(res, 200, { ok: true });
}

async function handlePostUntrack(req, res) {
  const body = await parseBody(req);
  const { deviceId, productId } = body;
  if (!deviceId || productId == null) {
    send(res, 400, { error: 'Missing deviceId or productId' });
    return;
  }
  const products = getProducts(deviceId);
  products.delete(String(productId));
  send(res, 200, { ok: true });
}

function handleGetPrices(req, res) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const deviceId = url.searchParams.get('deviceId');
  if (!deviceId) {
    send(res, 400, { error: 'Missing deviceId' });
    return;
  }
  const products = getProducts(deviceId);
  const list = [];
  for (const [id, p] of products) {
    list.push({
      productId: id,
      currentPrice: p.currentPrice,
      priceHistory: p.priceHistory || [],
      lastChecked: p.lastChecked,
    });
  }
  send(res, 200, { products: list });
}

async function fetchPriceForProduct(deviceId, productId, product) {
  if (!product.url || !product.url.startsWith('http')) return;
  try {
    const res = await fetch(product.url, { redirect: 'follow', headers: { 'User-Agent': 'MarketShopper/1.0' } });
    const html = await res.text();
    const parsed = parseProductFromHtml(html, product.url);
    const newPrice = parsed.price ? parseFloat(String(parsed.price).replace(/,/g, '')) : null;
    if (newPrice != null && !Number.isNaN(newPrice)) {
      const prev = product.currentPrice;
      product.currentPrice = newPrice;
      product.lastChecked = Date.now();
      if (prev !== newPrice) {
        product.priceHistory = product.priceHistory || [];
        product.priceHistory.push({ price: newPrice, date: Date.now() });
      }
    }
  } catch (err) {
    console.error(`Fetch failed for ${product.url}:`, err.message);
  }
}

async function runPriceCheck() {
  for (const [deviceId, products] of store) {
    for (const [productId, product] of products) {
      await fetchPriceForProduct(deviceId, productId, product);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

const INTERVAL_MS = 5 * 60 * 1000;
setInterval(runPriceCheck, INTERVAL_MS);
runPriceCheck();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
    return;
  }

  const path = req.url?.split('?')[0] || '';

  if (req.method === 'POST' && path === '/api/track') {
    await handlePostTrack(req, res);
    return;
  }
  if (req.method === 'POST' && path === '/api/untrack') {
    await handlePostUntrack(req, res);
    return;
  }
  if (req.method === 'GET' && path === '/api/prices') {
    handleGetPrices(req, res);
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Market Shopper backend running at http://localhost:${PORT}`);
});
