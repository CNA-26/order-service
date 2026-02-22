const express = require("express");
const cors = require("cors");
const { ITEMS } = require("./data/placeholders");
const { requireApiKey } = require("./middleware/apiKeyAuth");

const app = express();

// Rahti/OpenShift commonly routes to 8080; still respects PORT if set
const PORT = process.env.PORT || 8080;

// In-memory "database" for Sprint 3 BETA (until real DB is available)
const ORDERS = [...ITEMS];

// Enable CORS by default (set ENABLE_CORS=false to disable)
if (process.env.ENABLE_CORS !== "false") {
  app.use(cors());
}

app.use(express.json());

// Liveness / health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime_seconds: process.uptime() });
});

// GET all orders (placeholder/in-memory)
app.get("/api/v1/orders", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || ORDERS.length, ORDERS.length);
  res.json({
    meta: {
      count: ORDERS.length,
      returned: limit,
      environment: process.env.NODE_ENV || "development"
    },
    data: ORDERS.slice(0, limit)
  });
});

// GET single order by id
app.get("/api/v1/orders/:id", (req, res) => {
  const item = ORDERS.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Order not found" });
  res.json({ data: item });
});

// POST create order (Sprint 3 BETA, in-memory until DB is available)
app.post("/api/v1/orders", requireApiKey, (req, res) => {
  const {
    id: product_id,
    name: product_name,
    price: price_cents,
    qty: quantity,
    owner_user_id
  } = req.body || {};

  const missing = [];
  if (!product_name) missing.push("product_name");
  if (quantity === undefined || quantity === null) missing.push("quantity");
  if (price_cents === undefined || price_cents === null) missing.push("price_cents");
  if (!owner_user_id) missing.push("owner_user_id");

  if (missing.length) {
    return res.status(400).json({
      error: "Missing required fields",
      required: missing
    });
  }

  const nowIso = new Date().toISOString();
  const id = `order_${Date.now()}`;

  const newOrder = {
    id,
    product_id: product_id || null,
    product_name,
    quantity: Number(quantity),
    price_cents: Number(price_cents),
    owner_user_id,
    status: "created",
    created_at: nowIso
  };

  ORDERS.push(newOrder);

  return res.status(201).json({
    success: true,
    data: newOrder
  });
});

// PATCH update order status (Sprint 3 BETA, in-memory until DB is available)
app.patch("/api/v1/orders/:id/status", requireApiKey, (req, res) => {
  const { status } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: "Missing required field: status" });
  }

  const order = ORDERS.find(o => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  order.status = status;
  order.updated_at = new Date().toISOString();

  return res.json({
    success: true,
    data: order
  });
});

// Simple healthcheck for readiness (optional)
app.get("/ready", (req, res) => {
  res.json({ ready: true });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Order service listening on port ${PORT}`);
});