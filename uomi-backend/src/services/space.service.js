
const { pool } = require('../config/db');
const ApiError = require('../utils/api-error');

// Create a new group
async function createSpace(userId, data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const spaceResult = await client.query(
      `
        INSERT INTO spaces (name, icon_id, host_id)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          name,
          icon_id,
          host_id,
          created_at,
          updated_at
      `,
      [data.name, data.icon_id || null, userId]
    );

    const space = spaceResult.rows[0];

    await client.query(
      `
        INSERT INTO space_members (space_id, user_id)
        VALUES ($1, $2)
      `,
      [space.id, userId]
    );

    await client.query('COMMIT');

    return space;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}


// Get all groups of the logged-in user
async function getMySpaces(userId) {
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.icon_id,
        s.host_id,
        s.created_at,
        s.updated_at
      FROM spaces s
      INNER JOIN space_members sm
        ON sm.space_id = s.id
      WHERE sm.user_id = $1
        AND sm.left_at IS NULL
        AND s.archived_at IS NULL
      ORDER BY s.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}


// Get details of a specific group
async function getSpaceById(userId, spaceId) {
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.name,
        s.icon_id,
        s.host_id,
        s.created_at,
        s.updated_at,
        u.username AS host_username,
        u.name AS host_name,
        u.avatar_url AS host_avatar_url,
        COUNT(sm.user_id)::int AS total_members
      FROM spaces s
      INNER JOIN users u
        ON u.id = s.host_id
      INNER JOIN space_members my_membership
        ON my_membership.space_id = s.id
        AND my_membership.user_id = $1
        AND my_membership.left_at IS NULL
      LEFT JOIN space_members sm
        ON sm.space_id = s.id
        AND sm.left_at IS NULL
      WHERE s.id = $2
        AND s.archived_at IS NULL
      GROUP BY s.id, u.id
    `,
    [userId, spaceId]
  );

  return result.rows[0] || null;
}


// Get all active members of a group
async function getSpaceMembers(userId, spaceId) {
  const result = await pool.query(
    `
      SELECT
        u.id AS user_id,
        u.username,
        u.name,
        u.phone,
        u.avatar_url,
        sm.joined_at,
        CASE
          WHEN s.host_id = u.id THEN 'Host'
          ELSE 'Member'
        END AS role
      FROM spaces s
      INNER JOIN space_members my_membership
        ON my_membership.space_id = s.id
        AND my_membership.user_id = $1
        AND my_membership.left_at IS NULL
      INNER JOIN space_members sm
        ON sm.space_id = s.id
        AND sm.left_at IS NULL
      INNER JOIN users u
        ON u.id = sm.user_id
      WHERE s.id = $2
        AND s.archived_at IS NULL
      ORDER BY
        CASE WHEN s.host_id = u.id THEN 0 ELSE 1 END,
        sm.joined_at ASC
    `,
    [userId, spaceId]
  );

  return result.rows;
}


// Update group details (host only)
async function updateSpace(hostId, spaceId, data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const spaceResult = await client.query(
      `
        SELECT id, host_id
        FROM spaces
        WHERE id = $1
          AND archived_at IS NULL
        FOR UPDATE
      `,
      [spaceId]
    );

    if (spaceResult.rowCount === 0) {
      throw ApiError.notFound('Group not found');
    }

    if (String(spaceResult.rows[0].host_id) !== String(hostId)) {
      throw ApiError.forbidden(
        'Only the group host can update group details'
      );
    }

    const updates = [];
    const values = [];
    let parameterIndex = 1;

    if (Object.prototype.hasOwnProperty.call(data, 'name')) {
      updates.push(`name = $${parameterIndex++}`);
      values.push(data.name);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'icon_id')) {
      updates.push(`icon_id = $${parameterIndex++}`);
      values.push(data.icon_id);
    }

    if (updates.length === 0) {
      throw ApiError.badRequest(
        'Provide at least one field to update'
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    values.push(spaceId);

    const updateResult = await client.query(
      `
        UPDATE spaces
        SET ${updates.join(', ')}
        WHERE id = $${parameterIndex}
        RETURNING
          id,
          name,
          icon_id,
          host_id,
          created_at,
          updated_at
      `,
      values
    );

    await client.query('COMMIT');

    return updateResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}


// Add a member to a group
async function addSpaceMember(hostId, spaceId, newUserId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const spaceResult = await client.query(
      `
        SELECT id, host_id
        FROM spaces
        WHERE id = $1
          AND archived_at IS NULL
        FOR UPDATE
      `,
      [spaceId]
    );

    if (spaceResult.rowCount === 0) {
      throw ApiError.notFound('Group not found');
    }

    if (String(spaceResult.rows[0].host_id) !== String(hostId)) {
      throw ApiError.forbidden(
        'Only the group host can add members'
      );
    }

    const userResult = await client.query(
      `
        SELECT id, username, name, phone, avatar_url
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [newUserId]
    );

    if (userResult.rowCount === 0) {
      throw ApiError.notFound('User not found');
    }

    const membershipResult = await client.query(
      `
        SELECT left_at
        FROM space_members
        WHERE space_id = $1
          AND user_id = $2
        FOR UPDATE
      `,
      [spaceId, newUserId]
    );

    if (
      membershipResult.rowCount > 0 &&
      membershipResult.rows[0].left_at === null
    ) {
      throw ApiError.conflict(
        'User is already a member of this group'
      );
    }

    let membership;

    if (membershipResult.rowCount > 0) {
      const rejoinResult = await client.query(
        `
          UPDATE space_members
          SET joined_at = CURRENT_TIMESTAMP,
              left_at = NULL
          WHERE space_id = $1
            AND user_id = $2
          RETURNING joined_at
        `,
        [spaceId, newUserId]
      );

      membership = rejoinResult.rows[0];

    } else {
      const insertResult = await client.query(
        `
          INSERT INTO space_members (
            space_id,
            user_id,
            joined_at
          )
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          RETURNING joined_at
        `,
        [spaceId, newUserId]
      );

      membership = insertResult.rows[0];
    }

    await client.query('COMMIT');

    return {
      user: userResult.rows[0],
      space_id: spaceId,
      joined_at: membership.joined_at,
      role: 'Member'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}


