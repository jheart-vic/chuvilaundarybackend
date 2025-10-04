import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['customer', 'admin'],
    required: true
  },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const IssueSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  // 👇 Original customer's initial message stored as the first entry in messages
  messages: [MessageSchema],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Issue', IssueSchema);
