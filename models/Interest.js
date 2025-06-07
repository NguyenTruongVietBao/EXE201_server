const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  emoji: {
    type: String,
    required: true,
    default: '✨',
  },
});

module.exports = mongoose.model('Interest', interestSchema);
