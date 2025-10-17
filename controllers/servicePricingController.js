import ServicePricing from "../models/ServicePricing.js";
import Service from "../models/Service.js";

/**
 * Create or update (upsert) a pricing entry
 */
export const upsertPricing = async (req, res, next) => {
  try {
    const { serviceCode, serviceTier, pricingModel, pricePerItem } = req.body;

    if (!serviceCode || !serviceTier || !pricingModel) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const service = await Service.findOne({ code: serviceCode });
    if (!service) {
      return res.status(404).json({ message: `Service ${serviceCode} not found` });
    }

    // match by ObjectId of service
    const pricing = await ServicePricing.findOneAndUpdate(
      { service: service._id, serviceTier, pricingModel },
      {
        service: service._id,
        serviceTier,
        pricingModel,
        pricePerItem,
      },
      { upsert: true, new: true }
    )
      .populate("service", "name code")
      .lean();

    res.json({ message: "Pricing saved", pricing });
  } catch (err) {
    next(err);
  }
};

/**
 * List all pricings (optionally filter by serviceCode)
 */
export const listPricings = async (req, res, next) => {
  try {
    const { serviceCode } = req.query;
    let filter = {};

    if (serviceCode) {
      const service = await Service.findOne({ code: serviceCode });
      if (!service) {
        return res.status(404).json({ message: `Service ${serviceCode} not found` });
      }
      filter.service = service._id;
    }

    const pricings = await ServicePricing.find(filter)
      .populate("service", "name code")
      .sort({ createdAt: -1 })
      .lean();

    res.json(pricings);
  } catch (err) {
    next(err);
  }
};

/**
 * Get single pricing
 */
export const getPricing = async (req, res, next) => {
  try {
    const pricing = await ServicePricing.findById(req.params.id)
      .populate("service", "name code")
      .lean();

    if (!pricing) return res.status(404).json({ message: "Pricing not found" });

    res.json(pricing);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete pricing
 */
export const deletePricing = async (req, res, next) => {
  try {
    const pricing = await ServicePricing.findByIdAndDelete(req.params.id).lean();
    if (!pricing) return res.status(404).json({ message: "Pricing not found" });

    res.json({ message: "Pricing deleted", pricing });
  } catch (err) {
    next(err);
  }
};
