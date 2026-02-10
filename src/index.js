const express = require("express");
const cors = require("cors");
const { ITEMS } = require("./data/placeholders");

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS by default (set ENABLE_CORS=false to disable)
if (process.env.ENABLE_CORS !== "false") {
  app.use(cors());
}

app.use(express.json());

// Liveness / health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime_seconds: process.uptime() });
});

// GET all orders (placeholder)
app.get("/api/v1/orders", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || ITEMS.length, ITEMS.length);
  res.json({
    meta: {
      count: ITEMS.length,
      returned: limit,
      environment: process.env.NODE_ENV || "development"
    },
    data: ITEMS.slice(0, limit)
  });
});

// GET single order by id
app.get("/api/v1/orders/:id", (req, res) => {
  const item = ITEMS.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Order not found" });
  res.json({ data: item });
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