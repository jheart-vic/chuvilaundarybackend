import Review from '../models/Review.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

// User creates a review for an order
export async function createReview(req, res, next) {
  try {
    const { rating, comment, order } = req.validated;

    // 1. Validate order
    const foundOrder = await Order.findById(order);
    if (!foundOrder) return res.status(404).json({ success: false, message: 'Order not found' });

    // 2. Ensure the review belongs to the user
    if (String(foundOrder.user) !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
    }

    // 3. Only delivered orders can be reviewed
    if (foundOrder.status !== 'Delivered') {
      return res.status(400).json({ success: false, message: 'You can only review delivered orders' });
    }

    // 4. Prevent duplicate review
    const existing = await Review.findOne({ user: req.user._id, order });
    if (existing) return res.status(400).json({ success: false, message: 'Order already reviewed' });

    // 5. Create review
    const review = await Review.create({
      user: req.user._id,
      order,
      rating,
      comment
    });

    // 6. Incrementally update order's rating and review count
    foundOrder.reviewCount = (foundOrder.reviewCount || 0) + 1;
    foundOrder.rating = ((foundOrder.rating || 0) * (foundOrder.reviewCount - 1) + rating) / foundOrder.reviewCount;
    await foundOrder.save();

    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

//Admin or user can list reviews for an order
export async function listReviews(req, res, next) {
  try {
    const reviews = await Review.find({ order: req.query.orderId })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
}

// Admin-only delete review
export async function deleteReview(req, res, next) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    // Optionally update order rating after deletion
    if (review.order) {
      const order = await Order.findById(review.order);
      if (order) {
        const remaining = await Review.find({ order: order._id });
        order.reviewCount = remaining.length;
        order.rating = remaining.length
          ? remaining.reduce((sum, r) => sum + r.rating, 0) / remaining.length
          : 0;
        await order.save();
      }
    }

    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /api/reviews/summary
export async function reviewSummary(req, res, next) {
  try {
    const orderId = req.query.orderId;
    const match = orderId ? { order: mongoose.Types.ObjectId(orderId) } : {};

    const summary = await Review.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$order',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (!summary.length) return res.json({ success: true, averageRating: 0, totalReviews: 0 });

    const { averageRating, totalReviews } = summary[0];
    res.json({ success: true, averageRating: Number(averageRating.toFixed(1)), totalReviews });
  } catch (err) {
    next(err);
  }
}
