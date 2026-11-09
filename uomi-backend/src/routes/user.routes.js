const express = require('express');

const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  updateProfileRules,
  adminUpdateRules,
} = require('../validators/user.validator');

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch(
  '/me',
  validate(updateProfileRules, { atLeastOne: true }),
  userController.updateMe
);

router.get('/', authorize('admin'), userController.list);
router.get('/:id', authorize('admin'), userController.getById);
router.patch(
  '/:id',
  authorize('admin'),
  validate(adminUpdateRules, { atLeastOne: true }),
  userController.updateById
);
router.delete('/:id', authorize('admin'), userController.remove);

module.exports = router;
