import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

import {
  registerSchema,
  loginSchema,
  verifyPhoneSchema,
  resendCodeSchema,
  resetPasswordSchema
} from '../utils/validator.js'
import { sendEmail, sendSMS } from '../services/notificationService.js'
import Notification from '../models/Notification.js'

// Normalize phone to E.164 format for Nigeria (+234)
const normalizePhone = phone => {
  if (!phone) return null
  let normalized = phone.trim()
  if (normalized.startsWith('0')) {
    return `+234${normalized.slice(1)}`
  }
  if (normalized.startsWith('+234')) {
    return normalized
  }
  throw new Error('Invalid phone number format')
}

// Generate JWT
const generateToken = userId => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing')
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' })
}

// Generate unique referral code
const generateReferralCode = async () => {
  let codeExists = true
  let code
  while (codeExists) {
    code = `REF${Math.floor(1000 + Math.random() * 9000)}`
    codeExists = await User.findOne({ referralCode: code })
  }
  return code
}

/**
 * @desc Register new user
 */

export const register = async (req, res) => {
  try {
    // ✅ Joi validation
    const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { fullName, phone, email, password, referredBy, gender } = value;

    // ✅ Normalize phone number
    const normalizedPhone = normalizePhone(phone);

    // ✅ Check if user already exists
    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(400).json({ error: 'Phone already registered' });
    }

    // ✅ Generate referral code for this user
    const userReferralCode = await generateReferralCode();

    // ✅ Check inviter if referral exists
    let inviter = null;
    if (referredBy) {
      const refCode = referredBy.trim().toUpperCase();
      if (refCode === userReferralCode)
        return res.status(400).json({ error: 'Self-referral not allowed' });

      inviter = await User.findOne({ referralCode: refCode });
      if (!inviter)
        return res.status(400).json({ error: 'Invalid referral code' });
      if (inviter.phone === normalizedPhone)
        return res.status(400).json({ error: 'You cannot refer yourself' });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Generate OTP
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // ✅ Create user
    const newUser = await User.create({
      fullName,
      phone: normalizedPhone,
      email,
      password: hashedPassword,
      referralCode: userReferralCode,
      gender,
      referredBy: inviter?._id || null,
      verificationCode,
      verificationCodeExpires
    });

    // ✅ Reward inviter if valid
 // ✅ Reward inviter if valid
    if (inviter) {
      const REFERRAL_BONUS = 500; // ₦500 bonus

      inviter.referralCredits = (inviter.referralCredits || 0) + REFERRAL_BONUS;
      await inviter.save();

      await Notification.create({
        user: inviter._id,
        title: "Referral Bonus Earned 🎉",
        message: `${fullName} signed up using your referral code! You earned ₦${REFERRAL_BONUS} referral bonus.`,
        type: "referral",
      });
    }


    // ✅ Try sending OTP via Termii
    try {
      await sendSMS(normalizedPhone, `Your verification code is ${verificationCode}`);
      await sendEmail(email, 'Your Verification Code', `<p>Your new verification code is <strong>${verificationCode}</strong></p>`);

    } catch (smsErr) {
      console.error("OTP SMS failed:", smsErr.message);
      // ❌ Rollback (delete the user) to avoid dangling accounts
      await User.findByIdAndDelete(newUser._id);
      return res.status(500).json({
        error: "Registration failed. Could not deliver OTP. Please try again."
      });
    }

    // ✅ Return safe response (exclude password & OTP fields)
    return res.status(201).json({
      message: "Registered successfully. Please verify your phone.",
      data: {
        _id: newUser._id,
        fullName: newUser.fullName,
        phone: newUser.phone,
        email: newUser.email,
        gender,
        referralCode: newUser.referralCode,
        referredBy: newUser.referredBy,
        isVerified: newUser.isVerified,
        createdAt: newUser.createdAt
      }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
};


/**
 * @desc Login user
 */
export const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false
    })
    if (error) {
      return res
        .status(400)
        .json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        })
    }

    const { phone, password } = value
    const normalizedPhone = normalizePhone(phone)

    const user = await User.findOne({ phone: normalizedPhone })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const token = generateToken(user._id)

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        referralCode: user.referralCode,
        referralCredits: user.referralCredits,
        createdAt: user.createdAt
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

/**
 * @desc Verify phone number
 */
export const verifyPhone = async (req, res) => {
  try {
    const { error, value } = verifyPhoneSchema.validate(req.body, {
      abortEarly: false
    })
    if (error) {
      return res
        .status(400)
        .json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        })
    }

    const { phone, code } = value
    const normalizedPhone = normalizePhone(phone)

    const user = await User.findOne({ phone: normalizedPhone })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.isVerified)
      return res.status(400).json({ error: 'Already verified' })

    const isCodeValid = String(user.verificationCode) === String(code)
    const isCodeExpired = user.verificationCodeExpires < Date.now()

    if (!isCodeValid || isCodeExpired)
      return res
        .status(400)
        .json({ error: 'Invalid or expired verification code' })

    user.isVerified = true
    user.verificationCode = null
    user.verificationCodeExpires = null
    await user.save()

    const token = generateToken(user._id)
    res.json({ token, user })
  } catch (err) {
    console.error('Verify phone error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
}

/**
 * @desc Resend verification code (via phone + email if available)
 */
export const resendCode = async (req, res) => {
  try {
    const { error, value } = resendCodeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    let user;

    if (value.phone) {
      const normalizedPhone = normalizePhone(value.phone);
      user = await User.findOne({ phone: normalizedPhone });
    } else if (value.email) {
      user = await User.findOne({ email: value.email.toLowerCase() });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Already verified' });

    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send via phone (if user has phone)
    if (user.phone) {
      const normalizedPhone = normalizePhone(user.phone);
      await sendSMS(normalizedPhone, `Your new verification code is ${code}`);
    }

    // Send via email (if user has email)
    if (user.email) {
      await sendEmail(
        user.email,
        'Your Verification Code',
        `<p>Your new verification code is <strong>${code}</strong></p>`
      );
    }

    res.json({ message: 'Verification code resent to all available channels' });
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
};


/**
 * @desc Reset password directly
 */
export const resetPasswordDirect = async (req, res) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body)
    if (error) return res.status(400).json({ error: error.details[0].message })

    const normalizedPhone = normalizePhone(value.phone)

    const user = await User.findOne({ phone: normalizedPhone })
    if (!user) return res.status(404).json({ error: 'User not found' })

    user.password = await bcrypt.hash(value.newPassword, 10)
    await user.save()

    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    console.error('Password reset error:', err)
    res.status(500).json({ error: 'Failed to reset password' })
  }
}
