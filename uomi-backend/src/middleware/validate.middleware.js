
const ApiError = require('../utils/api-error');

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

/**
 * Builds middleware that validates and sanitizes req.body.
 * Only fields declared in rules survive.
 */
function validate(rules, options = {}) {
  const { atLeastOne = false } = options;

  return function validateBody(req, res, next) {
    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};

    const errors = [];
    const sanitized = {};

    for (const [field, rule] of Object.entries(rules)) {
      const raw = body[field];

      // Check empty values
      if (isBlank(raw)) {
        if (rule.required) {
          errors.push({
            field,
            message: `${field} is required`
          });
        }
        continue;
      }

      let value = raw;

      // Check data type, including arrays
      if (rule.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push({
            field,
            message: `${field} must be an array`
          });
          continue;
        }

        if (rule.min !== undefined && value.length < rule.min) {
          errors.push({
            field,
            message: `${field} must contain at least ${rule.min} items`
          });
          continue;
        }

        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({
            field,
            message: `${field} must contain at most ${rule.max} items`
          });
          continue;
        }
      } else if (rule.type && typeof value !== rule.type) {
        errors.push({
          field,
          message: `${field} must be a ${rule.type}`
        });
        continue;
      }

      if (typeof value === 'string') {
        value = value.trim();

        if (rule.min !== undefined && value.length < rule.min) {
          errors.push({
            field,
            message: `${field} must be at least ${rule.min} characters`
          });
          continue;
        }

        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({
            field,
            message: `${field} must be at most ${rule.max} characters`
          });
          continue;
        }

        if (rule.pattern) {
          const pattern =
            rule.pattern instanceof RegExp
              ? rule.pattern
              : new RegExp(rule.pattern);

          if (!pattern.test(value)) {
            errors.push({
              field,
              message: `${field} has an invalid format`
            });
            continue;
          }
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push({
            field,
            message: `${field} must be one of: ${rule.enum.join(', ')}`
          });
          continue;
        }
      }

      sanitized[field] = value;
    }

    // At least one valid field must be provided
    if (
      atLeastOne &&
      Object.keys(sanitized).length === 0 &&
      errors.length === 0
    ) {
      errors.push({
        field: null,
        message: 'At least one field must be provided'
      });
    }

    if (errors.length > 0) {
      return next(
        new ApiError(422, 'Validation failed', errors)
      );
    }

    req.body = sanitized;
    return next();
  };
}

module.exports = { validate };
