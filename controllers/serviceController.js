// controllers/serviceController.js
import Service from "../models/Service.js";
import ServicePricing from "../models/ServicePricing.js";

// Customer-facing: list services with retail pricing included
export const listServices = async (req, res, next) => {
  try {
    // Fetch all services
    const services = await Service.find();

    // Attach pricings for each service
    const results = [];
    for (const service of services) {
      const pricings = await ServicePricing.find({
        serviceCode: service.code,
        pricingModel: "RETAIL"
      }).select("-__v -createdAt -updatedAt");

      results.push({
        ...service.toObject(),
        pricings,
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
};

/** Create service + auto-create pricing tiers */
export const createService = async (req, res, next) => {
  try {
    const payload = req.body;
    const service = await Service.create(payload);

    // Define retail tiers only
    const retailTiers = ["STANDARD", "PREMIUM", "SIGNATURE"];

    for (const tier of retailTiers) {
      const existingPricing = await ServicePricing.findOne({
        serviceCode: service.code,
        serviceTier: tier,
        pricingModel: "RETAIL",
      });

      if (!existingPricing) {
        let defaultPrice = service.basePrice || 1000;

        // Adjust price according to tier
        if (tier === "PREMIUM") defaultPrice = Math.round(defaultPrice * 1.4);
        if (tier === "SIGNATURE") defaultPrice = Math.round(defaultPrice * 2.0);

        await ServicePricing.create({
          serviceCode: service.code,
          serviceTier: tier,
          pricingModel: "RETAIL",
          pricePerItem: defaultPrice,
        });
      }
    }

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
};

/** Update a service (admin only) */
export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    const oldBasePrice = service.basePrice;
    Object.assign(service, req.body);
    await service.save();

    // If basePrice was updated, recalc retail tiers
    if (req.body.basePrice && req.body.basePrice !== oldBasePrice) {
      const retailTiers = ["STANDARD", "PREMIUM", "SIGNATURE"];
      for (const tier of retailTiers) {
        let defaultPrice = service.basePrice;

        if (tier === "PREMIUM") defaultPrice = Math.round(defaultPrice * 1.4);
        if (tier === "SIGNATURE") defaultPrice = Math.round(defaultPrice * 2.0);

        await ServicePricing.findOneAndUpdate(
          { serviceCode: service.code, serviceTier: tier, pricingModel: "RETAIL" },
          { pricePerItem: defaultPrice },
          { new: true }
        );
      }
    }

    res.json({ message: "Service updated", service });
  } catch (err) {
    next(err);
  }
};

/** Delete a service + cascade delete pricing */
export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    await ServicePricing.deleteMany({ serviceCode: service.code });

    res.json({ message: "Service and related pricings deleted successfully" });
  } catch (err) {
    next(err);
  }
};

