// utils/orderTotals.js
import {
  computeRetailDeliveryFee,
  getRetailItemPrice
} from './retailPricing.js'
import {
  computeSubscriptionItemPrice,
  computeSubscriptionDeliveryFee
} from './subscriptionPricing.js'
import { validateAndApplyCoupon } from './coupon.js'


// normalize sameDay/express flags
function normalizeFlags(item, order) {
  const sameDay = item.sameDay || order.sameDay || false
  const express = !sameDay && (item.express || order.express || false)
  return { express, sameDay }
}


/**
 * Compute order totals for subscription or retail orders
 */
export async function computeOrderTotals(order, { plan = null, usage = null } = {}) {
  let itemsTotal = 0
  let addOnsTotal = 0
  let deliveryFee = 0

  const pricingModel = plan ? 'SUBSCRIPTION' : order.pricingModel || 'RETAIL'

  // Safety check: limit same-day items
  const sameDayCount = order.items
    .filter(i => i.sameDay || order.sameDay)
    .reduce((sum, i) => sum + (i.quantity || 0), 0)
  if (sameDayCount > 15) throw new Error('Same-day service is limited to 15 items per order.')

  // --- Process items ---
  for (const item of order.items) {
    const { express, sameDay } = normalizeFlags(item, order)
    let itemTotal = 0

    if (pricingModel === 'SUBSCRIPTION') {
      if (!plan) throw new Error('Subscription plan object must be provided')
      const result = await computeSubscriptionItemPrice(plan, item.quantity, { express, sameDay }, usage)
      item.price = result.totalFee / (item.quantity || 1)
      itemTotal = result.totalFee
    } else {
      // RETAIL
      const unitPrice = await getRetailItemPrice(item.serviceCode, order.serviceTier, { express, sameDay })
      item.price = unitPrice
      itemTotal = unitPrice * (item.quantity || 1)
    }

    itemsTotal += itemTotal

    // Add-ons
    if (item.addOns?.length) {
      addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
    }
  }

  // --- Compute delivery fee ---
  if (pricingModel === 'SUBSCRIPTION') {
    deliveryFee = await computeSubscriptionDeliveryFee(
      plan,
      order.delivery?.address || {},
      itemsTotal + addOnsTotal,
      usage
    )
  } else {
    deliveryFee = await computeRetailDeliveryFee(
      order.delivery?.address || {},
      itemsTotal + addOnsTotal
    )
  }

  // --- Compute subtotal & coupon ---
  const subtotal = itemsTotal + addOnsTotal + deliveryFee
  let discount = 0

  const isRetail = pricingModel === 'RETAIL'
  const isOverageOrder = pricingModel === 'SUBSCRIPTION' && usage && usage.items_used >= plan?.monthly_items
  const allowCoupon = isRetail || isOverageOrder

  if (allowCoupon && order.couponCode) {
    try {
      const result = await validateAndApplyCoupon(order.couponCode, subtotal, order.userPhone)
      discount = result.discount
    } catch {
      discount = 0
    }
  }

  const grandTotal = Math.max(0, Math.round(subtotal - discount))
  deliveryFee = Math.round(deliveryFee)

  return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal, usage }
}


/**
 * Compute order totals (subscription or retail)
 */
// export async function computeOrderTotals(order, { plan = null, usage = null } = {}) {
//   let itemsTotal = 0
//   let addOnsTotal = 0
//   let deliveryFee = 0

//   const pricingModel = plan ? 'SUBSCRIPTION' : order.pricingModel || 'RETAIL'

//   // Safety check for same-day items
//   const sameDayCount = order.items
//     .filter(i => i.sameDay || order.sameDay)
//     .reduce((sum, i) => sum + (i.quantity || 0), 0)

//   if (sameDayCount > 15) {
//     throw new Error('Same-day service is limited to 15 items per order.')
//   }

//   if (pricingModel === 'SUBSCRIPTION') {
//     if (!plan) throw new Error('Subscription plan object must be provided')

//     for (const item of order.items) {
//       const { express, sameDay } = normalizeFlags(item, order)
//       const result = await computeSubscriptionItemPrice(
//         plan,
//         item.quantity,
//         { express, sameDay },
//         usage
//       )
//       item.price = result.totalFee / (item.quantity || 1)
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

//   } else {
//     // --- RETAIL flow ---
//     for (const item of order.items) {
//       const { express, sameDay } = normalizeFlags(item, order)
//       const unitPrice = await getRetailItemPrice(item.serviceCode, order.serviceTier, { express, sameDay })

//       item.price = unitPrice
//       itemsTotal += unitPrice * (item.quantity || 1)

//       if (item.addOns?.length) {
//         addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
//       }
//     }

//     // Compute delivery fee using flat base + proximity
//     deliveryFee = await computeRetailDeliveryFee(
//       order.delivery?.address || {},
//       itemsTotal + addOnsTotal
//     )
//   }

//   const subtotal = itemsTotal + addOnsTotal + deliveryFee

