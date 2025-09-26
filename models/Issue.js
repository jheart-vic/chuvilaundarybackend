///models/Issue.js
import mongoose from 'mongoose';


const IssueSchema = new mongoose.Schema({
name: { type: String, required: true },
phone: { type: String, required: true },
order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
message: { type: String, required: true },
status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
createdAt: { type: Date, default: Date.now }
});


export default mongoose.model('Issue', IssueSchema);