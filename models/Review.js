//models/Review.js
import mongoose from 'mongoose';


const ReviewSchema = new mongoose.Schema({
user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
name: { type: String, required: true },
rating: { type: Number, min: 1, max: 5, required: true },
comment: { type: String },
order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
createdAt: { type: Date, default: Date.now }
});


export default mongoose.model('Review', ReviewSchema);