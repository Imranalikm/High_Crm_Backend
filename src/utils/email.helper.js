const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

/**
 * Send OTP Verification Email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - The 6-digit verification code
 */
async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: `"HighCRM" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'HighCRM - Your OTP Code',
    html: `<p>Your OTP is <b>${otp}</b>. It is valid for 5 minutes.</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] OTP sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${toEmail}:`, error.message);
    console.log(`\n🔑 [DEVELOPMENT FALLBACK] >>> OTP for ${toEmail} is: ${otp} <<<\n`);
    return false;
  }
}

module.exports = {
  sendOtpEmail
};

