import { Router } from 'express';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { reviewSchema } from '../utils/validator.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { createReview, listUserReviews } from '../controllers/reviewsController.js';

const router = Router();

// ✅ Require auth to create a review
router.post('/', requireAuth, validateBody(reviewSchema), createReview);

router.get('/:orderId/review', requireAuth, listUserReviews)

export default router;
