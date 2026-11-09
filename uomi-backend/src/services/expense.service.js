
const { pool } = require('../config/db');
const ApiError = require('../utils/api-error');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeShares(shares) {
  return shares
    .map(share => ({
      user_id: String(share.user_id),
      amount_paise: String(share.amount_paise)
    }))
    .sort((a, b) => a.user_id.localeCompare(b.user_id));
}

function normalizeItems(items) {
  return items
    .map(item => ({
      name: item.name.trim(),
      price_paise: String(item.price_paise),
      consumers: [...item.consumers]
        .map(String)
        .sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
}

// Divide an item's price equally among its consumers.
// Any remainder paise goes to consumers in ascending user ID order.
function calculateItemShares(items) {
  const userSubtotals = new Map();
  let itemSubtotal = 0;

  for (const item of items) {
    itemSubtotal += item.price_paise;

    if (!Number.isSafeInteger(itemSubtotal)) {
      throw ApiError.badRequest(
        'Total item amount is too large'
      );
    }

    const consumers = [...item.consumers].sort(
      (a, b) => a - b
    );

    const baseAmount = Math.floor(
      item.price_paise / consumers.length
    );

    const remainder = item.price_paise % consumers.length;

    if (baseAmount < 1) {
      throw ApiError.badRequest(
        'Each item must have at least 1 paise per consumer'
      );
    }

    consumers.forEach((userId, index) => {
      const amount =
        baseAmount + (index < remainder ? 1 : 0);

      const current = userSubtotals.get(userId) || 0;
      const updated = current + amount;

      if (!Number.isSafeInteger(updated)) {
        throw ApiError.badRequest(
          'Member item subtotal is too large'
        );
      }

      userSubtotals.set(userId, updated);
    });
  }

  return {
    userSubtotals,
    itemSubtotal
  };
}

// Distribute additional charges proportionally.
// BigInt avoids precision errors during multiplication.
function distributeAdditionalCharges(
  userSubtotals,
  itemSubtotal,
  additionalCharges
) {
  const users = [...userSubtotals.entries()]
    .map(([userId, subtotal]) => ({
      user_id: userId,
      subtotal
    }))
    .sort((a, b) => a.user_id - b.user_id);

  const denominator = BigInt(itemSubtotal);
  const extra = BigInt(additionalCharges);

  let distributed = 0n;

  const allocations = users.map(user => {
    const numerator =
      extra * BigInt(user.subtotal);

    const amount = numerator / denominator;
    const remainder = numerator % denominator;

    distributed += amount;

    return {
      user_id: user.user_id,
      amount_paise: Number(amount),
      remainder
    };
  });

  // Distribute leftover paise to the largest fractional
  // remainders. Ties are resolved by ascending user ID.
  let remaining = Number(extra - distributed);

  allocations.sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.user_id - b.user_id;
  });

  for (let i = 0; i < allocations.length && remaining > 0; i++) {
    allocations[i].amount_paise += 1;
    remaining--;
  }

  return allocations
    .map(allocation => ({
      user_id: allocation.user_id,
      amount_paise:
        userSubtotals.get(allocation.user_id) +
        allocation.amount_paise
    }))
    .sort((a, b) => a.user_id - b.user_id);
}

function calculateItemBasedShares(items, totalPaise) {
  const {
    userSubtotals,
    itemSubtotal
  } = calculateItemShares(items);

  if (itemSubtotal > totalPaise) {
    throw ApiError.badRequest(
      'The sum of item prices cannot exceed the total expense amount'
    );
  }

  const additionalCharges = totalPaise - itemSubtotal;

  const shares = distributeAdditionalCharges(
    userSubtotals,
    itemSubtotal,
    additionalCharges
  );

  const sharesTotal = shares.reduce(
    (sum, share) => sum + share.amount_paise,
    0
  );

  if (
    !Number.isSafeInteger(sharesTotal) ||
    sharesTotal !== totalPaise
  ) {
    throw ApiError.badRequest(
      'Could not calculate expense shares correctly'
    );
  }

  return shares;
}

// Validate item details and consumer assignments.
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest(
      'At least one expense item is required'
    );
  }

  const allConsumerIds = new Set();

  const validatedItems = items.map(item => {
    if (
      !item ||
      typeof item.name !== 'string' ||
      item.name.trim().length < 1 ||
      item.name.trim().length > 150
    ) {
      throw ApiError.badRequest(
        'Each item must have a name containing 1 to 150 characters'
      );
    }

    if (
      !Number.isSafeInteger(item.price_paise) ||
      item.price_paise <= 0
    ) {
      throw ApiError.badRequest(
        'Each item must have a positive valid price in paise'
      );
    }

    if (
      !Array.isArray(item.consumers) ||
      item.consumers.length === 0
    ) {
      throw ApiError.badRequest(
        'Every item must have at least one consumer'
      );
    }

    const itemConsumers = new Set();

    for (const consumerId of item.consumers) {
      if (
        !Number.isSafeInteger(consumerId) ||
        consumerId <= 0
      ) {
        throw ApiError.badRequest(
          'Every item consumer must have a valid user ID'
        );
      }

      if (itemConsumers.has(consumerId)) {
        throw ApiError.badRequest(
          'Duplicate consumers are not allowed for an item'
        );
      }

      itemConsumers.add(consumerId);
      allConsumerIds.add(consumerId);
    }

    if (item.price_paise < item.consumers.length) {
      throw ApiError.badRequest(
        'Each item must have at least 1 paise per consumer'
      );
    }

    return {
      name: item.name.trim(),
      price_paise: item.price_paise,
      consumers: [...itemConsumers]
    };
  });

  return {
    items: validatedItems,
    consumerIds: [...allConsumerIds]
  };
}

