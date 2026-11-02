const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/chatbotController');

// SB-12: Endpoints de Chatbot y Consulta / Eliminación de Historial
router.post('/message', requireAuth, controller.sendMessage);
router.get('/conversations', requireAuth, controller.listConversations);
router.get('/conversations/:id', requireAuth, controller.getConversation);
router.delete('/conversations/:id', requireAuth, controller.deleteConversation);
router.post('/conversations', requireAuth, controller.createConversation);

module.exports = router;
