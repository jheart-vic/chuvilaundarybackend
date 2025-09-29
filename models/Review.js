import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
});

ReviewSchema.index({ user: 1, order: 1 }, { unique: true });

export default mongoose.model('Review', ReviewSchema);
