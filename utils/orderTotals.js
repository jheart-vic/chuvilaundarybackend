// // utils/orderTotals.js
// import { getRetailItemPrice } from './retailPricing.js'
// import {
//   computeSubscriptionItemPrice,
//   computeSubscriptionDeliveryFee
// } from './subscriptionPricing.js'
// import { validateAndApplyCoupon } from './coupon.js'
// import { getConfigValue } from './config.js'
// import { resolveZone, getDeliveryFeeForZone } from './addressChecker.js'

// /**
//  * Compute order totals based on pricing model (retail or subscription).
//  * Expects plan + usage to be passed in for subscription orders.
//  */
// export async function computeOrderTotals (
//   order,
//   { plan = null, usage = null } = {}
// ) {
//   let itemsTotal = 0
//   let addOnsTotal = 0
//   let deliveryFee = 0

//   if (order.pricingModel === 'RETAIL') {
//     for (const item of order.items) {
//       const unitPrice = await getRetailItemPrice(
//         item.serviceCode,
//         order.serviceTier,
//         { express: item.express }
//       )
//       itemsTotal += unitPrice * (item.quantity || 1)

//       if (item.addOns?.length) {
//         addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
//       }
//     }

//     const zone = resolveZone(order.delivery?.address || {})
//     deliveryFee = await getDeliveryFeeForZone(zone, itemsTotal + addOnsTotal, {
//       baseFee: await getConfigValue('DELIVERY_BASE_FEE'),
//       freeThreshold: await getConfigValue('DELIVERY_FREE_THRESHOLD')
//     })
//   } else if (order.pricingModel === 'SUBSCRIPTION') {
//     if (!plan) {
//       throw new Error(
//         `Subscription plan object must be provided for SUBSCRIPTION orders`
//       )
//     }

//     for (const item of order.items) {
//       const result = await computeSubscriptionItemPrice(
//         plan,
//         item.quantity,
//         { express: item.express },
//         usage
//       )

//       // ✅ Set per-item price on the item
//       item.price = result.perItemPrice

//       // Items total comes from totalFee (overage + express overhead)
//       itemsTotal += result.totalFee

//       if (item.addOns?.length) {
//         addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
//       }
//     }

//     deliveryFee = await computeSubscriptionDeliveryFee(
//       plan,
//       order.delivery?.address || {},
//       itemsTotal + addOnsTotal,
//       usage
//     )
//   }

//   const subtotal = itemsTotal + addOnsTotal + deliveryFee

//   // COUPON
//   let discount = 0
//   if (order.couponCode) {
//     try {
//       const result = await validateAndApplyCoupon(
//         order.couponCode,
//         subtotal,
//         order.userPhone
//       )
//       discount = result.discount
//     } catch {
//       discount = 0
//     }
//   }

//   const grandTotal = Math.max(0, subtotal - discount)

//   return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal }
// }


import { getRetailItemPrice } from "./retailPricing.js";
import { computeSubscriptionItemPrice, computeSubscriptionDeliveryFee } from "./subscriptionPricing.js";
import { validateAndApplyCoupon } from "./coupon.js";
import { getConfigValue } from "./config.js";
import { resolveZone, getDeliveryFeeForZone } from "./addressChecker.js";

/**
 * Compute order totals based on pricing model (retail or subscription).
 * Mutates items[] to include `price`.
 */
export async function computeOrderTotals(order, { plan = null, usage = null } = {}) {
  let itemsTotal = 0;
  let addOnsTotal = 0;
  let deliveryFee = 0;

  if (order.pricingModel === "RETAIL") {
    for (const item of order.items) {
      const unitPrice = await getRetailItemPrice(
        item.serviceCode,
        order.serviceTier,
        { express: item.express }
      );
      item.price = unitPrice; // ✅ set per-item price
      itemsTotal += unitPrice * (item.quantity || 1);

      if (item.addOns?.length) {
        addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0);
      }
    }

    const zone = resolveZone(order.delivery?.address || {});
    deliveryFee = await getDeliveryFeeForZone(
      zone,
      itemsTotal + addOnsTotal,
      {
        baseFee: await getConfigValue("DELIVERY_BASE_FEE"),
        freeThreshold: await getConfigValue("DELIVERY_FREE_THRESHOLD"),
      }
    );
  }

  else if (order.pricingModel === "SUBSCRIPTION") {
    if (!plan) {
      throw new Error(`Subscription plan object must be provided for SUBSCRIPTION orders`);
    }

    for (const item of order.items) {
      const result = await computeSubscriptionItemPrice(
        plan,
        item.quantity,
        { express: item.express },
        usage
      );
      // spread over quantity to get per-unit price
      item.price = result.totalFee / (item.quantity || 1); // ✅
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
  }

  const subtotal = itemsTotal + addOnsTotal + deliveryFee;

  // COUPON
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
