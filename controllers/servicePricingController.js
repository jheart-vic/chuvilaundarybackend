// controllers/servicePricingController.js
import ServicePricing from "../models/ServicePricing.js";
import Service from "../models/Service.js";

/**
 * Create or update a service pricing entry
 * Admin can define per tier & pricing model
 */
export const upsertPricing = async (req, res, next) => {
  try {
    const { serviceCode, serviceTier, pricingModel, pricePerItem } = req.body;

    if (!serviceCode || !serviceTier || !pricingModel) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const service = await Service.findOne({ code: serviceCode });
    if (!service) {
      return res
        .status(404)
        .json({ message: `Service ${serviceCode} not found` });
    }

    const pricing = await ServicePricing.findOneAndUpdate(
      { serviceCode, serviceTier, pricingModel },
      {
        serviceCode,
        serviceTier,
        pricingModel,
        pricePerItem,
      },
      { upsert: true, new: true }
    ).lean();

    // attach serviceName dynamically
    pricing.serviceName = service.name;

    res.json({ message: "Pricing saved", pricing });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all pricings (optionally filter by serviceCode)
 */
export const listPricings = async (req, res, next) => {
  try {
    const { serviceCode } = req.query;
    const filter = serviceCode ? { serviceCode } : {};

    const pricings = await ServicePricing.find(filter).lean().sort({ serviceCode: 1 });

    // attach serviceName dynamically for each
    for (const p of pricings) {
      const svc = await Service.findOne({ code: p.serviceCode }).lean();
      p.serviceName = svc?.name || "";
    }

    res.json(pricings);
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single pricing entry
 */
export const getPricing = async (req, res, next) => {
  try {
    const pricing = await ServicePricing.findById(req.params.id).lean();
    if (!pricing) return res.status(404).json({ message: "Pricing not found" });

    const svc = await Service.findOne({ code: pricing.serviceCode }).lean();
    pricing.serviceName = svc?.name || "";

    res.json(pricing);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a pricing entry
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
