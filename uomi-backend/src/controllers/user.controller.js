const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/api-response');
const parseId = require('../utils/parse-id');
const ApiError = require('../utils/api-error');

async function getMe(req, res) {
  const user = await userService.getById(req.user.id);

  return sendSuccess(res, { user });
}

async function updateMe(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);

  return sendSuccess(res, { user }, 200, 'Profile updated successfully');
}

async function list(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
  );
  const search =
    typeof req.query.search === 'string'
      ? req.query.search.trim().slice(0, 100)
      : '';

  const result = await userService.list({ page, limit, search });

  return sendSuccess(res, result);
}

async function getById(req, res) {
  const user = await userService.getById(parseId(req.params.id, 'user id'));

  return sendSuccess(res, { user });
}

async function updateById(req, res) {
  const user = await userService.adminUpdate(
    parseId(req.params.id, 'user id'),
    req.body
  );

  return sendSuccess(res, { user }, 200, 'User updated successfully');
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'user id');

  if (String(req.user.id) === String(id)) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  await userService.remove(id);

  return sendSuccess(res, null, 200, 'User deleted successfully');
}

module.exports = { getMe, updateMe, list, getById, updateById, remove };
