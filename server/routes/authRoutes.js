const router = require('express').Router();
const controller = require('../controllers/authController');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');

// Límite de 10 intentos cada 5 minutos para rutas sensibles de autenticación
const authLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de autenticación. Por seguridad, espera unos minutos antes de reintentar.'
});

router.post('/login', authLimiter, controller.login);
router.post('/logout', controller.logout);
router.get('/me', controller.me);
router.post('/forgot-password', authLimiter, controller.forgotPassword);
router.post('/reset-password', authLimiter, controller.resetPassword);
router.post('/verify-email', controller.verifyEmail);

module.exports = router;
