import mongoose from "mongoose";

export const connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri, {
      dbName: "laundrydb",
      autoIndex: true
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error", err);
    throw err;
  }
};
