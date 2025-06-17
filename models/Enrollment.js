const mongoose = require('mongoose');

// User A đã sở hữu Document B vào lúc ...
const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  enrollmentDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
