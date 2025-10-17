import Service from "../models/Service.js";
import ServicePricing from "../models/ServicePricing.js";
import { calculateTierPrice } from "../utils/pricingHelper.js";

/**
 * List services with their retail pricings
 */
export const listServices = async (req, res, next) => {
  try {
    const services = await Service.find().lean();

    const results = [];
    for (const service of services) {
      const pricings = await ServicePricing.find({
        service: service._id,
        pricingModel: "RETAIL",
      })
        .select("-__v -createdAt -updatedAt")
        .lean();

      results.push({
        ...service,
        pricings,
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
};

/**
 * Create service + auto-create pricing tiers
 */
export const createService = async (req, res, next) => {
  try {
    const payload = req.body;
    const service = await Service.create(payload);

    const retailTiers = ["STANDARD", "PREMIUM", "VIP"];
    for (const tier of retailTiers) {
      const price = calculateTierPrice(service.basePrice || 1000, tier);
      await ServicePricing.create({
        service: service._id,
        serviceTier: tier,
        pricingModel: "RETAIL",
        pricePerItem: price,
      });
    }

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
};

/**
 * Update service + recalc pricing tiers
 */
export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const oldBasePrice = service.basePrice;
    Object.assign(service, req.body);
    await service.save();

    if (req.body.basePrice && req.body.basePrice !== oldBasePrice) {
      const retailTiers = ["STANDARD", "PREMIUM", "VIP"];
      for (const tier of retailTiers) {
        const newPrice = calculateTierPrice(service.basePrice, tier);
        await ServicePricing.findOneAndUpdate(
          { service: service._id, serviceTier: tier, pricingModel: "RETAIL" },
          { pricePerItem: newPrice }
        );
      }
    }

    res.json({ message: "Service updated", service });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete service + cascade delete pricings
 */
export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    await ServicePricing.deleteMany({ service: service._id });

    res.json({ message: "Service and related pricings deleted successfully" });
  } catch (err) {
    next(err);
  }
};
