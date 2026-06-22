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

/**
 * Send OTP Verification Success Email
 * @param {string} toEmail - Recipient email
 * @param {string} name - Recipient name
 */
async function sendVerificationSuccessEmail(toEmail, name) {
  const portalUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:5173';
  const mailOptions = {
    from: `"HighCRM" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'HighCRM - Account Verified Successfully!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Verified Successfully</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f4f6f9;
            color: #334155;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f4f6f9;
            padding: 40px 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 32px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .content {
            padding: 40px 32px;
          }
          .success-icon {
            font-size: 48px;
            text-align: center;
            margin-bottom: 24px;
          }
          .content h2 {
            font-size: 20px;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            font-weight: 600;
          }
          .content p {
            font-size: 16px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 24px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0 16px 0;
          }
          .btn {
            display: inline-block;
            background-color: #3b82f6;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            font-weight: 600;
            border-radius: 8px;
            font-size: 16px;
          }
          .footer {
            background-color: #f8fafc;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>HighCRM</h1>
            </div>
            <div class="content">
              <div class="success-icon">🎉</div>
              <h2>Verification Successful!</h2>
              <p>Hello ${name || 'Trader'},</p>
              <p>Your email verification is complete, and your account has been successfully activated. You now have full access to our HighCRM client area and trading features.</p>
              <p>Click the button below to log in and get started on your trading journey.</p>
              <div class="button-container">
                <a href="${portalUrl}" class="btn" target="_blank">Access Client Portal</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} HighCRM. All rights reserved.</p>
              <p>If you did not register for this account, please contact our support team immediately.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification success email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Error] Failed to send verification success email to ${toEmail}:`, error.message);
    return false;
  }
}

/**
 * Send MT5 Trading Account Credentials Email
 * @param {string} toEmail - Recipient email
 * @param {string} name - Recipient name
 * @param {string} login - MT5 Account Login ID
 * @param {string} mPassword - Master Password
 * @param {string} iPassword - Investor Password
 * @param {string} groupName - CRM/MT5 Group Name
 * @param {string} leverage - Leverage
 * @param {string} server - MT5 Server name
 */
async function sendMt5CredentialsEmail(toEmail, name, login, mPassword, iPassword, groupName, leverage, server) {
  const portalUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:5173';
  const mailOptions = {
    from: `"HighCRM" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'HighCRM - Your MT5 Trading Account Credentials',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your MT5 Account Credentials</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f4f6f9;
            color: #334155;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f4f6f9;
            padding: 40px 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
          }
          .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            padding: 32px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .content {
            padding: 40px 32px;
          }
          .content h2 {
            font-size: 20px;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            font-weight: 600;
          }
          .content p {
            font-size: 16px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 24px;
          }
          .cred-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .cred-title {
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .warning-box {
            background-color: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 4px;
            margin-bottom: 24px;
          }
          .warning-box p {
            color: #78350f;
            font-size: 14px;
            line-height: 1.5;
            margin: 0;
          }
          .button-container {
            text-align: center;
            margin: 32px 0 16px 0;
          }
          .btn {
            display: inline-block;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 32px;
            font-weight: 600;
            border-radius: 8px;
            font-size: 16px;
          }
          .footer {
            background-color: #f8fafc;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h1>HighCRM Trading</h1>
            </div>
            <div class="content">
              <h2>Your MT5 Trading Account is Ready!</h2>
              <p>Hello ${name || 'Trader'},</p>
              <p>Your MetaTrader 5 (MT5) trading account has been successfully created. Here are your account credentials and connection details:</p>
              
              <div class="cred-card">
                <div class="cred-title">Account Details</div>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">MT5 Login ID:</td>
                    <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: bold; font-family: monospace; font-size: 16px;">${login}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Master Password:</td>
                    <td style="padding: 8px 0; text-align: right; color: #ef4444; font-weight: bold; font-family: monospace; font-size: 16px;">${mPassword}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Investor Password:</td>
                    <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: bold; font-family: monospace; font-size: 16px;">${iPassword}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Server:</td>
                    <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">Agile</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Account Type (Group):</td>
                    <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${groupName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Leverage:</td>
                    <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${leverage}</td>
                  </tr>
                </table>
              </div>

              <div class="warning-box">
                <p><strong>⚠️ Security Notice:</strong> The Master Password grants complete trading access to your account. Keep these credentials confidential. HighCRM staff will never ask for your passwords.</p>
              </div>

              <p>To start trading, download the MetaTrader 5 platform on your device and connect using the login details and server listed above.</p>
              
              <div class="button-container">
                <a href="${portalUrl}" class="btn" target="_blank">Launch Client Area</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} HighCRM. All rights reserved.</p>
              <p>For assistance, please reply to this email or contact support in your client area.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] MT5 credentials email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Error] Failed to send MT5 credentials email to ${toEmail}:`, error.message);
    return false;
  }
}

module.exports = {
  sendOtpEmail,
  sendVerificationSuccessEmail,
  sendMt5CredentialsEmail
};

