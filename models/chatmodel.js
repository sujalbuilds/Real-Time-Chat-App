const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:  { type: String, required: true },
  message:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now, required: true },
  room:      { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true }
});

module.exports = mongoose.model('Chat', chatSchema);
