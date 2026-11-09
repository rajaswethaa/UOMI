
const express = require('express');

const expenseController = require('../controllers/expense.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const {
  createExpenseRules
} = require('../validators/expense.validator');

const router = express.Router();

// All expense routes require authentication
router.use(authenticate);

// Create an expense
router.post(
  '/',
  validate(createExpenseRules),
  expenseController.createExpense
);

module.exports = router;
