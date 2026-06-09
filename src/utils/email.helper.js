const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525', 10),
  auth: {
    user: process.env.SMTP_USER || 'your_smtp_username',
    pass: process.env.SMTP_PASSWORD || 'your_smtp_password'
  }
});

/**
 * Send OTP Verification Email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - The 6-digit verification code
 */
async function sendOtpEmail(toEmail, otp) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@highcrm.com',
    to: toEmail,
    subject: 'HighCRM - Security Verification OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #3b82f6; text-align: center;">Security Code Verification</h2>
        <p>Hello,</p>
        <p>A sign-in request was made to your HighCRM account. Please use the following One-Time Password (OTP) to authenticate:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 10px 20px; background-color: #f3f4f6; border-radius: 5px; border: 1px dashed #3b82f6; color: #1e3a8a;">
            ${otp}
          </span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This OTP is valid for <strong>5 minutes</strong>. If you did not request this code, please ignore this email or secure your account.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="text-align: center; font-size: 12px; color: #9ca3af;">HighCRM Admin Console. All rights reserved.</p>
      </div>
    `
  };

  try {
    // Verify transporter configuration
    await transporter.verify();
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] OTP email successfully dispatched to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[SMTP Error] Failed to send email to ${toEmail}:`, error.message);
    console.log(`\n🔑 [DEVELOPMENT FALLBACK] >>> OTP for ${toEmail} is: ${otp} <<<\n`);
    return false;
  }
}

module.exports = {
  sendOtpEmail
};
