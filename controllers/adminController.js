import User from "../models/User.js";
import Order from "../models/Order.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Coupon from "../models/Coupon.js";
import dotenv from "dotenv";
dotenv.config();
const getRandomNumber = () => Math.floor(10 + Math.random() * 90); // 10-99
const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};


export const adminRegister = async (req, res) => {
  const {  fullName, phone, email, password, masterPassword } = req.body;

  if (masterPassword !== process.env.ADMIN_MASTER_PASSWORD)
    return res.status(401).json({ message: "Invalid master password" });

  let user = await User.findOne({ phone });
  if (user) return res.status(400).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  user = await User.create({
    phone,
    fullName,
    email,
    password: hashedPassword,
    role: "admin",
    isVerified: true
  });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.status(201).json({ user, token });
};

export const adminLogin = async (req, res) => {
  const { phone, password, masterPassword } = req.body;

  let user = await User.findOne({ phone });

  // Login with master password
  if (masterPassword && masterPassword === process.env.ADMIN_MASTER_PASSWORD) {
    if (!user) {
      // Create admin user on the fly
      user = await User.create({
        phone,
        fullName: "Admin User",
        role: "admin",
        isVerified: true,
        password: await bcrypt.hash("defaultPassword123", 10) // or random
      });
    }
  } else {
    // Normal login
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.json({ user, token });
};

// create an employee user (admin only)
export const createEmployee = async (req, res, next) => {
  try {
    const { phone, fullName } = req.body;
    if (!phone || !fullName)
      return res.status(400).json({ message: "phone & name required" });

    let user = await User.findOne({ phone });

    // If user exists, update role & name
    if (user) {
      user.role = "employee";
      user.fullName = fullName;
      await user.save();
      return res.status(200).json(user);
    }

    // Generate a unique default password
    const referralCode = generateReferralCode();
    const randomNumber = getRandomNumber();
    const defaultPassword = `Employee${fullName.replace(/\s+/g, '')}${randomNumber}`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create new employee
    user = await User.create({
      phone,
      fullName,
      role: "employee",
      password: hashedPassword,
      referralCode,
      isVerified: true,
    });

    // Return user and generated password
    res.status(201).json({
      user,
      defaultPassword,
    });
  } catch (err) {
    next(err);
  }
};

/** admin update order status (any status including cancel) */
export const adminUpdateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "order not found" });
    order.status = status;
    order.history.push({ status, note });
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
};

/** admin create coupon */
export const createCoupon = async (req, res, next) => {
  try {
    const { code, discountPercent, discountAmount, expiresAt, minOrderValue, maxUses } = req.body;

    if (!code) return res.status(400).json({ message: "Coupon code is required" });
    if (!discountPercent && !discountAmount)
      return res.status(400).json({ message: "Provide either discountPercent or discountAmount" });

    // Ensure unique code
    const exists = await Coupon.findOne({ code: code.toUpperCase() });
    if (exists) return res.status(400).json({ message: "Coupon code already exists" });

    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountPercent,
      discountAmount,
      expiresAt,
      minOrderValue,
      maxUses,
    });

    res.status(201).json({ message: "Coupon created successfully", coupon });
  } catch (err) {
   console.error(err);
    next(err);
  }
};

/** GET all coupons (admin only) */
export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    next(err);
  }
};

/** GET single coupon by ID (admin only) */
export const getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (err) {
    next(err);
  }
};

/** UPDATE coupon (admin only) */
export const updateCoupon = async (req, res, next) => {
  try {
    const { code, discountPercent, discountAmount, expiresAt, minOrderValue, maxUses } = req.body;

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    if (code) coupon.code = code.toUpperCase();
    if (discountPercent !== undefined) coupon.discountPercent = discountPercent;
    if (discountAmount !== undefined) coupon.discountAmount = discountAmount;
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt;
    if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue;
    if (maxUses !== undefined) coupon.maxUses = maxUses;

    await coupon.save();
    res.json({ message: "Coupon updated", coupon });
  } catch (err) {
    next(err);
  }
};

/** DELETE coupon (admin only) */
export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon deleted successfully" });
  } catch (err) {
    next(err);
  }
};


