const { Pool } = require("pg");

const sslEnabled = process.env.DB_SSL !== "false"; // default true

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

module.exports = { pool };