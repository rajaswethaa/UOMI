
const nameRule = {
  type: 'string',
  min: 2,
  max: 100
};

const phoneRule = {
  type: 'string',
  pattern: '^\\+?[0-9]{10,15}$'
};

const avatarUrlRule = {
  type: 'string',
  max: 1000
};

const pushEnabledRule = {
  type: 'boolean'
};

const updateProfileRules = {
  name: nameRule,
  phone: phoneRule,
  avatar_url: avatarUrlRule,
  push_enabled: pushEnabledRule
};

const adminUpdateRules = {
  name: nameRule,
  phone: phoneRule,
  avatar_url: avatarUrlRule,
  push_enabled: pushEnabledRule
};

module.exports = {
  updateProfileRules,
  adminUpdateRules
};
