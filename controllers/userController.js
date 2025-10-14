import User from '../models/User.js'
import bcrypt from 'bcryptjs'
import { resolveZone } from '../utils/addressChecker.js'
import { DateTime } from 'luxon'
import { uploadToCloudinary } from '../middlewares/uploadMiddleware.js'

// file validation config
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -verificationCode -verificationCodeExpires')
      .populate('referredBy', 'fullName')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // 👇 Find users who were referred by this user
    const referredUsers = await User.find({ referredBy: user._id }).select(
      'fullName phone email createdAt'
    )

    res.json({
      ...user.toObject(),
      referredUsers // attach them to the profile response
    })
  } catch (err) {
    console.error('getProfile error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const saveAddress = async (req, res, next) => {
  try {
    const { label, line1, line2, city, lga, state, landmark } = req.body

    // Calculate zone
    const zone = resolveZone({ city, lga, state }) || 'zone1'

    // Fetch user
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Check if the exact same address with the same label already exists
    const exists = user.addresses.some(
      addr =>
        addr.label === label &&
        addr.line1 === line1 &&
        addr.line2 === line2 &&
        addr.city === city &&
        addr.lga === lga &&
        addr.state === state &&
        addr.landmark === landmark
    )

    if (exists) {
      return res
        .status(400)
        .json({ message: 'This address with the same label already exists' })
    }

    // Add new address
    const newAddress = { label, line1, line2, city, lga, state, landmark, zone }
    user.addresses.push(newAddress)

    // Save user
    await user.save()

    // Return only the newly added address
    const addedAddress = user.addresses[user.addresses.length - 1]

    res.status(201).json({
      message: 'Address added successfully',
      address: addedAddress
    })
  } catch (err) {
    next(err)
  }
}

export const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params
    const { label, line1, line2, city, lga, state, landmark } = req.body

    const user = await User.findById(req.user._id)
    const addr = user.addresses.id(addressId)

    if (!addr) return res.status(404).json({ message: 'Address not found' })

    addr.label = label || addr.label
    addr.line1 = line1 || addr.line1
    addr.line2 = line2 ?? addr.line2
    addr.city = city || addr.city
    addr.lga = lga || addr.lga
    addr.state = state || addr.state
    addr.landmark = landmark ?? addr.landmark

    // ✅ Always recalc zone if city/state changed
    if (city || lga || state) {
      addr.zone = resolveZone({
        city: addr.city,
        lga: addr.lga,
        state: addr.state
      })
    }

    await user.save()
    res.json({ message: 'Address updated', address: addr })
  } catch (err) {
    next(err)
  }
}

export const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user?._id
    const addressId = req.params.addressId

    // Remove the address directly in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true } // return the updated user
    ).select('-password')

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if the address still exists (means it wasn’t deleted)
    const stillExists = updatedUser.addresses.some(
      addr => addr._id.toString() === addressId
    )
    if (stillExists) {
      return res.status(404).json({ message: 'Address not found' })
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses: updatedUser.addresses // return the updated list
    })
  } catch (err) {
    next(err)
  }
}

export const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('addresses')
    if (!user) return res.status(404).json({ message: 'User not found' })

    res.status(200).json({
      message: 'Addresses fetched successfully',
      addresses: user.addresses
    })
  } catch (err) {
    next(err)
  }
}

export const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user?._id
    const { preferences } = req.body

    if (!userId) return res.status(401).json({ message: 'unauthenticated' })
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ message: 'Invalid preferences object' })
    }

    // Build dynamic $set object
    const updateFields = {}
    for (const [key, value] of Object.entries(preferences)) {
      updateFields[`preferences.${key}`] = value
    }

    // Update user and return only preferences
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, projection: { preferences: 1, _id: 0 } } // return only preferences
    )

    res.json({ preferences: updatedUser.preferences })
  } catch (err) {
    next(err)
  }
}

export const joinMembership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    if (user.isMember)
      return res.status(400).json({ message: 'Already a member' })

    user.isMember = true
    user.membershipStartedAt = DateTime.now()
      .setZone('Africa/Lagos') // Nigeria local time
      .toJSDate()

    await user.save()

    // Return only relevant fields
    res.json({
      message: 'Membership activated',
      user: {
        isMember: user.isMember,
        membershipStartedAt: user.membershipStartedAt
      }
    })
  } catch (err) {
    next(err)
  }
}

export const leaveMembership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user.isMember) return res.status(400).json({ message: 'Not a member' })

    user.isMember = false
    user.membershipStartedAt = null

    await user.save()

    // Return only relevant fields
    res.json({
      message: 'Membership cancelled',
      user: {
        isMember: user.isMember,
        membershipStartedAt: user.membershipStartedAt
      }
    })
  } catch (err) {
    next(err)
  }
}

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Only allow updating text fields (no photo)
    const allowedFields = ["fullName", "phone"];
    const updates = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Apply updates and save
    Object.assign(user, updates);
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({
      message: "Profile updated successfully",
      user: userObj,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Both current and new passwords are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Check if current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Current password is incorrect' });

    // ✅ Prevent using the same password again
    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld)
      return res
        .status(400)
        .json({ message: 'New password must be different from the current password' });

    // ✅ Hash and update new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};


export const getReferralInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('referralCode')

    if (!user || !user.referralCode) {
      return res.status(404).json({ error: 'Referral code not found' })
    }

    const referralLink = `https://chuvi-app-5sky.vercel.app/register?code=${user.referralCode}`

    res.json({ referralCode: user.referralCode, referralLink })
  } catch (err) {
    console.error('Error generating referral info:', err)
    res.status(500).json({ error: 'Failed to fetch referral info' })
  }
}

// export const updatePhotoUrl = async (req, res) => {
//   try {
//     const userId = req.user?._id || req.params.id // from auth or param
//     const file = req.file

//     if (!file) {
//       return res.status(400).json({ message: 'No image file uploaded' })
//     }

//     // Upload to Cloudinary
//     const result = await uploadToCloudinary(file.buffer, 'user_photos')

//     // Update user photoUrl
//     const user = await User.findByIdAndUpdate(
//       userId,
//       { photoUrl: result.secure_url },
//       { new: true }
//     ).select('-password')

//     if (!user) {
//       return res.status(404).json({ message: 'User not found' })
//     }

//     res.json({
//       message: 'Profile photo updated successfully',
//       photoUrl: user.photoUrl,
//       user
//     })
//   } catch (err) {
//     console.error('Error updating photo:', err)
//     res.status(500).json({ message: 'Server error', error: err.message })
//   }
// }

export const updatePhotoUrl = async (req, res) => {
  try {
    // || req.params.id; // from auth or param
    const userId = req.user?._id
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No image file uploaded" });
    }

    // Basic file validation
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type" });
    }
    if (file.size > MAX_FILE_BYTES) {
      return res.status(400).json({ message: "File too large (max 5MB)" });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(file.buffer, "user_photos");

    // Update user photoUrl
    const user = await User.findByIdAndUpdate(
      userId,
      { photoUrl: result.secure_url },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile photo updated successfully",
      photoUrl: user.photoUrl,
      user,
    });
  } catch (err) {
    console.error("Error updating photo:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};