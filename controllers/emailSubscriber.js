// controllers/subscriberController.js
import Subscriber from "../models/Subscriber.js";
import { sendEmail } from "../services/notificationService.js";


export async function subscribe(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Check if already subscribed
    const exists = await Subscriber.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: "Already subscribed" });
    }

    // Save new subscriber
    const subscriber = await Subscriber.create({ email });

    // ✅ Send welcome email
    await sendEmail(
      email,
      "Welcome to our Newsletter 🎉",
      `<h2>Hi there!</h2>
       <p>Thanks for subscribing to our digital marketing updates.
       You’ll now receive the latest insights and tips right in your inbox.</p>
       <p>- ${process.env.APP_NAME} Team</p>`
    );


    return res.status(201).json({
      success: true,
      message: "Subscribed successfully. Welcome email sent!",
      subscriber,
    });
  } catch (err) {
    next(err);
  }
}
