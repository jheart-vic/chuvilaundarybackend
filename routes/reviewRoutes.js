import { Router } from 'express';
import { validateBody } from '../middlewares/validateMiddleware.js';
import { reviewSchema } from '../utils/validator.js';
import { requireAuth, requireEmployeeOrAdmin } from '../middlewares/authMiddleware.js';
import { listReviews, createReview, reviewSummary } from '../controllers/reviewsController.js';

const router = Router();

// ✅ Allow everyone to read reviews
router.get('/', requireAuth,requireEmployeeOrAdmin, listReviews);
router.get('/summary', requireAuth,requireEmployeeOrAdmin, reviewSummary);

// ✅ Require auth to create a review
router.post('/', requireAuth, validateBody(reviewSchema), createReview);

export default router;
