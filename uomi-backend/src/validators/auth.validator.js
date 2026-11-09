const registerRules = {
  name: { required: true, type: 'string', min: 2, max: 100 },
  email: { required: true, type: 'string', email: true, max: 255 },
  password: { required: true, type: 'string', min: 8, max: 72 },
};

const loginRules = {
  email: { required: true, type: 'string', email: true, max: 255 },
  password: { required: true, type: 'string', min: 1, max: 72 },
};

module.exports = { registerRules, loginRules };
