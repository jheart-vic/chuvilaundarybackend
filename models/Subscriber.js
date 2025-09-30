// models/Subscriber.js
import mongoose from "mongoose";

const SubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

export default mongoose.model("Subscriber", SubscriberSchema);
