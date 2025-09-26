// controllers/serviceController.js
import Service from "../models/Service.js";
import ServicePricing from "../models/ServicePricing.js";

export const listServices = async (req, res) => {
  const services = await Service.find();
  res.json(services);
};


export const createService = async (req, res, next) => {
  try {
    const payload = req.body;
    const service = await Service.create(payload);

    // Define tiers you want to support in RETAIL
    const retailTiers = ["STANDARD", "EXPRESS", "SIGNATURE", ];

    for (const tier of retailTiers) {
      const existingPricing = await ServicePricing.findOne({
        serviceCode: service.code,
        serviceTier: tier,
        pricingModel: "RETAIL",
      });

      if (!existingPricing) {
        let defaultPrice = service.basePrice || 1000;

        // Example: adjust default pricing per tier
        if (tier === "EXPRESS") defaultPrice = Math.round(defaultPrice * 1.5);
        if (tier === "SIGNATURE" ) defaultPrice = Math.round(defaultPrice * 2);

        await ServicePricing.create({
          serviceCode: service.code,
          serviceName: service.name,
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
;


/** Update a service */
export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    Object.assign(service, req.body);
    await service.save();

    res.json({ message: "Service updated", service });
  } catch (err) {
    next(err);
  }
};

/** Delete a service */
export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Cascade delete pricing
    await ServicePricing.deleteMany({ serviceCode: service.code });

    res.json({ message: "Service and related pricings deleted successfully" });
  } catch (err) {
    next(err);
  }
};
