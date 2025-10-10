// utils/retailPricing.js
import ServicePricing from '../models/ServicePricing.js'
import { getProximityFromAgulu } from './addressChecker.js'
import { getConfigValue } from './config.js'

/**
 * Get retail price for a single service + tier.
 * Uses ServicePricing + Config overrides.
 */
export async function getRetailItemPrice (
  serviceCode,
  serviceTier,
  { express = false, sameDay = false } = {}
) {
  const pricing = await ServicePricing.findOne({
    serviceCode,
    serviceTier,
    pricingModel: 'RETAIL'
  })
  if (!pricing) {
    throw new Error(
      `No retail pricing found for ${serviceCode} (${serviceTier})`
    )
  }

  // --- Base price ---
  let base = pricing.pricePerItem

  // Config override (per item price)
  const overrideKey = `price_${serviceCode}_${serviceTier}`
  const overridePrice = await getConfigValue(overrideKey)
  if (overridePrice) {
    base = overridePrice
  }

  // --- Surcharges ---
  if (sameDay) {
    base = base * (pricing.sameDayMultiplier ?? 1.8)
  } else if (express) {
    base = base * (pricing.expressMultiplier ?? 1.5)
  }

  return base
}
/**
 * Compute delivery fee for retail order by distance.
 * Uses ServicePricing + Config overrides.
 */
// export async function computeRetailDeliveryFee (distanceKm, { pricing } = {}) {
//   if (!pricing) return 0

//   const included = pricing.delivery_km_included || 0
//   const extraKm = Math.max(0, distanceKm - included)

//   // Get per-km fee with fallback defaults
//   const perKmRate =
//     (await getConfigValue('DELIVERY_FEE_PER_KM')) ||
//     pricing.delivery_fee_per_km ||
//     500

//   return extraKm * perKmRate
// }


// /**
//  * Compute retail delivery fee (base + proximity)
//  * Base fee: ₦500
//  * No distance required
//  */
export async function computeRetailDeliveryFee(address = {}, subtotal = 0) {
  const BASE_FEE = 500

  // Determine proximity
  const proximity = getProximityFromAgulu(address)

  // Proximity multipliers
  const multiplierMap = {
    near: 1.0,
    mid: 1.1,   // +10%
    far: 1.25   // +25%
  }

  let fee = Math.round(BASE_FEE * (multiplierMap[proximity] || 1))

  // Free delivery if subtotal exceeds threshold
  const FREE_THRESHOLD = 15000
  if (subtotal >= FREE_THRESHOLD) fee = 0

  return fee
}
