const { Kyc } = require('../models');

/**
 * Middleware to ensure the authenticated user has an APPROVED KYC verification status.
 * Admin users are allowed to bypass this check.
 */
async function requireKycApproved(req, res, next) {
  try {
    // Bypass if user is an admin
    if (req.user && req.user.role && req.user.role.type === 'admin') {
      return next();
    }

    const kyc = await Kyc.findOne({ where: { userId: req.user.id } });
    
    if (!kyc || kyc.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'KYC identity verification is required to perform this action. Please complete your KYC documents and wait for compliance approval.',
        kycStatus: kyc ? kyc.status : 'not-started'
      });
    }

    next();
  } catch (error) {
    console.error('[KYC Check Middleware] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during KYC validation.'
    });
  }
}

module.exports = requireKycApproved;
