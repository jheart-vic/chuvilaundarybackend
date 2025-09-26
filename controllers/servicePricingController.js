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
      return res.status(404).json({ message: `Service ${serviceCode} not found` });
    }

    const pricing = await ServicePricing.findOneAndUpdate(
      { serviceCode, serviceTier, pricingModel },
      {
        serviceCode,
        serviceName: service.name,
        serviceTier,
        pricingModel,
        pricePerItem,
      },
      { upsert: true, new: true }
    );

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
    const pricings = await ServicePricing.find(filter).sort({ serviceCode: 1 });
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
    const pricing = await ServicePricing.findById(req.params.id);
    if (!pricing) return res.status(404).json({ message: "Pricing not found" });
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
    const pricing = await ServicePricing.findByIdAndDelete(req.params.id);
    if (!pricing) return res.status(404).json({ message: "Pricing not found" });
    res.json({ message: "Pricing deleted", pricing });
  } catch (err) {
    next(err);
  }
};
