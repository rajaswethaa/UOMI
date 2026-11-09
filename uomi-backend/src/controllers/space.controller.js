
const spaceService = require('../services/space.service');
const { sendSuccess } = require('../utils/api-response');
const ApiError = require('../utils/api-error');

// Create a new group
async function createSpace(req, res) {
  const space = await spaceService.createSpace(
    req.user.id,
    req.body
  );

  return sendSuccess(
    res,
    { space },
    201,
    'Group created successfully'
  );
}

// Get all groups of the logged-in user
async function getMySpaces(req, res) {
  const spaces = await spaceService.getMySpaces(
    req.user.id
  );

  return sendSuccess(
    res,
    { spaces },
    200,
    'Groups retrieved successfully'
  );
}

// Get details of a specific group
async function getSpaceById(req, res) {
  const space = await spaceService.getSpaceById(
    req.user.id,
    req.params.id
  );

  if (!space) {
    throw ApiError.notFound(
      'Group not found or you are not a member'
    );
  }

  return sendSuccess(
    res,
    { space },
    200,
    'Group details retrieved successfully'
  );
}

// Get all active members of a group
async function getSpaceMembers(req, res) {
  const space = await spaceService.getSpaceById(
    req.user.id,
    req.params.id
  );

  if (!space) {
    throw ApiError.notFound(
      'Group not found or you are not a member'
    );
  }

  const members = await spaceService.getSpaceMembers(
    req.user.id,
    req.params.id
  );

  return sendSuccess(
    res,
    { members },
    200,
    'Group members retrieved successfully'
  );
}

// Update group details (host only)
async function updateSpace(req, res) {
  const space = await spaceService.updateSpace(
    req.user.id,
    req.params.id,
    req.body
  );

  return sendSuccess(
    res,
    { space },
    200,
    'Group updated successfully'
  );
}

// Archive a group (host only)
async function archiveSpace(req, res) {
  const space = await spaceService.archiveSpace(
    req.user.id,
    req.params.id
  );

  return sendSuccess(
    res,
    { space },
    200,
    'Group archived successfully'
  );
}

// Add a member to a group
async function addSpaceMember(req, res) {
  const membership = await spaceService.addSpaceMember(
    req.user.id,
    req.params.id,
    req.body.user_id
  );

  return sendSuccess(
    res,
    { membership },
    201,
    'Member added successfully'
  );
}

// Remove a member from a group
async function removeSpaceMember(req, res) {
  const membership = await spaceService.removeSpaceMember(
    req.user.id,
    req.params.id,
    req.params.userId
  );

  return sendSuccess(
    res,
    { membership },
    200,
    'Member removed successfully'
  );
}

module.exports = {
  createSpace,
  getMySpaces,
  getSpaceById,
  getSpaceMembers,
  updateSpace,
  archiveSpace,
  addSpaceMember,
  removeSpaceMember
};
