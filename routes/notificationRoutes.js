import { Router } from 'express';
import { listNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, listNotifications);
router.patch('/:id/read', requireAuth, markAsRead);
router.patch('/read-all', requireAuth, markAllAsRead);

export default router;
