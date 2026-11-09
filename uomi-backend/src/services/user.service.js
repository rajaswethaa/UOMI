
const { query } = require('../config/db');
const ApiError = require('../utils/api-error');

// Only public user fields
const PUBLIC_COLUMNS = `
  id,
  username,
  name,
  phone,
  avatar_url,
  push_enabled,
  created_at,
  updated_at
`;

// Get a user's profile
async function getById(id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id]
  );

  if (!rows[0]) {
    throw ApiError.notFound('User not found');
  }

  return rows[0];
}

// List users with pagination and optional search
async function list({ page = 1, limit = 20, search = '' } = {}) {
  const params = [];
  let whereClause = 'WHERE deleted_at IS NULL';

  if (search) {
    params.push(`%${search}%`);

    whereClause += `
      AND (
        name ILIKE $1
        OR username ILIKE $1
        OR phone ILIKE $1
      )
    `;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM users
     ${whereClause}`,
    params
  );

  const total = countResult.rows[0].total;

  const offset = (page - 1) * limit;
  const listParams = [...params, limit, offset];

  const limitIndex = params.length + 1;
  const offsetIndex = params.length + 2;

  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${limitIndex}
     OFFSET $${offsetIndex}`,
    listParams
  );

  return {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}

// Common function for updating user details
async function buildUpdate(id, fields) {
  const allowedColumns = [
    'name',
    'phone',
    'avatar_url',
    'push_enabled'
  ];

  const safeFields = {};

  for (const [column, value] of Object.entries(fields)) {
    if (allowedColumns.includes(column) && value !== undefined) {
      safeFields[column] = value;
    }
  }

  // Normalize and validate phone number
  if (typeof safeFields.phone === 'string') {
    safeFields.phone = safeFields.phone.trim();

    if (!/^\+?[0-9]{10,15}$/.test(safeFields.phone)) {
      throw ApiError.badRequest('Enter a valid phone number');
    }

    // Check whether another user already has this phone number
    const duplicate = await query(
      `SELECT id
       FROM users
       WHERE phone = $1
         AND id <> $2
         AND deleted_at IS NULL`,
      [safeFields.phone, id]
    );

    if (duplicate.rowCount > 0) {
      throw ApiError.conflict('Phone number is already registered');
    }
  }

  if (Object.keys(safeFields).length === 0) {
    throw ApiError.badRequest('No valid profile fields provided');
  }

  const params = [id];
  const assignments = [];

  for (const [column, value] of Object.entries(safeFields)) {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  assignments.push('updated_at = NOW()');

  const { rows } = await query(
    `UPDATE users
     SET ${assignments.join(', ')}
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING ${PUBLIC_COLUMNS}`,
    params
  );

  if (!rows[0]) {
    throw ApiError.notFound('User not found');
  }

  return rows[0];
}

// User updates their own profile
function updateProfile(id, fields) {
  return buildUpdate(id, fields);
}

// Admin updates another user's profile
function adminUpdate(id, fields) {
  return buildUpdate(id, fields);
}

// Soft delete user account
async function remove(id) {
  const { rowCount } = await query(
    `UPDATE users
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id]
  );

  if (rowCount === 0) {
    throw ApiError.notFound('User not found');
  }
}

module.exports = {
  getById,
  list,
  updateProfile,
  adminUpdate,
  remove
};
