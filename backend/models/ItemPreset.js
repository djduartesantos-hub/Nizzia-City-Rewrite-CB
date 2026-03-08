const mongoose = require('mongoose');

const ItemPresetSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, default: 'Admin' },
  data: { type: Object, required: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ItemPreset', ItemPresetSchema);
