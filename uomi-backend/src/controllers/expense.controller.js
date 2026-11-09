
const expenseService = require('../services/expense.service');
const { sendSuccess } = require('../utils/api-response');

// Create an expense
async function createExpense(req, res) {
  const expense = await expenseService.createExpense(
    req.user.id,
    req.body
  );

  return sendSuccess(
    res,
    { expense },
    201,
    'Expense created successfully'
  );
}

module.exports = {
  createExpense
};
