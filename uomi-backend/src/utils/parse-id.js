const ApiError = require('./api-error');

function parseId(value, label = 'id') {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }

  return id;
}

module.exports = parseId;