// Remove a member from a group
async function removeSpaceMember(hostId, spaceId, memberId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const spaceResult = await client.query(
      `
        SELECT id, host_id
        FROM spaces
        WHERE id = $1
          AND archived_at IS NULL
        FOR UPDATE
      `,
      [spaceId]
    );

    if (spaceResult.rowCount === 0) {
      throw ApiError.notFound('Group not found');
    }

    const space = spaceResult.rows[0];

    if (String(space.host_id) !== String(hostId)) {
      throw ApiError.forbidden(
        'Only the group host can remove members'
      );
    }

    if (String(hostId) === String(memberId)) {
      throw ApiError.badRequest(
        'Group host cannot remove themselves'
      );
    }

    const membershipResult = await client.query(
      `
        SELECT user_id
        FROM space_members
        WHERE space_id = $1
          AND user_id = $2
          AND left_at IS NULL
        FOR UPDATE
      `,
      [spaceId, memberId]
    );

    if (membershipResult.rowCount === 0) {
      throw ApiError.notFound(
        'Active member not found in this group'
      );
    }

    const updateResult = await client.query(
      `
        UPDATE space_members
        SET left_at = CURRENT_TIMESTAMP
        WHERE space_id = $1
          AND user_id = $2
          AND left_at IS NULL
        RETURNING space_id, user_id, joined_at, left_at
      `,
      [spaceId, memberId]
    );

    await client.query('COMMIT');

    return updateResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}


// Archive a group (host only)
async function archiveSpace(hostId, spaceId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const spaceResult = await client.query(
      `
        SELECT id, host_id
        FROM spaces
        WHERE id = $1
          AND archived_at IS NULL
        FOR UPDATE
      `,
      [spaceId]
    );

    if (spaceResult.rowCount === 0) {
      throw ApiError.notFound(
        'Group not found or already archived'
      );
    }

    if (String(spaceResult.rows[0].host_id) !== String(hostId)) {
      throw ApiError.forbidden(
        'Only the group host can archive this group'
      );
    }

    const archiveResult = await client.query(
      `
        UPDATE spaces
        SET archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND archived_at IS NULL
        RETURNING
          id,
          name,
          icon_id,
          host_id,
          archived_at,
          updated_at
      `,
      [spaceId]
    );

    await client.query('COMMIT');

    return archiveResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}


module.exports = {
  createSpace,
  getMySpaces,
  getSpaceById,
  getSpaceMembers,
  updateSpace,
  addSpaceMember,
  removeSpaceMember,
  archiveSpace
};
