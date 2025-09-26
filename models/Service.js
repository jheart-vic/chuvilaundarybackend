import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., Wash & Fold
  code: { type: String, required: true, unique: true },
  description: String,
  basePrice: Number, // base price per item or per kg
  unit: { type: String, enum: ["item", "kg", "bundle"], default: "item" },
  turnaroundHours: Number,
  addOns: [{
    key: String,
    name: String,
    price: Number
  }]
});

export default mongoose.model("Service", ServiceSchema);
