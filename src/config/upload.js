const multer = require('multer');
const path = require('path');
const fs = require('fs');

const kycUploadDir = path.join(process.cwd(), 'uploads', 'kyc');
const depositUploadDir = path.join(process.cwd(), 'uploads', 'deposits');
const ticketUploadDir = path.join(process.cwd(), 'uploads', 'tickets');
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}
if (!fs.existsSync(depositUploadDir)) {
  fs.mkdirSync(depositUploadDir, { recursive: true });
}
if (!fs.existsSync(ticketUploadDir)) {
  fs.mkdirSync(ticketUploadDir, { recursive: true });
}

// Storage config for KYC
const kycStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, kycUploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user ? req.user.id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}_${file.fieldname}_${timestamp}${ext}`);
  }
});

// File filter — allow PNG, JPG, JPEG, PDF only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and PDF files are allowed.'), false);
  }
};

// Multer instance for KYC uploads
const kycUpload = multer({
  storage: kycStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Storage config for Deposits
const depositStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, depositUploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user ? req.user.id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `deposit_${userId}_${timestamp}${ext}`);
  }
});

// Multer instance for Deposit uploads
const depositUpload = multer({
  storage: depositStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Storage config for Ticket attachments
const ticketStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, ticketUploadDir);
  },
  filename: function (req, file, cb) {
    const userId = req.user ? req.user.id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ticket_${userId}_${timestamp}${ext}`);
  }
});

// Multer instance for Ticket uploads
const ticketUpload = multer({
  storage: ticketStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

module.exports = {
  kycUpload,
  depositUpload,
  ticketUpload
};
