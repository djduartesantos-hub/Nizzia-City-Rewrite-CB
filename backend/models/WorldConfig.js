const mongoose = require('mongoose')

const worldConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

module.exports = mongoose.model('WorldConfig', worldConfigSchema)
