
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env")
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// Execute SQL queries
const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = {
  pool,
  query
};
