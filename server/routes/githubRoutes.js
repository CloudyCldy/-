const router = require('express').Router();
const controller = require('../controllers/githubController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.use(requireAuth); router.get('/repository', controller.repository); router.get('/commits', controller.commits); router.get('/branches', controller.branches); router.get('/pull-requests', controller.pulls); router.get('/activity', controller.activity); router.get('/test', requireAdmin, controller.test); router.post('/configure', requireAdmin, controller.configure);
module.exports = router;