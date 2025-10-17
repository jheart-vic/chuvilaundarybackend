import ServicePricing from "../models/ServicePricing.js";
import Service from "../models/Service.js";
import { getProximityFromAgulu } from "./addressChecker.js";
import { getConfigValue } from "./config.js";

/**
 * Get retail price for a single service + tier.
 * Uses ServicePricing + Config overrides.
 *
 * @param {string} serviceCode - The unique service code (e.g., 'SHORTS')
 * @param {string} serviceTier - One of 'STANDARD' | 'PREMIUM' | 'VIP'
 * @param {object} options - { express?: boolean, sameDay?: boolean }
 */
export async function getRetailItemPrice(
  serviceCode,
  serviceTier,
  { express = false, sameDay = false } = {}
) {
  // Find the service first (by code)
  const service = await Service.findOne({ code: serviceCode });
  if (!service) {
    throw new Error(`Service not found for code: ${serviceCode}`);
  }

  // Get the pricing for that service + tier
  const pricing = await ServicePricing.findOne({
    service: service._id,
    serviceTier,
    pricingModel: "RETAIL",
  });

  if (!pricing) {
    throw new Error(
      `No retail pricing found for service ${service.name} (${serviceTier})`
    );
  }

  // --- Base price ---
  let base = pricing.pricePerItem;

  // Config override (if admin wants to override specific service-tier)
  const overrideKey = `price_${serviceCode}_${serviceTier}`;
  const overridePrice = await getConfigValue(overrideKey);
  if (overridePrice) {
    base = Number(overridePrice);
  }

  // --- Surcharges ---
  if (sameDay) {
    base = base * (pricing.sameDayMultiplier ?? 1.8);
  } else if (express) {
    base = base * (pricing.expressMultiplier ?? 1.5);
  }

  return base;
}

/**
 * Compute retail delivery fee based on distance from Agulu and subtotal.
 */
export async function computeRetailDeliveryFee(address = {}, subtotal = 0) {
  const BASE_FEE = 500;

  // Determine proximity (near/mid/far)
  const proximity = getProximityFromAgulu(address);

  // Proximity multipliers
  const multiplierMap = {
    near: 1.0,
    mid: 1.1, // +10%
    far: 1.25, // +25%
  };

  let fee = Math.round(BASE_FEE * (multiplierMap[proximity] || 1));

  // Free delivery threshold
  const FREE_THRESHOLD = 15000;
  if (subtotal >= FREE_THRESHOLD) fee = 0;

  return fee;
}
