// import mongoose from "mongoose";
// import { MongoMemoryServer } from "mongodb-memory-server";

// import ServicePricing from "../models/ServicePricing.js";
// import SubscriptionPlan from "../models/SubscriptionPlan.js";
// import SubUsage from "../models/SubUsage.js";

// import { getRetailItemPrice, computeRetailDeliveryFee } from "../utils/retailPricing.js";
// import { computeSubscriptionItemPrice, computeSubscriptionDeliveryFee } from "../utils/subscriptionPricing.js";
// import { computeOrderTotals } from "../utils/orderTotals.js";

// let mongoServer;

// beforeAll(async () => {
//   mongoServer = await MongoMemoryServer.create();
//   const uri = mongoServer.getUri();
//   await mongoose.connect(uri, { dbName: "test" });
// });

// afterAll(async () => {
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });

// beforeEach(async () => {
//   await ServicePricing.deleteMany({});
//   await SubscriptionPlan.deleteMany({});
//   await SubUsage.deleteMany({});

//   await ServicePricing.create({
//     serviceCode: "LAUNDRY",
//     serviceTier: "STANDARD",
//     pricingModel: "RETAIL",
//     pricePerItem: 1000,
//     sameDayMultiplier: 1.8,
//     expressMultiplier: 1.4
//   });

//   const plan = await SubscriptionPlan.create({
//     code: "BASIC_SAVER_12",
//     name: "Basic Saver 12",
//     family: "BASIC_SAVER",
//     tier: "STANDARD",
//     monthly_items: 20,
//     overageFee: 500,
//     included_trips: 2,
//     price_ngn: 10000,
//     express_multiplier: 1.2,
//     sameDay_multiplier: 1.8,
//     rollover_limit_items: 5
//   });

//   await SubUsage.create({
//     subscription: plan._id,
//     period_label: "2025-10",
//     items_used: 15,
//     trips_used: 1,
//     overage_items: 0,
//     computed_overage_fee_ngn: 0
//   });
// });

// describe("Retail Pricing", () => {
//   test("calculates normal, express, and sameDay prices", async () => {
//     const normal = await getRetailItemPrice("LAUNDRY", "STANDARD");
//     const express = await getRetailItemPrice("LAUNDRY", "STANDARD", { express: true });
//     const sameDay = await getRetailItemPrice("LAUNDRY", "STANDARD", { sameDay: true });

//     expect(normal).toBe(1000);
//     expect(express).toBe(1400);
//     expect(sameDay).toBe(1800);
//   });

//   test("computes delivery fee correctly", async () => {
//     const fee = await computeRetailDeliveryFee({ city: "Awka" }, 12000);
//     const free = await computeRetailDeliveryFee({ city: "Awka" }, 20000);

//     expect(fee).toBeGreaterThan(0);
//     expect(free).toBe(0);
//   });
// });

// describe("Subscription Pricing", () => {
//   test("computes item price including overage & multipliers", async () => {
//     const plan = await SubscriptionPlan.findOne({ code: "BASIC_SAVER_12" });
//     const usage = await SubUsage.findOne({ period_label: "2025-10" });

//     const normal = await computeSubscriptionItemPrice(plan, 5, {}, usage);
//     const express = await computeSubscriptionItemPrice(plan, 5, { express: true }, usage);
//     const sameDay = await computeSubscriptionItemPrice(plan, 5, { sameDay: true }, usage);

//     expect(normal.totalFee).toBe(0);
//     expect(express.totalFee).toBeGreaterThan(0);
//     expect(sameDay.totalFee).toBeGreaterThan(express.totalFee);
//   });

//   test("computes delivery fee", async () => {
//     const plan = await SubscriptionPlan.findOne({ code: "BASIC_SAVER_12" });
//     const usage = await SubUsage.findOne({ period_label: "2025-10" });

//     const fee = await computeSubscriptionDeliveryFee(plan, { city: "Awka" }, 8000, usage);
//     expect(fee).toBeGreaterThanOrEqual(0);
//   });
// });

// describe("Order Totals", () => {
//   test("computes retail order total", async () => {
//     const order = {
//       pricingModel: "RETAIL",
//       serviceTier: "STANDARD",
//       items: [
//         { serviceCode: "LAUNDRY", quantity: 3, express: true },
//         { serviceCode: "LAUNDRY", quantity: 2, sameDay: true }
//       ],
//       delivery: { address: { city: "Awka" } }
//     };

//     const totals = await computeOrderTotals(order);
//     expect(totals.itemsTotal).toBeGreaterThan(0);
//     expect(totals.grandTotal).toBeGreaterThan(0);
//   });

//   test("computes subscription order total", async () => {
//     const plan = await SubscriptionPlan.findOne({ code: "BASIC_SAVER_12" });
//     const usage = await SubUsage.findOne({ period_label: "2025-10" });

//     const order = {
//       items: [{ serviceCode: "LAUNDRY", quantity: 10, express: true }],
//       delivery: { address: { city: "Awka" } }
//     };

//     const totals = await computeOrderTotals(order, { plan, usage });
//     expect(totals.itemsTotal).toBeGreaterThan(0);
//     expect(totals.grandTotal).toBeGreaterThan(0);
//   });
// });


