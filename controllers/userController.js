import User from "../models/User.js";
import { resolveZone } from "../utils/addressChecker.js";
import { DateTime } from 'luxon';


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -verificationCode -verificationCodeExpires"
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const saveAddress = async (req, res, next) => {
  try {
    const { label, line1, line2, city, state, landmark } = req.body;

    // Calculate zone
    const zone = resolveZone({ city, state }) || "zone1";

    // Fetch user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if the exact same address with the same label already exists
    const exists = user.addresses.some(addr =>
      addr.label === label &&
      addr.line1 === line1 &&
      addr.line2 === line2 &&
      addr.city === city &&
      addr.state === state &&
      addr.landmark === landmark
    );

    if (exists) {
      return res.status(400).json({ message: "This address with the same label already exists" });
    }

    // Add new address
    const newAddress = { label, line1, line2, city, state, landmark, zone };
    user.addresses.push(newAddress);

    // Save user
    await user.save();

    // Return only the newly added address
    const addedAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      message: "Address added successfully",
      address: addedAddress
    });
  } catch (err) {
    next(err);
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const { label, line1, line2, city, state, landmark } = req.body;

    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(addressId);

    if (!addr) return res.status(404).json({ message: "Address not found" });

    addr.label = label || addr.label;
    addr.line1 = line1 || addr.line1;
    addr.line2 = line2 ?? addr.line2;
    addr.city = city || addr.city;
    addr.state = state || addr.state;
    addr.landmark = landmark ?? addr.landmark;

    // ✅ Always recalc zone if city/state changed
    if (city || state) {
      addr.zone = resolveZone({ city: addr.city, state: addr.state });
    }

    await user.save();
    res.json({ message: "Address updated", address: addr });
  } catch (err) {
    next(err);
  }
};


export const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Addresses fetched successfully",
      addresses: user.addresses
    });
  } catch (err) {
    next(err);
  }
};


// export const updatePreferences = async (req, res, next) => {
//   try {
//     const userId = req.user?._id;
//     const { preferences } = req.body;

//     if (!userId) return res.status(401).json({ message: "unauthenticated" });

//     const updatedUser = await User.findOneAndUpdate(
//       { _id: userId },
//       { $set: Object.fromEntries(
//         Object.entries(preferences).map(([key, value]) => [`preferences.${key}`, value])
//       ) },
//       { new: true, projection: { preferences: 1, _id: 0 } } // Only return preferences
//     );

//     res.json({ preferences: updatedUser.preferences });
//   } catch (err) {
//     next(err);
//   }
// };


export const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { preferences } = req.body;

    if (!userId) return res.status(401).json({ message: "unauthenticated" });
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ message: "Invalid preferences object" });
    }

    // Build dynamic $set object
    const updateFields = {};
    for (const [key, value] of Object.entries(preferences)) {
      updateFields[`preferences.${key}`] = value;
    }

    // Update user and return only preferences
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, projection: { preferences: 1, _id: 0 } } // return only preferences
    );

    res.json({ preferences: updatedUser.preferences });
  } catch (err) {
    next(err);
  }
};


export const joinMembership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.isMember)
      return res.status(400).json({ message: "Already a member" });

    user.isMember = true;
    user.membershipStartedAt = DateTime.now()
      .setZone('Africa/Lagos') // Nigeria local time
      .toJSDate();

    await user.save();

    // Return only relevant fields
    res.json({
      message: "Membership activated",
      user: {
        isMember: user.isMember,
        membershipStartedAt: user.membershipStartedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

export const leaveMembership = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.isMember)
      return res.status(400).json({ message: "Not a member" });

    user.isMember = false;
    user.membershipStartedAt = null;

    await user.save();

    // Return only relevant fields
    res.json({
      message: "Membership cancelled",
      user: {
        isMember: user.isMember,
        membershipStartedAt: user.membershipStartedAt
      }
    });
  } catch (err) {
    next(err);
  }
};
