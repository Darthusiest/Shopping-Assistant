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

## Extension config

In the extension, set the backend base URL (e.g. `http://localhost:3000`) in the price-tracker API helper. For production, use your deployed backend URL and ensure CORS allows the extension origin if needed.
