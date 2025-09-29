// import { getRetailItemPrice } from "./retailPricing.js";
// import { computeSubscriptionItemPrice, computeSubscriptionDeliveryFee } from "./subscriptionPricing.js";
// import { validateAndApplyCoupon } from "./coupon.js";
// import { getConfigValue } from "./config.js";
// import { resolveZone, getDeliveryFeeForZone } from "./addressChecker.js";

// /**
//  * Compute order totals based on pricing model (retail or subscription)
//  * Mutates items[] to include `.price`
//  */
// export async function computeOrderTotals(order, { plan = null, usage = null } = {}) {
//   let itemsTotal = 0;
//   let addOnsTotal = 0;
//   let deliveryFee = 0;

//   // Auto-upgrade to SUBSCRIPTION if user has an active plan
//   const pricingModel = plan ? "SUBSCRIPTION" : order.pricingModel || "RETAIL";

//   if (pricingModel === "SUBSCRIPTION") {
//     if (!plan) throw new Error("Subscription plan object must be provided for SUBSCRIPTION orders");

//     for (const item of order.items) {
//       const result = await computeSubscriptionItemPrice(plan, item.quantity, { express: item.express }, usage);

//       // Spread totalFee over quantity for per-item price
//       item.price = result.totalFee / (item.quantity || 1);
//       itemsTotal += result.totalFee;

//       if (item.addOns?.length) {
//         addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
//       }
//     }

//     deliveryFee = await computeSubscriptionDeliveryFee(plan, order.delivery?.address || {}, itemsTotal + addOnsTotal, usage);

//   } else {
//     // RETAIL pricing
//     for (const item of order.items) {
//       const unitPrice = await getRetailItemPrice(item.serviceCode, order.serviceTier, { express: item.express });
//       item.price = unitPrice;
//       itemsTotal += unitPrice * (item.quantity || 1);

//       if (item.addOns?.length) {
//         addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
//       }
//     }

//     const zone = resolveZone(order.delivery?.address || {});
//     deliveryFee = await getDeliveryFeeForZone(zone, itemsTotal + addOnsTotal, {
//       baseFee: await getConfigValue("DELIVERY_BASE_FEE"),
//       freeThreshold: await getConfigValue("DELIVERY_FREE_THRESHOLD"),
//     });
//   }

//   const subtotal = itemsTotal + addOnsTotal + deliveryFee;

//   // Apply coupon
//   let discount = 0;
//   if (order.couponCode) {
//     try {
//       const result = await validateAndApplyCoupon(order.couponCode, subtotal, order.userPhone);
//       discount = result.discount;
//     } catch {
//       discount = 0;
//     }
//   }

//   const grandTotal = Math.max(0, subtotal - discount);

//   return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal };
// }


import { getRetailItemPrice } from "./retailPricing.js";
import {
  computeSubscriptionItemPrice,
  computeSubscriptionDeliveryFee,
} from "./subscriptionPricing.js";
import { validateAndApplyCoupon } from "./coupon.js";
import { getConfigValue } from "./config.js";
import { resolveZone, getDeliveryFeeForZone } from "./addressChecker.js";


function normalizeFlags(item, order) {
  const sameDay = item.sameDay || order.sameDay || false;
  const express = !sameDay && (item.express || order.express || false);
  return { express, sameDay };
}
/**
 * Compute order totals based on pricing model (retail or subscription)
 * Mutates items[] to include `.price`
 */
export async function computeOrderTotals(order, { plan = null, usage = null } = {}) {
  let itemsTotal = 0;
  let addOnsTotal = 0;
  let deliveryFee = 0;

  // Auto-upgrade to SUBSCRIPTION if user has an active plan
  const pricingModel = plan ? "SUBSCRIPTION" : order.pricingModel || "RETAIL";

    // Safety check (in case validation missed it)
    const sameDayCount = order.items
      .filter(i => i.sameDay || order.sameDay)
      .reduce((sum, i) => sum + (i.quantity || 0), 0);

    if (sameDayCount > 15) {
      throw new Error("Same-day service is limited to 15 items per order.");
    }

  if (pricingModel === "SUBSCRIPTION") {
    if (!plan) throw new Error("Subscription plan object must be provided for SUBSCRIPTION orders");

    for (const item of order.items) {
      // --- Normalize flags ---
      const { express, sameDay } = normalizeFlags(item, order);

      const result = await computeSubscriptionItemPrice(
        plan,
        item.quantity,
        { express, sameDay },
        usage
      );

      // Spread totalFee over quantity for per-item price
      item.price = result.totalFee / (item.quantity || 1);
      itemsTotal += result.totalFee;

      if (item.addOns?.length) {
        addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
      }
    }

    deliveryFee = await computeSubscriptionDeliveryFee(
      plan,
      order.delivery?.address || {},
      itemsTotal + addOnsTotal,
      usage
    );

  } else {
    // --- RETAIL pricing ---
    for (const item of order.items) {
      const express = item.express || order.express || false;
      const sameDay = item.sameDay || order.sameDay || false;

      const unitPrice = await getRetailItemPrice(
        item.serviceCode,
        order.serviceTier,
        { express, sameDay }
      );

      item.price = unitPrice;
      itemsTotal += unitPrice * (item.quantity || 1);

      if (item.addOns?.length) {
        addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
      }
    }

    const zone = resolveZone(order.delivery?.address || {});
    deliveryFee = await getDeliveryFeeForZone(zone, itemsTotal + addOnsTotal, {
      baseFee: await getConfigValue("DELIVERY_BASE_FEE"),
      freeThreshold: await getConfigValue("DELIVERY_FREE_THRESHOLD"),
    });
  }

  const subtotal = itemsTotal + addOnsTotal + deliveryFee;

  // --- Apply coupon if present ---
  let discount = 0;
  if (order.couponCode) {
    try {
      const result = await validateAndApplyCoupon(
        order.couponCode,
        subtotal,
        order.userPhone
      );
      discount = result.discount;
    } catch {
      discount = 0;
    }
  }

  const grandTotal = Math.max(0, subtotal - discount);

  return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal };
}
