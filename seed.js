// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import Service from "./models/Service.js";
// import ServicePricing from "./models/ServicePricing.js";

// dotenv.config();

// const services = [
//   { name: "Shirt", code: "SHIRT", basePrice: 500 },
//   { name: "Trouser", code: "TROUSER", basePrice: 500 },
//   { name: "Simple Dress", code: "SIMPLE_DRESS", basePrice: 700 },
//   { name: "Jeans", code: "JEANS", basePrice: 700 },
//   { name: "Native (Top & Bottom)", code: "NATIVE", basePrice: 1000 },
//   { name: "Bedsheet", code: "BEDSHEET", basePrice: 700 },
//   { name: "Pillowcase", code: "PILLOWCASE", basePrice: 400 },
//   { name: "Duvet", code: "DUVET", basePrice: 2500 },
//   {name:"Agbada", code:"AGBADA", basePrice: 1500}
// ];

// const tiers = [
//   { serviceTier: "STANDARD", multiplier: 1 },
//   { serviceTier: "PREMIUM", multiplier: 1.35 },
//   { serviceTier: "VIP", multiplier: 1.7 },
// ];

// async function seed() {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("✅ Connected to MongoDB");

//     await Service.deleteMany({});
//     await ServicePricing.deleteMany({});

//     for (const svc of services) {
//       const newService = await Service.create({
//         name: svc.name,
//         code: svc.code,
//         description: `${svc.name} laundry service`,
//         basePrice: svc.basePrice,
//         unit: "item",
//         addOns: [
//           { key: "hand_finish", name: "Delicates hand-finish", price: 500 },
//           { key: "express", name: "Express 24-hour", price: 500 },
//           { key: "same_day", name: "Same-day (6h/8h/12h)", price: 800 },
//         ],
//       });

//       for (const tier of tiers) {
//         const price = Math.round((svc.basePrice * tier.multiplier) / 100) * 100;
//         await ServicePricing.create({
//           serviceCode: newService.code,
//           pricingModel: "RETAIL",
//           serviceTier: tier.serviceTier,
//           pricePerItem: price,
//           expressMultiplier: 1.5,
//           sameDayMultiplier: 1.8,
//           delivery_km_included: 0,
//           delivery_fee_per_km: 500,
//         });
//       }
//     }

//     console.log("✅ Services & Pricing seeded successfully!");
//     process.exit();
//   } catch (err) {
//     console.error("❌ Error seeding data:", err);
//     process.exit(1);
//   }
// }

// seed();

