const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getPlan } = require('../middleware/planMiddleware');
const controller = require('../controllers/chatbotController');

// SB-12: Endpoints de Chatbot y Consulta / Eliminación de Historial
router.post('/message', requireAuth, async (req, res, next) => {
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
