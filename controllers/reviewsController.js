import Review from '../models/Review.js';
import Order from '../models/Order.js';

export async function createReview(req, res, next) {
  try {
    const { name, rating, comment, order } = req.validated;

    // ✅ Check order
    if (order) {
      const foundOrder = await Order.findById(order);
      if (!foundOrder) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (String(foundOrder.user) !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to review this order' });
      }
      if (foundOrder.status !== 'Delivered') {
        return res.status(400).json({ success: false, message: 'You can only review delivered orders' });
      }
    }

    const review = await Review.create({
      user: req.user.id,
      name,
      rating,
      comment,
      order
    });

    // ✅ Update order rating if this review is linked to an order
    if (order) {
      await Order.findByIdAndUpdate(order, { rating }, { new: true });
    }

    return res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

export async function listReviews(req, res, next) {
  try {
    const reviews = await Review.find({})
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json({ success: true, reviews });
  } catch (err) {
    next(err);
  }
}

// ✅ Admin-only delete review
export async function deleteReview(req, res, next) {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /api/reviews/summary
export async function reviewSummary(req, res, next) {
  try {
    const summary = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const result = summary.length > 0 ? summary[0] : { averageRating: 0, totalReviews: 0 };

    return res.json({
      success: true,
      averageRating: Number(result.averageRating.toFixed(1)),
      totalReviews: result.totalReviews
    });
  } catch (err) {
    next(err);
  }
}
