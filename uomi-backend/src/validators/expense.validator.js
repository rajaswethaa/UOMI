
const createExpenseRules = {
  space_id: {
    type: 'number',
    required: true
  },

  payer_id: {
    type: 'number',
    required: true
  },

  title: {
    type: 'string',
    min: 1,
    max: 150,
    required: true
  },

  total_paise: {
    type: 'number',
    required: true
  },

  split_type: {
    type: 'string',
    required: true,
    enum: ['equal', 'custom', 'item_based']
  },

  shares: {
    type: 'array',
    required: false,
    min: 1
  },

  items: {
    type: 'array',
    required: false,
    min: 1
  },

  client_request_id: {
    type: 'string'
  }
};

module.exports = {
  createExpenseRules
};
