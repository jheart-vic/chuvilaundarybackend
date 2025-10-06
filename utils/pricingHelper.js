// utils/pricingHelper.js
export function calculateTierPrice(basePrice, tier) {
  let price = basePrice;

  if (tier === "PREMIUM") price = basePrice * 1.35;
  if (tier === "VIP") price = basePrice * 1.7;

  // Round to nearest ₦100
  return Math.round(price / 100) * 100;
}
