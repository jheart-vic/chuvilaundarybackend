// utils/subscriptionPricing.js
import { resolveZone, getDeliveryFeeForZone, isInsideServiceZone } from "./addressChecker.js";

/**
 * Compute subscription item price, updating usage safely.
 */
export async function computeSubscriptionItemPrice(
  plan,
  itemsRequested,
  { express = false } = {},
  usage = null
) {
  const monthlyItems = plan.monthly_items ?? 20; // default fallback
  const overageFee = plan.overageFee ?? 500;     // default fallback
  const priorityOverhead = plan.priority_overhead_per_item_ngn ?? 0;

  const usedItems = usage?.items_used ?? 0;
  const balance = monthlyItems - usedItems;

  // How many items exceed allowance
  const overage = Math.max(0, itemsRequested - balance);


  const basePerItem = overage > 0 ? overageFee : 0;
  const perItemPrice = basePerItem + (express ? priorityOverhead : 0);

  // Express charge is per item, not flat
  const expressCost = express ? priorityOverhead * itemsRequested : 0;
  const totalFee = overage * overageFee + expressCost;

  if (usage) {
    usage.items_used = usedItems + itemsRequested;
    usage.overage_items = Math.max(0, usage.items_used - monthlyItems);
    usage.computed_overage_fee_ngn = usage.overage_items * overageFee;
    await usage.save();
  }

  return {
    included: Math.min(balance, itemsRequested),
    overage,
    totalFee,
    perItemPrice,  // << NEW, so your items[].price can be filled
  };
}

/**
 * Compute subscription delivery fee safely.
 */
export async function computeSubscriptionDeliveryFee(
  plan,
  address,
  subtotal = 0,
  usage = null
) {
  const zone = resolveZone(address);
  const inside = await isInsideServiceZone(address);

  const includedTrips = plan.included_trips ?? 2; // default fallback

  if (plan.family === "BASIC_SAVER") {
    return await getDeliveryFeeForZone(zone, subtotal);
  }

  if ((plan.family === "PREM_CHOICE" || plan.family === "VIP") && inside) {
    if (usage && (usage.trips_used ?? 0) < includedTrips) {
      usage.trips_used = (usage.trips_used ?? 0) + 1;
      await usage.save();
      return 0;
    }
  }

  return await getDeliveryFeeForZone(zone, subtotal);
}
