const express = require('express');
const router = express.Router();
const controller = require('../controllers/billingController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(controller.webhook));
router.use(express.json());
router.post('/checkout', requireAuth, requireAdmin, asyncHandler(controller.checkout));
router.get('/status', requireAuth, asyncHandler(controller.status));

module.exports = router;