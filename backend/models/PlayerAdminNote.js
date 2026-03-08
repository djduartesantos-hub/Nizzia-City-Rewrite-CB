const mongoose = require('mongoose');

const PlayerAdminNoteSchema = new mongoose.Schema({
  playerUserId: { type: String, required: true, index: true },
  authorUserId: { type: String, required: true },
  authorName: { type: String, default: 'Unknown' },
  text: { type: String, required: true, trim: true },
  tags: [{ type: String, trim: true }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('PlayerAdminNote', PlayerAdminNoteSchema);
