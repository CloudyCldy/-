const router = require('express').Router();
const controller = require('../controllers/authController');

router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', controller.me);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.post('/verify-email', controller.verifyEmail);

module.exports = router;
