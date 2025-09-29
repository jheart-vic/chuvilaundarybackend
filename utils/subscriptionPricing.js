// utils/subscriptionPricing.js
import {
  resolveZone,
  getDeliveryFeeForZone,
  isInsideServiceZone
} from './addressChecker.js'

/**
 * Compute subscription item price and update usage.
 *
 * @param {Object} plan - SubscriptionPlan document
 * @param {number} itemsRequested - number of items in this order
 * @param {Object} options - { express: boolean, sameDay: boolean }
 * @param {Object} usage - SubUsage document for this month
 */
export async function computeSubscriptionItemPrice(
  plan,
  itemsRequested,
  { express = false, sameDay = false } = {},
  usage = null
) {
  const monthlyItems = plan.monthly_items ?? 20;
  const overageFee = plan.overageFee ?? 500;
  const priorityOverhead = plan.priority_overhead_per_item_ngn ?? 0;

  const usedItems = usage?.items_used ?? 0;
  const remainingAllowance = Math.max(0, monthlyItems - usedItems);

  // Included vs overage
  const includedItems = Math.min(itemsRequested, remainingAllowance);
  const overageItems = Math.max(0, itemsRequested - remainingAllowance);

  // --- Multiplier logic ---
  let multiplier = 1;
  if (sameDay) {
    multiplier = plan.sameDay_multiplier ?? 1.8;
  } else if (express) {
    multiplier = plan.express_multiplier ?? 1.2;
  }

  // Overhead applies if either express OR sameDay
  const applyOverhead = express || sameDay;

  // Pricing
  const includedPrice = includedItems * (applyOverhead ? priorityOverhead : 0);

  const overageBase =
    overageItems * (overageFee + (applyOverhead ? priorityOverhead : 0));
  const overagePrice = overageBase * multiplier;

  const totalFee = includedPrice + overagePrice;
  const perItemPrice = itemsRequested > 0 ? totalFee / itemsRequested : 0;

  // --- Update usage ---
  if (usage) {
    usage.items_used = usedItems + itemsRequested;
    usage.overage_items = Math.max(0, usage.items_used - monthlyItems);
    usage.computed_overage_fee_ngn = usage.overage_items * overageFee;

    // Track separately
    if (express) {
      usage.express_orders_used =
        (usage.express_orders_used ?? 0) + itemsRequested;
    }
    if (sameDay) {
      usage.sameDay_orders_used =
        (usage.sameDay_orders_used ?? 0) + itemsRequested;
    }

    await usage.save();
  }

  return {
    included: includedItems,
    overage: overageItems,
    totalFee,
    perItemPrice,
  };
}


/**
 * Compute subscription delivery fee.
 */
export async function computeSubscriptionDeliveryFee (
  plan,
  address,
  subtotal = 0,
  usage = null
) {
  const zone = resolveZone(address)
  const inside = await isInsideServiceZone(address)

  const includedTrips = plan.included_trips ?? 2

  if (plan.family === 'BASIC_SAVER') {
    return await getDeliveryFeeForZone(zone, subtotal)
  }

  if ((plan.family === 'PREM_CHOICE' || plan.family === 'VIP') && inside) {
    if (usage && (usage.trips_used ?? 0) < includedTrips) {
      usage.trips_used = (usage.trips_used ?? 0) + 1
      await usage.save()
      return 0
    }
  }

  return await getDeliveryFeeForZone(zone, subtotal)
}
