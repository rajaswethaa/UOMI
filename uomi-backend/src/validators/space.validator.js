
const createSpaceRules = {
  name: {
    type: 'string',
    min: 1,
    max: 100,
    required: true
  },

  icon_id: {
    type: 'string',
    max: 100
  }
};

const updateSpaceRules = {
  name: {
    type: 'string',
    min: 1,
    max: 100
  },

  icon_id: {
    type: 'string',
    max: 100
  }
};

const addSpaceMemberRules = {
  user_id: {
    type: 'number',
    required: true
  }
};

const removeSpaceMemberRules = {};

module.exports = {
  createSpaceRules,
  updateSpaceRules,
  addSpaceMemberRules,
  removeSpaceMemberRules
};
