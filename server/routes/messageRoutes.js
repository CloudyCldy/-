const router = require('express').Router();
const controller = require('../controllers/messageController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);

// Conversaciones y listados
router.get('/conversations', controller.listConversations);
router.get('/', controller.list);
router.get('/search', controller.search);
router.get('/pinned', controller.getPinnedMessages);
router.get('/files', controller.getSharedFiles);
router.put('/preferences', controller.updatePreferences);

// Envío de mensajes directos
router.post('/', upload.single('file'), controller.create);

// Grupos
router.get('/groups', controller.listGroups);
router.post('/groups', controller.createGroup);
router.get('/groups/:groupId', controller.getGroup);
router.put('/groups/:groupId', controller.updateGroup);
router.post('/groups/:groupId/members', controller.addGroupMember);
router.delete('/groups/:groupId/members/:userId', controller.removeGroupMember);
router.put('/groups/:groupId/members/:userId', controller.updateGroupMemberRole);
router.post('/groups/:groupId/messages', upload.single('file'), controller.sendGroupMessage);

// Acciones sobre mensajes individuales
router.put('/:id', controller.editMessage);
router.delete('/:id', controller.deleteMessage);
router.post('/:id/reactions', controller.toggleReaction);
router.post('/:id/pin', controller.togglePin);

// Eliminar / vaciar historial de conversación
router.delete('/conversation/:userId', controller.removeConversation);

module.exports = router;
