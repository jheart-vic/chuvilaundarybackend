import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" },
  line1: String,
  line2: String,
  city: String,
  state: String,
  zone: String, // for delivery fee zones
  landmark: String
});

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true }, // E.164 preferred
  fullName: { type: String },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "employee", "admin"], default: "user" },
  isMember: { type: Boolean, default: false },
  membershipStartedAt: Date,
  addresses: [AddressSchema],
  referralCode: { type: String, unique: true },
 referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
// UserSchema
currentSubscription: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Subscription",
  default: null
}
,
  referralCredits: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verificationCode: String,
    verificationCodeExpires: Date,
  preferences: {
    detergent: String,
    hanger: Boolean,
    fragrance: String,
    specialCareNotes: String
  },
  createdAt: { type: Date, default: Date.now }

});

export default mongoose.model("User", UserSchema);