async function getExistingItems(client, expenseId, spaceId) {
  const itemResult = await client.query(
    `
      SELECT id, expense_id, space_id, name, price_paise, created_at
      FROM expense_items
      WHERE expense_id = $1
        AND space_id = $2
      ORDER BY id
    `,
    [expenseId, spaceId]
  );

  const consumerResult = await client.query(
    `
      SELECT expense_item_id, user_id
      FROM expense_item_consumers
      WHERE space_id = $1
        AND expense_item_id = ANY($2::bigint[])
      ORDER BY expense_item_id, user_id
    `,
    [spaceId, itemResult.rows.map(item => item.id)]
  );

  const consumersByItem = new Map();

  for (const row of consumerResult.rows) {
    const key = String(row.expense_item_id);

    if (!consumersByItem.has(key)) {
      consumersByItem.set(key, []);
    }

    consumersByItem.get(key).push(Number(row.user_id));
  }

  return itemResult.rows.map(item => ({
    ...item,
    consumers: consumersByItem.get(String(item.id)) || []
  }));
}

// Create an expense and all related records in one transaction.
async function createExpense(userId, data) {
  userId = Number(userId);

  const {
    space_id,
    payer_id,
    title,
    total_paise,
    split_type,
    shares,
    items,
    client_request_id
  } = data;

  // Basic validation.
  if (
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(space_id) ||
    space_id <= 0 ||
    !Number.isSafeInteger(payer_id) ||
    payer_id <= 0 ||
    !Number.isSafeInteger(total_paise) ||
    total_paise <= 0
  ) {
    throw ApiError.badRequest(
      'Invalid user, group, payer or expense amount'
    );
  }

  if (
    typeof title !== 'string' ||
    title.trim().length < 1 ||
    title.trim().length > 150
  ) {
    throw ApiError.badRequest(
      'Expense title must contain 1 to 150 characters'
    );
  }

  if (!['equal', 'custom', 'item_based'].includes(split_type)) {
    throw ApiError.badRequest(
      'Split type must be equal, custom or item_based'
    );
  }

  if (
    client_request_id !== undefined &&
    client_request_id !== null &&
    (
      typeof client_request_id !== 'string' ||
      !UUID_PATTERN.test(client_request_id)
    )
  ) {
    throw ApiError.badRequest(
      'client_request_id must be a valid UUID'
    );
  }

  let validatedItems = [];
  let consumerIds = [];
  let finalShares = [];

  // Item-based expense validation and calculation.
  if (split_type === 'item_based') {
    if (shares !== undefined && shares !== null) {
      throw ApiError.badRequest(
        'Shares are calculated automatically for item-based expenses'
      );
    }

    const result = validateItems(items);

    validatedItems = result.items;
    consumerIds = result.consumerIds;

    finalShares = calculateItemBasedShares(
      validatedItems,
      total_paise
    );
  } else {
    // Existing equal/custom expense validation.
    if (items !== undefined && items !== null) {
      throw ApiError.badRequest(
        'Items can only be provided for item-based expenses'
      );
    }

    if (!Array.isArray(shares) || shares.length === 0) {
      throw ApiError.badRequest(
        'At least one expense share is required'
      );
    }

    const memberIds = new Set();

    for (const share of shares) {
      if (
        !share ||
        !Number.isSafeInteger(share.user_id) ||
        share.user_id <= 0 ||
        !Number.isSafeInteger(share.amount_paise) ||
        share.amount_paise <= 0
      ) {
        throw ApiError.badRequest(
          'Every share must have a valid member ID and positive amount'
        );
      }

      if (memberIds.has(share.user_id)) {
        throw ApiError.badRequest(
          'Duplicate members are not allowed in expense shares'
        );
      }

      memberIds.add(share.user_id);
    }

    // Existing payer inclusion rule for equal/custom.
    if (!memberIds.has(payer_id)) {
      throw ApiError.badRequest(
        'The payer must be included in expense shares'
      );
    }

    if (split_type === 'equal') {
      const baseAmount = Math.floor(
        total_paise / shares.length
      );

      const remainder = total_paise % shares.length;

      const expectedAmounts = shares.map(
        (_, index) =>
          baseAmount + (index < remainder ? 1 : 0)
      );

      const actualAmounts = shares.map(
        share => share.amount_paise
      );

      const sortedExpected = [...expectedAmounts].sort(
        (a, b) => a - b
      );

      const sortedActual = [...actualAmounts].sort(
        (a, b) => a - b
      );

      if (
        sortedExpected.some(
          (amount, index) => amount !== sortedActual[index]
        )
      ) {
        throw ApiError.badRequest(
          'Equal split amounts are incorrect'
        );
      }
    }

    const sharesTotal = shares.reduce(
      (sum, share) => sum + share.amount_paise,
      0
    );

    if (
      !Number.isSafeInteger(sharesTotal) ||
      sharesTotal !== total_paise
    ) {
      throw ApiError.badRequest(
        'The sum of expense shares must equal the total amount'
      );
    }

    finalShares = shares;
    consumerIds = [...memberIds];
  }

  const participantIds = [
    ...new Set([userId, payer_id, ...consumerIds])
  ];

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify group is active.
    const groupResult = await client.query(
      `
        SELECT id
        FROM spaces
        WHERE id = $1
          AND archived_at IS NULL
        FOR UPDATE
      `,
      [space_id]
    );

    if (groupResult.rowCount === 0) {
      throw ApiError.notFound(
        'Group not found or archived'
      );
    }

    // Verify creator, payer and all consumers are active members.
    const membershipResult = await client.query(
      `
        SELECT user_id
        FROM space_members
        WHERE space_id = $1
          AND user_id = ANY($2::bigint[])
          AND left_at IS NULL
      `,
      [space_id, participantIds]
    );

    const activeMembers = new Set(
      membershipResult.rows.map(
        row => String(row.user_id)
      )
    );

    if (!activeMembers.has(String(userId))) {
      throw ApiError.forbidden(
        'You are not an active member of this group'
      );
    }

    if (!activeMembers.has(String(payer_id))) {
      throw ApiError.badRequest(
        'The payer must be an active group member'
      );
    }

    for (const memberId of consumerIds) {
      if (!activeMembers.has(String(memberId))) {
        throw ApiError.badRequest(
          'Every participant must be an active group member'
        );
      }
    }

    // Create expense.
    const expenseResult = await client.query(
      `
        INSERT INTO expenses (
          space_id,
          payer_id,
          created_by,
          title,
          total_paise,
          client_request_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (space_id, client_request_id)
        DO NOTHING
        RETURNING
          id,
          space_id,
          payer_id,
          created_by,
          title,
          total_paise,
          client_request_id,
          created_at,
          updated_at
      `,
      [
        space_id,
        payer_id,
        userId,
        title.trim(),
        total_paise,
        client_request_id || null
      ]
    );

    let expense = expenseResult.rows[0];

    // Handle duplicate request IDs.
    if (!expense && client_request_id) {
      const existingResult = await client.query(
        `
          SELECT
            id,
            space_id,
            payer_id,
            created_by,
            title,
            total_paise,
            client_request_id,
            created_at,
            updated_at
          FROM expenses
          WHERE space_id = $1
            AND client_request_id = $2
        `,
        [space_id, client_request_id]
      );

      expense = existingResult.rows[0];

      if (!expense) {
        throw ApiError.conflict(
          'Could not verify the previous expense request'
        );
      }

      const sameDetails =
        String(expense.payer_id) === String(payer_id) &&
        String(expense.created_by) === String(userId) &&
        expense.title === title.trim() &&
        String(expense.total_paise) === String(total_paise);

      if (!sameDetails) {
        throw ApiError.conflict(
          'This request ID was already used for a different expense'
        );
      }

      const existingSharesResult = await client.query(
        `
          SELECT
            id,
            expense_id,
            space_id,
            debtor_id,
            amount_paise,
            status,
            responded_at,
            created_at
          FROM expense_shares
          WHERE expense_id = $1
          ORDER BY id
        `,
        [expense.id]
      );

      const existingShares = existingSharesResult.rows.map(
        share => ({
          user_id: String(share.debtor_id),
          amount_paise: String(share.amount_paise)
        })
      );

      if (
        JSON.stringify(normalizeShares(finalShares)) !==
        JSON.stringify(normalizeShares(existingShares))
      ) {
        throw ApiError.conflict(
          'This request ID was already used with different expense shares'
        );
      }

      const existingItems = await getExistingItems(
        client,
        expense.id,
        space_id
      );

      if (split_type === 'item_based') {
        const existingNormalized = normalizeItems(
          existingItems.map(item => ({
            name: item.name,
            price_paise: Number(item.price_paise),
            consumers: item.consumers
          }))
        );

        const requestedNormalized = normalizeItems(
          validatedItems
        );

        if (
          JSON.stringify(existingNormalized) !==
          JSON.stringify(requestedNormalized)
        ) {
          throw ApiError.conflict(
            'This request ID was already used with different items or consumers'
          );
        }
      } else if (existingItems.length > 0) {
        throw ApiError.conflict(
          'This request ID was already used for an item-based expense'
        );
      }

      await client.query('COMMIT');

      return {
        ...expense,
        shares: existingSharesResult.rows,
        items: existingItems
      };
    }

    // Save item records and consumer assignments.
    const createdItems = [];

    for (const item of validatedItems) {
      const itemResult = await client.query(
        `
          INSERT INTO expense_items (
            expense_id,
            space_id,
            name,
            price_paise
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            expense_id,
            space_id,
            name,
            price_paise,
            created_at
        `,
        [
          expense.id,
          space_id,
          item.name,
          item.price_paise
        ]
      );

      const createdItem = itemResult.rows[0];

      const createdConsumers = [];

      for (const consumerId of item.consumers) {
        const consumerResult = await client.query(
          `
            INSERT INTO expense_item_consumers (
              expense_item_id,
              space_id,
              user_id
            )
            VALUES ($1, $2, $3)
            RETURNING
              id,
              expense_item_id,
              space_id,
              user_id,
              created_at
          `,
          [
            createdItem.id,
            space_id,
            consumerId
          ]
        );

        createdConsumers.push(consumerResult.rows[0]);
      }

      createdItems.push({
        ...createdItem,
        consumers: createdConsumers
      });
    }

    // Save final expense shares.
    const createdShares = [];

    for (const share of finalShares) {
      const shareResult = await client.query(
        `
          INSERT INTO expense_shares (
            expense_id,
            space_id,
            debtor_id,
            amount_paise
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            expense_id,
            space_id,
            debtor_id,
            amount_paise,
            status,
            responded_at,
            created_at
        `,
        [
          expense.id,
          space_id,
          share.user_id,
          share.amount_paise
        ]
      );

      createdShares.push(shareResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...expense,
      shares: createdShares,
      items: createdItems
    };

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Preserve the original error.
    }

    throw error;

  } finally {
    client.release();
  }
}

module.exports = {
  createExpense
};
