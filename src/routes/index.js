const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const userRoutes = require('./user.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);

// Root API healthcheck endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HighCRM Backend API is healthy and running.',
    timestamp: new Date()
  });
});

module.exports = router;
