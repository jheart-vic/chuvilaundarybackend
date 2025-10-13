// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import Service from "./models/Service.js";
// import ServicePricing from "./models/ServicePricing.js";

// dotenv.config();

// // ✅ Base services (Standard tier prices)
// const services = [
//   { name: "Shirt", code: "SHIRT", basePrice: 500 },
//   { name: "Trouser", code: "TROUSER", basePrice: 500 },
//   { name: "Simple Dress", code: "SIMPLE_DRESS", basePrice: 700 },
//   { name: "Jeans", code: "JEANS", basePrice: 700 },
//   { name: "Native (Top & Bottom)", code: "NATIVE", basePrice: 1000 },
//   { name: "Bedsheet", code: "BEDSHEET", basePrice: 700 },
//   { name: "Pillowcase", code: "PILLOWCASE", basePrice: 400 },
//   { name: "Duvet", code: "DUVET", basePrice: 2500 },
//   { name: "Agbada", code: "AGBADA", basePrice: 1500 },
// ];

// // ✅ Tiers and multipliers
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
//       // Create Service
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

//       // Create per-tier pricing
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


// export const createOrder = async (req, res, next) => {
//   const MAX_RETRIES = 3
//   let attempt = 0

//   while (attempt < MAX_RETRIES) {
//     const session = await mongoose.startSession()
//     session.startTransaction()

//     try {
//       const payload = req.body

//       // 🧩 1. Fetch logged-in user
//       const user = await User.findById(req.user._id)
//         .populate('currentSubscription')
//         .session(session)

//       if (!user) return res.status(404).json({ message: 'User not found' })
//       if (!user.phone)
//         return res.status(400).json({ message: 'User phone required' })
//       if (!user.email)
//         return res
//           .status(400)
//           .json({ message: 'User email required for payment' })

//       // 🧾 2. Basic payload validations
//       if (!payload.items?.length)
//         return res.status(400).json({ message: 'At least one item required' })
//       if (!payload.pickup?.address)
//         return res.status(400).json({ message: 'Pickup address required' })
//       if (!payload.delivery?.address)
//         return res.status(400).json({ message: 'Delivery address required' })

//       // 🎯 3. Generate delivery pin and orderId
//       const deliveryPin = generateDeliveryPin()
//       const tempId = new mongoose.Types.ObjectId()
//       const orderId = generateOrderId(tempId)

//       // 🖼️ 4. Handle photo uploads
//       let photos = []
//       if (req.files?.length) {
//         photos = await Promise.all(
//           req.files.map(async f => {
//             try {
//               const result = await uploadToCloudinary(
//                 f.buffer,
//                 'laundry/photos'
//               )
//               return result.secure_url
//             } catch (err) {
//               console.warn('Photo upload failed:', err.message)
//               return null
//             }
//           })
//         ).then(results => results.filter(Boolean))
//       }

//       // 🧾 5. Handle coupons
//       const couponCode = payload.couponCode?.trim().toUpperCase() || null

//       // 📦 6. Subscription check
//       const subscription = user.currentSubscription
//       let plan = null
//       let usage = null

//       if (subscription?.status === 'ACTIVE') {
//         plan = await SubscriptionPlan.findOne({
//           code: subscription.plan_code,
//           active: true
//         }).session(session)

//         if (plan) {
//           const periodLabel = DateTime.now().toFormat('yyyy-LL')
//           usage = await SubUsage.findOneAndUpdate(
//             { subscription: subscription._id, period_label: periodLabel },
//             {},
//             { new: true, upsert: true, session }
//           )
//         }
//       }

//       // ⚖️ 7. Determine pricing model and tier
//       const isSubscription = payload.pricingModel === 'SUBSCRIPTION' || !!plan
//       const pricingModel = isSubscription ? 'SUBSCRIPTION' : 'RETAIL'
//       let serviceTier = 'STANDARD'
//       let tierOverrideMessage = null

//       if (isSubscription) {
//         if (
//           payload.serviceTier &&
//           payload.serviceTier.toUpperCase() !== plan?.tier
//         ) {
//           tierOverrideMessage = `Service tier overridden to ${plan?.tier}`
//         }
//         serviceTier = plan?.tier || 'STANDARD'
//       } else {
//         serviceTier = payload.serviceTier?.toUpperCase() || 'STANDARD'
//       }

//       // 💰 8. Compute totals
//       const totals = await computeOrderTotals(
//         {
//           ...payload,
//           couponCode,
//           pricingModel,
//           subscriptionPlanCode: plan?.code,
//           userPhone: user.phone,
//           serviceTier
//         },
//         { plan, usage }
//       )
//       // 🧾 Check if it's user's first order
//       const previousOrder = await Order.findOne({ user: user._id })
//       let firstOrderDiscount = 0

//       if (!previousOrder) {
//         firstOrderDiscount = 500
//         totals.grandTotal = Math.max(totals.grandTotal - firstOrderDiscount, 0)
//         totals.discount = (totals.discount || 0) + firstOrderDiscount
//       }

//       // ⏰ 9. Compute SLA & ready time
//       const hasExpress = payload.items.some(i => i.express)
//       const hasSameDay = Boolean(payload.sameDay)

//       if (hasSameDay) {
//         const totalItems = payload.items.reduce(
//           (s, i) => s + (i.quantity || 1),
//           0
//         )
//         if (totalItems > 15)
//           return res
//             .status(400)
//             .json({ message: 'Same-day orders limited to 15 items max' })
//       }

//       const expectedReadyAt = computeExpectedReadyAt(
//         new Date(payload.pickup.date),
//         serviceTier,
//         { express: hasExpress, sameDay: hasSameDay }
//       )

