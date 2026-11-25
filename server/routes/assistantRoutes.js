const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { getPlan } = require('../middleware/planMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
const controller = require('../controllers/assistantController');
const chatbotController = require('../controllers/chatbotController');

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Demasiadas consultas al asistente en poco tiempo. Por favor espera un momento.'
});

router.post('/chat', requireAuth, requireAdmin, aiLimiter, async (req, res, next) => { try { req.plan = await getPlan(req); next(); } catch (error) { next(error); } }, controller.chat);
router.get('/conversations', requireAuth, chatbotController.listConversations);
router.get('/conversations/:id', requireAuth, chatbotController.getConversation);
router.delete('/conversations/:id', requireAuth, chatbotController.deleteConversation);
router.post('/conversations', requireAuth, chatbotController.createConversation);
router.get('/dictionary', requireAuth, controller.searchDictionary);
router.get('/dictionary/:term', requireAuth, controller.getDictionaryTerm);

module.exports = router;