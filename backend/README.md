# Market Shopper – Live price tracking backend (Option 2)

Node.js backend for automatic price updates. The extension sends products with "Track live" enabled; this server fetches their URLs on a schedule and returns updated prices.

## Requirements

- Node.js 18+ (uses native `fetch`)

## Run

```bash
cd backend
npm start
```

Runs at `http://localhost:3000`. Set `PORT` to change (e.g. `PORT=4000 npm start`).

## API

- **POST /api/track** – Register a product for live tracking  
  Body: `{ deviceId, productId, url [, name, currentPrice ] }`

- **POST /api/untrack** – Stop tracking a product  
  Body: `{ deviceId, productId }`

- **GET /api/prices?deviceId=xxx** – Get latest prices for all tracked products for that device  
  Response: `{ products: [ { productId, currentPrice, priceHistory, lastChecked } ] }`

## Cron

Every 5 minutes the server fetches each tracked product URL, parses price (JSON-LD + meta), and updates `currentPrice` and `priceHistory`. The extension polls **GET /api/prices** to sync.

## Third-party price API backup (Option 3)

When our own fetch + parse returns **no price** (or the request fails), the backend can call an optional **third-party price API** as a fallback.

Set environment variables:

- **`BACKUP_PRICE_API_URL`** – Base URL of the API. The backend calls it with the product URL as a query parameter: `GET BACKUP_PRICE_API_URL?url=encodeURIComponent(productUrl)`.
- **`BACKUP_PRICE_API_KEY`** (optional) – If your API requires a key, set this. It is sent as query `key=...` and as header `X-Api-Key: ...`.

The backend expects the API to return JSON with a price in one of these shapes: `{ price }`, `{ currentPrice }`, or `{ data: { price } }` / `{ data: { currentPrice } }`. The value can be a number or a string (e.g. `"19.99"`).

Example (no key):

```bash
BACKUP_PRICE_API_URL=https://api.example.com/price npm start
```

Example (with key):

```bash
BACKUP_PRICE_API_URL=https://api.example.com/price BACKUP_PRICE_API_KEY=your-key npm start
```

If these env vars are not set, only Option 2 (our fetch + parse) is used.

## Extension config

In the extension, set the backend base URL (e.g. `http://localhost:3000`) in the price-tracker API helper. For production, use your deployed backend URL and ensure CORS allows the extension origin if needed.
