const bcrypt = require('bcrypt');

const { query } = require('../config/db');
const ApiError = require('../utils/api-error');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const PUBLIC_COLUMNS = 'id, name, email, role, created_at, updated_at';

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase();

  const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [
    normalizedEmail,
  ]);

  if (existing.rowCount > 0) {
    throw ApiError.conflict('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, normalizedEmail, passwordHash]
  );

  return rows[0];
}

async function login({ email, password }) {
  const { rows } = await query(
    `SELECT id, name, email, role, password_hash, created_at, updated_at
     FROM users
     WHERE LOWER(email) = $1`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  const passwordMatches = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;

  if (!passwordMatches) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  delete user.password_hash;
  return user;
}

module.exports = { register, login };
