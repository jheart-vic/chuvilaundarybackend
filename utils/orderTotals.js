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
function normalizeFlags (item, order) {
  const sameDay = item.sameDay || order.sameDay || false
  const express = !sameDay && (item.express || order.express || false)
  return { express, sameDay }
}

/**
 * Compute order totals (subscription or retail)
 */
export async function computeOrderTotals (
  order,
  { plan = null, usage = null } = {}
) {
  let itemsTotal = 0
  let addOnsTotal = 0
  let deliveryFee = 0

  const pricingModel = plan ? 'SUBSCRIPTION' : order.pricingModel || 'RETAIL'

  // Safety check
  const sameDayCount = order.items
    .filter(i => i.sameDay || order.sameDay)
    .reduce((sum, i) => sum + (i.quantity || 0), 0)

  if (sameDayCount > 15) {
    throw new Error('Same-day service is limited to 15 items per order.')
  }

  if (pricingModel === 'SUBSCRIPTION') {
    if (!plan) throw new Error('Subscription plan object must be provided')

    for (const item of order.items) {
      const { express, sameDay } = normalizeFlags(item, order)
      const result = await computeSubscriptionItemPrice(
        plan,
        item.quantity,
        { express, sameDay },
        usage
      )
      item.price = result.totalFee / (item.quantity || 1)
      itemsTotal += result.totalFee

      if (item.addOns?.length) {
        addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
      }
    }

    deliveryFee = await computeSubscriptionDeliveryFee(
      plan,
      order.delivery?.address || {},
      itemsTotal + addOnsTotal,
      usage
    )
  } else {
    // --- RETAIL branch ---
    for (const item of order.items) {
      const express = item.express || order.express || false
      const sameDay = item.sameDay || order.sameDay || false

      const unitPrice = await getRetailItemPrice(
        item.serviceCode,
        order.serviceTier,
        { express, sameDay }
      )

      item.price = unitPrice
      itemsTotal += unitPrice * (item.quantity || 1)

      if (item.addOns?.length) {
        addOnsTotal += item.addOns.reduce((sum, a) => sum + (a.price || 0), 0)
      }
    }

    const distanceKm = order.delivery?.distanceKm || 0
    deliveryFee = await computeRetailDeliveryFee(distanceKm)
  }

  const subtotal = itemsTotal + addOnsTotal + deliveryFee

  // --- Coupon ---
  let discount = 0
  if (order.couponCode) {
    try {
      const result = await validateAndApplyCoupon(
        order.couponCode,
        subtotal,
        order.userPhone
      )
      discount = result.discount
    } catch {
      discount = 0
    }
  }

  const grandTotal = Math.max(0, subtotal - discount)

  return { itemsTotal, addOnsTotal, deliveryFee, discount, grandTotal }
}
