import SubscriptionPlan from "../models/SubscriptionPlan.js";

/**
 * ✅ Admin: Create a new subscription plan
 */
export const createPlan = async (req, res, next) => {
  try {
    const { code } = req.body;

    // Ensure unique code
    const exists = await SubscriptionPlan.findOne({ code });
    if (exists) {
      return res.status(400).json({ message: "Plan code already exists" });
    }

    const plan = await SubscriptionPlan.create(req.body);

    // 🔔 Optional: Broadcast via WebSocket for live admin dashboard updates
    if (req.io) req.io.emit("plan:created", plan);

    res.status(201).json({
      message: "Plan created successfully",
      plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Admin: Update an existing plan
 */
export const updatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { code: req.params.code },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // 🔔 Broadcast update to connected frontends
    if (req.io) req.io.emit("plan:updated", plan);

    res.json({
      message: "Plan updated successfully",
      plan,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Public: List all active plans (for users)
 */
export const listPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true }).sort({
      price_ngn: 1,
    });
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Public: Get single plan details
 */
export const getPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ code: req.params.code });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

/**
 * ✅ Admin: Deactivate a plan
 */
export const deactivatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { code: req.params.code },
      { active: false },
      { new: true }
    );

    if (!plan) return res.status(404).json({ message: "Plan not found" });

    if (req.io) req.io.emit("plan:deactivated", plan);

    res.json({
      message: "Plan deactivated successfully",
      plan,
    });
  } catch (err) {
    next(err);
  }
};