
const express = require('express');

const spaceController = require('../controllers/space.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const {
  createSpaceRules,
  updateSpaceRules,
  addSpaceMemberRules,
  removeSpaceMemberRules
} = require('../validators/space.validator');

const router = express.Router();

router.use(authenticate);

// Create a group
router.post(
  '/',
  validate(createSpaceRules),
  spaceController.createSpace
);

// Get all groups
router.get(
  '/',
  spaceController.getMySpaces
);

// Add a member
router.post(
  '/:id/members',
  validate(addSpaceMemberRules),
  spaceController.addSpaceMember
);

// Remove a member
router.delete(
  '/:id/members/:userId',
  validate(removeSpaceMemberRules),
  spaceController.removeSpaceMember
);

// Get group members
router.get(
  '/:id/members',
  spaceController.getSpaceMembers
);

// Update group details (host only)
router.patch(
  '/:id',
  validate(updateSpaceRules),
  spaceController.updateSpace
);

// Archive a group (host only)
router.delete(
  '/:id',
  spaceController.archiveSpace
);

// Get group details
router.get(
  '/:id',
  spaceController.getSpaceById
);

module.exports = router;
