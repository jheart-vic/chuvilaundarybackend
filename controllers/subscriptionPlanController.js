import SubscriptionPlan from "../models/SubscriptionPlan.js";

// ✅ Admin-only (handled by middleware)
export const createPlan = async (req, res, next) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    await plan.save();
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};

// ✅ Public
export const listPlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ active: true }).sort({ price_ngn: 1 });
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

// ✅ Public
export const getPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ code: req.params.code });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// ✅ Admin-only (handled by middleware)
export const updatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { code: req.params.code },
      req.body,
      { new: true }
    );

    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// ✅ Admin-only (handled by middleware)
export const deactivatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOneAndUpdate(
      { code: req.params.code },
      { active: false },
      { new: true }
    );

    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json({ message: "Plan deactivated", plan });
  } catch (err) {
    next(err);
  }
};
