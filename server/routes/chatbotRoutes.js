const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getPlan } = require('../middleware/planMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
const controller = require('../controllers/chatbotController');

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Demasiadas consultas al asistente en poco tiempo. Por favor espera un momento.'
});

// SB-12: Endpoints de Chatbot y Consulta / Eliminación de Historial
router.post('/message', requireAuth, aiLimiter, async (req, res, next) => {
  try {
    req.plan = await getPlan(req);
    next();
  } catch (error) {
    next(error);
  }
}, controller.sendMessage);
router.get('/conversations', requireAuth, controller.listConversations);
router.get('/conversations/:id', requireAuth, controller.getConversation);
router.delete('/conversations/:id', requireAuth, controller.deleteConversation);
router.post('/conversations', requireAuth, controller.createConversation);

module.exports = router;
