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
    const reviews = await Review.find({ order: req.param.orderId })
      .populate('user', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
}

export async function listUserReviews(req, res, next) {
  try {
    const { orderId } = req.params;
    const match = { user: req.user._id };

    if (orderId) {
      // 🔍 Find the order by its custom orderId string (e.g., CHU-ORD-XXXX)
      const order = await Order.findOne({ orderId }).select("_id");
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found for given orderId",
        });
      }
      // ✅ Use the actual MongoDB _id in your query
      match.order = order._id;
    }

    const reviews = await Review.find(match)
      .populate("order", "orderId status totalAmount createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (err) {
    console.error("listUserReviews error:", err);
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
    const { orderId } = req.query

    // Build match filter dynamically
    const match = {}
    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' })
      }
      match.order = new mongoose.Types.ObjectId(orderId)
    }

    // Aggregate reviews
    const summary = await Review.aggregate([
      { $match: match },
      {
        $group: {
          _id: null, // null groups all results if no orderId filter
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ])

    // Handle empty results
    if (!summary.length) {
      return res.json({
        success: true,
        averageRating: 0,
        totalReviews: 0
      })
    }

    const { averageRating, totalReviews } = summary[0]
    res.json({
      success: true,
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews
    })
  } catch (err) {
    console.error('Review summary error:', err)
    next(err)
  }
}