//   // --- Coupon ---
//   let discount = 0
//   const isRetail = pricingModel === 'RETAIL'
//   const isOverageOrder = pricingModel === 'SUBSCRIPTION' && usage && usage.items_used >= plan?.monthly_items
//   const allowCoupon = isRetail || isOverageOrder

//   if (allowCoupon && order.couponCode) {
//     try {
//       const result = await validateAndApplyCoupon(order.couponCode, subtotal, order.userPhone)
//       discount = result.discount
//     } catch {
//       discount = 0
//     }
//   }

//   const grandTotal = Math.max(0, Math.round(subtotal - discount))
//   deliveryFee = Math.round(deliveryFee)

//   return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal, usage }
// }




// import {
//   computeRetailDeliveryFee,
//   getRetailItemPrice
// } from './retailPricing.js'
// import {
//   computeSubscriptionItemPrice,
//   computeSubscriptionDeliveryFee
// } from './subscriptionPricing.js'
// import { validateAndApplyCoupon } from './coupon.js'
// import ServicePricing from '../models/ServicePricing.js'

// normalize sameDay/express flags
// function normalizeFlags (item, order) {
//   const sameDay = item.sameDay || order.sameDay || false
//   const express = !sameDay && (item.express || order.express || false)
//   return { express, sameDay }
// }

// /**
//  * Compute order totals (subscription or retail)
//  */
// export async function computeOrderTotals (
//   order,
//   { plan = null, usage = null } = {}
// ) {
//   let itemsTotal = 0
//   let addOnsTotal = 0
//   let deliveryFee = 0

//   const pricingModel = plan ? 'SUBSCRIPTION' : order.pricingModel || 'RETAIL'

//   // Safety check
//   const sameDayCount = order.items
//     .filter(i => i.sameDay || order.sameDay)
//     .reduce((sum, i) => sum + (i.quantity || 0), 0)

//   if (sameDayCount > 15) {
//     throw new Error('Same-day service is limited to 15 items per order.')
//   }

//   if (pricingModel === 'SUBSCRIPTION') {
//     if (!plan) throw new Error('Subscription plan object must be provided')

//     for (const item of order.items) {
//       const { express, sameDay } = normalizeFlags(item, order)
//       const result = await computeSubscriptionItemPrice(
//         plan,
//         item.quantity,
//         { express, sameDay },
//         usage
//       )
//       item.price = result.totalFee / (item.quantity || 1)
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
//   }  else {
//   // --- RETAIL flow ---
//   // 🧩 1. Collect unique service codes
//   const uniqueCodes = [...new Set(order.items.map(i => i.serviceCode))]

//   // 🧾 2. Fetch all relevant retail pricing entries in one query
//   const pricings = await ServicePricing.find({
//     serviceCode: { $in: uniqueCodes },
//     serviceTier: order.serviceTier,
//     pricingModel: 'RETAIL'
//   })

//   // 🚨 3. Validate pricing availability
//   if (pricings.length !== uniqueCodes.length) {
//     const foundCodes = pricings.map(p => p.serviceCode)
//     const missingCodes = uniqueCodes.filter(c => !foundCodes.includes(c))
//     throw new Error(`Missing retail pricing for: ${missingCodes.join(', ')}`)
//   }

//   // 🧠 4. Create quick-access map (serviceCode → pricing)
//   const pricingMap = new Map(pricings.map(p => [p.serviceCode, p]))

//   // 🧮 5. Compute totals for items and add-ons
//   for (const item of order.items) {
//     const { express, sameDay } = normalizeFlags(item, order)

//     // Get the correct pricing entry for this service
//     const pricing = pricingMap.get(item.serviceCode)
//     if (!pricing) {
//       throw new Error(`No pricing found for serviceCode: ${item.serviceCode}`)
//     }

//     // ⚙️ 5a. Use shared util to get retail item price
//     const unitPrice = await getRetailItemPrice(
//       item.serviceCode,
//       order.serviceTier,
//       { express, sameDay }
//     )

//     // Apply quantity
//     item.price = unitPrice
//     itemsTotal += unitPrice * (item.quantity || 1)

//     // ⚙️ 5b. Handle add-ons (optional extras)
//     if (item.addOns?.length) {
//       addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
//     }
//   }

// deliveryFee = await computeRetailDeliveryFee(
//       order.delivery?.address || {},
//       itemsTotal + addOnsTotal
//     )
//   }

//   const subtotal = itemsTotal + addOnsTotal + deliveryFee

//   // --- Coupon ---
//   let discount = 0
//  // ✅ Automatic overage detection
//   const isRetail = pricingModel === 'RETAIL'
//   const isOverageOrder =
//     pricingModel === 'SUBSCRIPTION' &&
//     usage &&
//     usage.items_used >= plan?.monthly_items
//   const allowCoupon = isRetail || isOverageOrder

//   if (allowCoupon && order.couponCode) {
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

//   return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal, usage  }
// }
