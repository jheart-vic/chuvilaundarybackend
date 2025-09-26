// models/Config.js
import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.model('Config', ConfigSchema);
