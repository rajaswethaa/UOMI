
const express = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const spaceRoutes = require('./space.routes');
const expenseRoutes = require('./expense.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/spaces', spaceRoutes);
router.use('/expenses', expenseRoutes);

module.exports = router;
