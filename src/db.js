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
async function createOrder(order_number,status,customer,delivery,payment,totals,accepted_terms, timestamp, created_at) {
  //casting using jsonb to insert object with postgres
  const create = `INSERT INTO public.orders
(order_number, status, customer, delivery, payment, totals, accepted_terms, "timestamp", created_at)
VALUES($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, now());`
const values = [
  order_number,
  status,
  customer,
  delivery,
  payment,
  totals,
  accepted_terms,
  timestamp
]
const res = await pool.query(create, values)
return res.rows
}
async function getOrders() {
  const get = `SELECT order_number, status, customer, delivery, payment, totals, accepted_terms, "timestamp", created_at FROM public.orders`

const res = await pool.query(get)
return res.rows
}
async function getOrderByNumber(order_number) {
  const getNumber = `SELECT id, status, customer, delivery, payment, totals, accepted_terms, "timestamp", created_at FROM public.orders WHERE order_number = $1`
  const values = [order_number]
const res = await pool.query(getNumber)
//.rows is the data inside the pool-object
return res.rows
}
async function addItems() {
  const items = `INSERT INTO public.order_items
(order_id, product_id, product_name, unit_price, quantity)
FROM jsonb_to_recordset($1, $2, $3, $4, $5);`
//jsonb_to_recordset is used to convert json object of items into different rows using postgres
const values = [
  order_id, product_id, product_name, unit_price, quantity
]
const res = await pool.query(items, values)
return res.rows
}
async function removeItem(order_id,product_id) {
  //Removes item/s from order
  const decitem =`UPDATE public.order_items
SET quantity= quantity - $1
WHERE order_id = $2 AND product_id = $3`
const res = await pool.query(decitem, values)
//if there's no item left remove row by checking length
if (res.length <= 0) {
  const delitems = `DELETE FROM public.order_items
WHERE order_id = $1 AND product_id = $2`
const values = [
  order_id, product_id
]
const remains = await pool.query(delitems, values)
return remains.rows
}
async function getItems() {
  const get = `SELECT id, order_id, product_id, product_name, unit_price, quantity FROM public.order_items;`

const res = await pool.query(get)
return res.rows
}
async function getItemByNumber(order_number) {
  const getNumber = `SELECT id, order_id, product_id, product_name, unit_price, quantity FROM public.order_items WHERE order_id = $1 AND product_id = $2`
  const values = [order_number]
const res = await pool.query(getNumber)
//.rows is the data inside the pool-object
return res.rows
}

}
module.exports = { pool };