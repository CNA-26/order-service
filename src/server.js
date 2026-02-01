const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

console.log(`
Starting Order Service on port ${PORT}...
`);

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: " Order Service API - Sprint 2",
    status: "Running",
    endpoints: {
      health: "GET /health",
      orders: "GET /api/orders (TODO)",
      create: "POST /api/orders (TODO)"
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

    app.listen(PORT, () => {
  console.log(`Server running on http://localhost:8080`);
  console.log(`Production: https://order-service-git-order-service.2.rahtiapp.fi`);
});