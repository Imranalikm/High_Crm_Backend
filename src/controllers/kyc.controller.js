const { Kyc, User } = require('../models');

// ─── USER PANEL ENDPOINTS ───

/**
 * Get current user's KYC data
 */
async function getMyKyc(req, res, next) {
  try {
    let kyc = await Kyc.findOne({ where: { userId: req.user.id } });

    if (!kyc) {
      // Auto-create draft if somehow missing
      kyc = await Kyc.create({
        userId: req.user.id,
        fullName: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        country: req.user.country,
        status: 'draft',
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    }

    return res.status(200).json({
      success: true,
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit full KYC (single POST with all data + files)
 */
async function submitKyc(req, res, next) {
  try {
    let kyc = await Kyc.findOne({ where: { userId: req.user.id } });

    if (!kyc) {
      kyc = await Kyc.create({
        userId: req.user.id,
        status: 'draft',
        createdBy: req.user.id,
        updatedBy: req.user.id
      });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Your KYC is already approved.'
      });
    }

    // Extract fields from request body
    const {
      fullName, dateOfBirth, country, email, phone,
      streetAddress, city, postalCode,
      idDocType, idDocNumber, idExpiryDate, idCountryOfIssue,
      addressDocType, addressDocIssueDate
    } = req.body;

    // Validate only KYC-specific required fields (name, email, phone, country already in draft from registration)
    const missingFields = [];
    if (!dateOfBirth) missingFields.push('dateOfBirth');
    if (!streetAddress) missingFields.push('streetAddress');
    if (!city) missingFields.push('city');
    if (!postalCode) missingFields.push('postalCode');
    if (!idDocType) missingFields.push('idDocType');
    if (!idDocNumber) missingFields.push('idDocNumber');
    if (!idExpiryDate) missingFields.push('idExpiryDate');
    if (!idCountryOfIssue) missingFields.push('idCountryOfIssue');
    if (!addressDocType) missingFields.push('addressDocType');
    if (!addressDocIssueDate) missingFields.push('addressDocIssueDate');

    // Validate required files
    if (!req.files || !req.files.idFrontImage) missingFields.push('idFrontImage');
    if (!req.files || !req.files.selfieImage) missingFields.push('selfieImage');
    if (!req.files || !req.files.addressDocImage) missingFields.push('addressDocImage');

    // Back image required for national_id and driving_license
    if (idDocType && idDocType !== 'passport') {
      if (!req.files || !req.files.idBackImage) missingFields.push('idBackImage');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields.',
        missingFields
      });
    }

    // Validate address proof issue date (must be within 90 days)
    if (addressDocIssueDate) {
      const issueDate = new Date(addressDocIssueDate);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      if (issueDate < ninetyDaysAgo) {
        return res.status(400).json({
          success: false,
          message: 'Address proof document must be dated within the last 90 days.'
        });
      }
    }

    // Build file paths
    const filePaths = {};
    if (req.files.idFrontImage) filePaths.idFrontImage = `/uploads/kyc/${req.files.idFrontImage[0].filename}`;
    if (req.files.idBackImage) filePaths.idBackImage = `/uploads/kyc/${req.files.idBackImage[0].filename}`;
    if (req.files.selfieImage) filePaths.selfieImage = `/uploads/kyc/${req.files.selfieImage[0].filename}`;
    if (req.files.addressDocImage) filePaths.addressDocImage = `/uploads/kyc/${req.files.addressDocImage[0].filename}`;

    // Update KYC record — use new values if provided, otherwise keep draft values
    await kyc.update({
      fullName: fullName || kyc.fullName,
      dateOfBirth,
      country: country || kyc.country,
      email: email || kyc.email,
      phone: phone || kyc.phone,
      streetAddress,
      city,
      postalCode,
      idDocType,
      idFrontImage: filePaths.idFrontImage || kyc.idFrontImage,
      idBackImage: filePaths.idBackImage || kyc.idBackImage,
      idDocNumber,
      idExpiryDate,
      idCountryOfIssue,
      selfieImage: filePaths.selfieImage || kyc.selfieImage,
      addressDocType,
      addressDocImage: filePaths.addressDocImage || kyc.addressDocImage,
      addressDocIssueDate,
      status: 'pending',
      rejectionReason: null,
      updatedBy: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: 'KYC submitted successfully. It is now under review.',
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
}

// ─── ADMIN ENDPOINTS ───

/**
 * List all KYC submissions (admin)
 */
async function listKyc(req, res, next) {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const kycList = await Kyc.findAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: kycList
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific KYC details (admin)
 */
async function getKycById(req, res, next) {
  try {
    const kyc = await Kyc.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'phone', 'status']
      }]
    });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve KYC (admin)
 */
async function approveKyc(req, res, next) {
  try {
    const kyc = await Kyc.findByPk(req.params.id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found.'
      });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'KYC is already approved.'
      });
    }

    await kyc.update({
      status: 'approved',
      rejectionReason: null,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      updatedBy: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: 'KYC approved successfully.',
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject KYC (admin)
 */
async function rejectKyc(req, res, next) {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required.'
      });
    }

    const kyc = await Kyc.findByPk(req.params.id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found.'
      });
    }

    await kyc.update({
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      updatedBy: req.user.id
    });

    return res.status(200).json({
      success: true,
      message: 'KYC rejected.',
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyKyc,
  submitKyc,
  listKyc,
  getKycById,
  approveKyc,
  rejectKyc
};
