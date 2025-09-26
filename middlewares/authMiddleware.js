import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { _id: payload.id, role: payload.role };// ✅ only store id
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin role required" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const requireEmployeeOrAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("role");
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.role === "employee" || user.role === "admin") return next();

    return res.status(403).json({ message: "Employee or Admin role required" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
