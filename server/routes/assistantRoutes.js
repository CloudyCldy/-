const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { getPlan } = require('../middleware/planMiddleware');
const controller = require('../controllers/assistantController');

router.post('/chat', requireAuth, requireAdmin, async (req, res, next) => { try { req.plan = await getPlan(req); next(); } catch (error) { next(error); } }, controller.chat);

module.exports = router;