//       const slaHours = Math.round(
//         (expectedReadyAt - new Date(payload.pickup.date)) / (1000 * 60 * 60)
//       )

//       // 💳 10. Prepare initial payment placeholder
//       const paymentInput = payload.payment || {}
//       if (!paymentInput.method)
//         return res.status(400).json({ message: 'Payment method required' })
//       if (!paymentInput.gateway)
//         return res.status(400).json({ message: 'Payment gateway required' })

//       const paymentData = {
//         method: paymentInput.method,
//         mode: paymentInput.mode || 'FULL',
//         amountPaid: 0,
//         balance: totals.grandTotal,
//         installments: [],
//         transactionId: null,
//         checkoutUrl: null,
//         gateway: paymentInput.gateway,
//         failedAttempts: 0,
//         status: 'PENDING'
//       }

//       // 💰 11. Create order inside transaction
//       const order = await Order.create(
//         [
//           {
//             _id: tempId,
//             user: user._id,
//             userPhone: user.phone,
//             userName: payload.userName || user.fullName,
//             items: payload.items,
//             notes: payload.notes,
//             photos,
//             couponCode,
//             totals,
//             discount: firstOrderDiscount,
//             pickup: payload.pickup,
//             delivery: payload.delivery,
//             status: 'Pending Payment',
//             history: [
//               {
//                 status: 'Pending Payment',
//                 note: 'Order created and awaiting payment'
//               }
//             ],
//             subscriptionPlanCode: plan?.code || null,
//             pricingModel,
//             serviceTier,
//             slaHours,
//             expectedReadyAt,
//             express: hasExpress,
//             sameDay: hasSameDay,
//             orderId,
//             payment: paymentData,
//             deliveryPin
//           }
//         ],
//         { session }
//       )

//       const orderDoc = order[0]

//       // 🎟️ 12. Handle coupon usage
//       if (couponCode) {
//         const coupon = await Coupon.findOne({ code: couponCode }).session(
//           session
//         )
//         if (coupon) {
//           coupon.uses += 1
//           coupon.redemptions.push({
//             userPhone: user.phone,
//             orderId: orderDoc._id,
//             redeemedAt: DateTime.now().setZone('Africa/Lagos').toJSDate()
//           })
//           await coupon.save({ session })
//         }
//       }

//       // 🔁 13. Update subscription usage
//       if (usage) {
//         usage.items_used =
//           (usage.items_used || 0) +
//           payload.items.reduce((s, i) => s + (i.quantity || 1), 0)
//         await usage.save({ session })
//       }

//       // ✅ 14. Commit transaction BEFORE hitting Paystack
//       await session.commitTransaction()
//       session.endSession()

//       // 💳 15. Initialize Paystack payment (outside transaction)
//       let paymentInitResponse = null

//       if (['CARD', 'BANK_TRANSFER'].includes(paymentInput.method)) {
//         if (paymentInput.gateway === 'PAYSTACK') {
//           paymentInitResponse = await initPaystackPayment({
//             amount: totals.grandTotal,
//             email: user.email,
//             name: payload.userName || user.fullName || 'Customer',
//             phone: user.phone,
//             orderId
//           })

//           paymentData.transactionId = paymentInitResponse?.reference || null
//           paymentData.checkoutUrl =
//             paymentInitResponse?.authorization_url || null
//         } else if (paymentInput.gateway === 'MONNIFY') {
//           paymentInitResponse = await initMonnifyPayment({
//             amount: totals.grandTotal,
//             customerName: payload.userName || user.fullName || 'Customer',
//             customerEmail: user.email,
//             customerPhone: user.phone,
//             orderId,
//             paymentMethod:
//               paymentInput.method === 'CARD' ? 'CARD' : 'ACCOUNT_TRANSFER'
//           })

//           paymentData.transactionId =
//             paymentInitResponse?.reference ||
//             paymentInitResponse?.transactionReference ||
//             null
//           paymentData.checkoutUrl =
//             paymentInitResponse?.checkoutUrl ||
//             paymentInitResponse?.authorization_url ||
//             null
//         }

//         // persist both at once
//         await Order.findByIdAndUpdate(orderDoc._id, { payment: paymentData })
//       }

//       // 🔔 16. Send notifications (non-blocking)
//       notifyOrderEvent({
//         user,
//         order: orderDoc,
//         type: 'orderCreated',
//         meta: { deliveryPin }
//       }).catch(err => console.warn('User notification failed:', err.message))

//       const admins = await User.find({ role: 'admin' })
//       await Promise.all(
//         admins.map(admin =>
//           notifyOrderEvent({
//             user: admin,
//             order: orderDoc,
//             type: 'orderCreatedForAdmin',
//             meta: { deliveryPin }
//           })
//         )
//       ).catch(err => console.warn('Admin notifications failed:', err.message))

//       // ✅ 17. Return success response
//       return res.status(201).json({
//         order: orderDoc,
//         paymentInitResponse,
//         ...(tierOverrideMessage && { message: tierOverrideMessage })
//       })
//     } catch (err) {
//       await session.abortTransaction()
//       session.endSession()

//       if (
//         err.hasErrorLabel &&
//         err.hasErrorLabel('TransientTransactionError') &&
//         attempt < MAX_RETRIES - 1
//       ) {
//         attempt++
//         console.warn(
//           `TransientTransactionError, retrying attempt ${attempt + 1}...`
//         )
//         continue
//       }

//       console.error('❌ Create order failed:', err)
//       return next(err)
//     }
//   }
// }
