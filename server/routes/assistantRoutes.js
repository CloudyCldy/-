const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { getPlan } = require('../middleware/planMiddleware');
const controller = require('../controllers/assistantController');
const chatbotController = require('../controllers/chatbotController');

router.post('/chat', requireAuth, requireAdmin, async (req, res, next) => { try { req.plan = await getPlan(req); next(); } catch (error) { next(error); } }, controller.chat);
router.get('/conversations', requireAuth, chatbotController.listConversations);
router.get('/conversations/:id', requireAuth, chatbotController.getConversation);
router.delete('/conversations/:id', requireAuth, chatbotController.deleteConversation);
router.post('/conversations', requireAuth, chatbotController.createConversation);
router.get('/dictionary', requireAuth, controller.searchDictionary);
router.get('/dictionary/:term', requireAuth, controller.getDictionaryTerm);

module.exports = router;