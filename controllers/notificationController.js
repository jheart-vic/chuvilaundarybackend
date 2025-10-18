import Notification from '../models/Notification.js';

export async function listNotifications(req, res, next) {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification)
      return res.status(404).json({ success: false, message: 'Notification not found' });

    res.json({ success: true, notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await Notification.updateMany({ user: req.user.id }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function listAllNotifications(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build dynamic filter
    const filter = {};

    // Example filters
    if (req.query.read === "true") filter.read = true;
    if (req.query.read === "false") filter.read = false;
    if (req.query.type) filter.type = req.query.type;

    // Optional date range filter
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate("user", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
      filters: filter,
      notifications,
    });
  } catch (err) {
    next(err);
  }
}
