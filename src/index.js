const express = require("express");
const cors = require("cors");
const { requireApiKey } = require("./middleware/apiKeyAuth");
const { pool } = require("./db");

const app = express();

// Rahti/OpenShift commonly routes to 8080; still respects PORT if set
const PORT = process.env.PORT || 8080;

// Enable CORS by default (set ENABLE_CORS=false to disable)
if (process.env.ENABLE_CORS !== "false") {
  app.use(cors());
}

app.use(express.json());

// Liveness / health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime_seconds: process.uptime() });
});

/**
 * POST create order (DB-backed)
 * Expects body:
 * {
 *   customer, delivery, payment, items[], totals?, acceptedTerms?, timestamp?
 * }
 */
app.post("/api/v1/orders", requireApiKey, async (req, res) => {
  const { customer, delivery, payment, items, totals, timestamp, acceptedTerms } = req.body || {};

  // Minimal validation (add more when needed)
  if (!customer?.email) return res.status(400).json({ error: "customer.email is required" });
  if (!delivery?.method) return res.status(400).json({ error: "delivery.method is required" });
  if (!payment?.method) return res.status(400).json({ error: "payment.method is required" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }

  // Optional: require terms acceptance (matches UI)
  if (acceptedTerms !== undefined && acceptedTerms !== true) {
    return res.status(400).json({ error: "acceptedTerms must be true" });
  }

  for (const [i, it] of items.entries()) {
    if (!it?.id) return res.status(400).json({ error: `items[${i}].id is required` });
    if (!it?.name) return res.status(400).json({ error: `items[${i}].name is required` });
    if (it.price === undefined || it.price === null) {
      return res.status(400).json({ error: `items[${i}].price is required` });
    }
    if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) {
      return res.status(400).json({ error: `items[${i}].quantity must be >= 1` });
    }
  }

  // Generate order number on backend
  const orderNumber = `ORD-${Date.now()}`;

  // Recalculate totals server-side (don’t trust client)
  const subtotal = items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
  const deliveryCost = totals?.deliveryCost != null ? Number(totals.deliveryCost) : 0;
  const total = subtotal + deliveryCost;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderInsert = await client.query(
      `INSERT INTO orders (order_number, status, customer, delivery, payment, totals, accepted_terms, timestamp)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::timestamptz)
       RETURNING id, order_number, status, created_at`,
      [
        orderNumber,
        "created",
        JSON.stringify(customer),
        JSON.stringify(delivery),
        JSON.stringify(payment),
        JSON.stringify({ subtotal, deliveryCost, total }),
        acceptedTerms === true, // stores true/false
        timestamp ? new Date(timestamp).toISOString() : null
      ]
    );

    const order = orderInsert.rows[0];

    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, String(it.id), String(it.name), Number(it.price), Number(it.quantity)]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        id: String(order.id),
        orderNumber: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        totals: { subtotal, deliveryCost, total }
      }
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create order DB error:", err);
    return res.status(500).json({ error: "Failed to create order" });
  } finally {
    client.release();
  }
});

/**
 * GET order by id (includes items)
 */
app.get("/api/v1/orders/:id", requireApiKey, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `SELECT id, order_number, status, customer, delivery, payment, totals, accepted_terms, created_at
       FROM orders
       WHERE id = $1`,
      [id]
    );

    if (orderRes.rowCount === 0) return res.status(404).json({ error: "Order not found" });

    const itemsRes = await client.query(
      `SELECT product_id AS id, product_name AS name, unit_price AS price, quantity
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [id]
    );

    const o = orderRes.rows[0];

    return res.json({
      success: true,
      data: {
        id: String(o.id),
        orderNumber: o.order_number,
        status: o.status,
        createdAt: o.created_at,
        acceptedTerms: o.accepted_terms,
        customer: o.customer,
        delivery: o.delivery,
        payment: o.payment,
        totals: o.totals,
        items: itemsRes.rows
      }
    });
  } catch (err) {
    console.error("Get order DB error:", err);
    return res.status(500).json({ error: "Failed to fetch order" });
  } finally {
    client.release();
  }
});

// Simple healthcheck for readiness (optional)
app.get("/ready", (req, res) => {
  res.json({ ready: true });
});

app.get("/version", (req, res) => {
  res.json({ version: "ORDER-API-2026-02-22", now: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Order service listening on port ${PORT}`);
});
