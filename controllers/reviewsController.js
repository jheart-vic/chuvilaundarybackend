import Review from '../models/Review.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

// User creates a review for an order
export async function createReview(req, res, next) {
  try {

    const { rating, comment, orderId } = req.body;

    console.log('🔍 Debug orderId received:', orderId);

    // 2️⃣ Find order by custom orderId
    const foundOrder = await Order.findOne({ orderId: orderId.trim() });
    if (!foundOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // 3️⃣ Check user ownership
    if (!foundOrder.user.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to review this order'
      });
    }

    // 4️⃣ Ensure order is delivered
    if (foundOrder.status.toLowerCase() !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only review delivered orders'
      });
    }

    // 5️⃣ Check if a review exists for this order/user
    let review = await Review.findOne({ user: req.user._id, order: foundOrder._id });

    if (review) {
      // Update existing review
      review.rating = rating;
      review.comment = comment;
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        user: req.user._id,
        order: foundOrder._id,
        rating,
        comment
      });
    }

    // 6️⃣ Recalculate order's average rating and review count
    const reviews = await Review.find({ order: foundOrder._id });
    const reviewCount = reviews.length;
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;

    foundOrder.reviewCount = reviewCount;
    foundOrder.rating = Math.round(avgRating * 10) / 10; // round to 1 decimal
    await foundOrder.save();

    // 7️⃣ Respond
    res.status(201).json({
      success: true,
      message: review ? 'Review submitted/updated successfully' : 'Review submitted successfully',
      review,
      orderRating: foundOrder.rating,
      orderReviewCount: foundOrder.reviewCount
    });

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
