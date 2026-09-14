const router = require('express').Router();
const controller = require('../controllers/messageController');
const upload = require('../middleware/uploadMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', controller.list);
router.get('/groups', controller.listGroups);
router.get('/groups/:groupId', controller.getGroup);
router.post('/', upload.single('file'), controller.create);
router.post('/groups', controller.createGroup);
router.post('/groups/:groupId/members', controller.addGroupMember);
router.post('/groups/:groupId/messages', upload.single('file'), controller.sendGroupMessage);
router.delete('/conversation/:userId', controller.removeConversation);

module.exports = router;