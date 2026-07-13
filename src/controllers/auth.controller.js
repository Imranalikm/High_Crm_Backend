const { User, Role, RolePermission, Module, Kyc, AppNotification } = require('../models');
const { getIo } = require('../config/socket');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.helper');
const { sendOtpEmail, sendVerificationSuccessEmail, sendPasswordResetEmail } = require('../utils/email.helper');
const bcrypt = require('bcryptjs');

/**
 * Register a new user
 */


async function register(req, res, next) {
  try {
    const { name, email, password, country, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password || !country || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, country, and phone are required.'
      });
    }

    // Validate country against known list
    const VALID_COUNTRIES = require('../utils/countries.constant');
    if (!VALID_COUNTRIES.includes(country)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country selected.'
      });
    }

    // Validate phone format (E.164: starts with + followed by 7-15 digits)
    if (!/^\+\d{7,15}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must include country code (e.g., +919876543210).'
      });
    }

    // Default registered users to 'User' role (user panel, not admin)
    const userRole = await Role.findOne({ where: { key: 'user' } });
    const roleId = userRole ? userRole.id : null;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.status === 'active') {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.'
        });
      }
      if (existingUser.status === 'blocked') {
        return res.status(403).json({
          success: false,
          message: 'This account has been blocked. Please contact support.'
        });
      }

      // If pending, allow updating registration details and sending a fresh OTP
      await existingUser.update({
        name,
        password, // hook hashes this in beforeUpdate
        country,
        phone,
        roleId,
      });

      // Generate and send new OTP for email verification
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const salt = await bcrypt.genSalt(10);
      const hashedOtp = await bcrypt.hash(otpCode, salt);
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await existingUser.update({
        otp: hashedOtp,
        otpExpiresAt,
        lastOtpSentAt: new Date()
      });

      // Send OTP email (non-blocking)
      sendOtpEmail(existingUser.email, otpCode).catch(err => {
        console.error(`[Register] Failed to send OTP email to ${existingUser.email}:`, err.message);
      });

      // Update existing Kyc draft or create new one
      const existingKyc = await Kyc.findOne({ where: { userId: existingUser.id } });
      if (existingKyc) {
        await existingKyc.update({
          fullName: name,
          phone,
          country,
          updatedBy: existingUser.id
        });
      } else {
        await Kyc.create({
          userId: existingUser.id,
          fullName: name,
          email,
          phone,
          country,
          status: 'draft',
          createdBy: existingUser.id,
          updatedBy: existingUser.id
        });
      }

      // Fetch user with role info
      const userWithRole = await User.findByPk(existingUser.id, {
        include: [{ model: Role, as: 'role' }]
      });

      const accessToken = generateAccessToken(userWithRole);
      const refreshToken = generateRefreshToken(userWithRole);

      return res.status(201).json({
        success: true,
        message: 'Registration successful. A new OTP has been sent to your email for verification.',
        data: {
          accessToken,
          refreshToken,
          user: {
            id: userWithRole.id,
            name: userWithRole.name,
            email: userWithRole.email,
            status: userWithRole.status,
            role: userWithRole.role ? { name: userWithRole.role.name, key: userWithRole.role.key, type: userWithRole.role.type } : null
          }
        }
      });
    }

    // Create user if not exists. Status defaults to 'pending'
    const user = await User.create({
      name,
      email,
      password,
      country,
      phone,
      roleId,
      status: 'pending'
    });
          
    // Self audit update (User ID is now integer)
    await user.update({
      createdBy: user.id,
      updatedBy: user.id
    });

    // Generate and send OTP for email verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, salt);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await user.update({
      otp: hashedOtp,
      otpExpiresAt,
      lastOtpSentAt: new Date()
    });

    // Send OTP email (non-blocking — don't fail registration if email fails)
    sendOtpEmail(user.email, otpCode).catch(err => {
      console.error(`[Register] Failed to send OTP email to ${user.email}:`, err.message);
    });

    // Create blank KYC draft pre-filled with registration data
    await Kyc.create({
      userId: user.id,
      fullName: name,
      email,
      phone,
      country,
      status: 'draft',
      createdBy: user.id,
      updatedBy: user.id
    });

    // Fetch user with role info
    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'role' }]
    });

    const accessToken = generateAccessToken(userWithRole);
    const refreshToken = generateRefreshToken(userWithRole);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. OTP has been sent to your email for verification.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userWithRole.id,
          name: userWithRole.name,
          email: userWithRole.email,
          status: userWithRole.status,
          role: userWithRole.role ? { name: userWithRole.role.name, key: userWithRole.role.key, type: userWithRole.role.type } : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user via traditional email & password
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Find user by email
    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check account status. Must be active for traditional login
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Please verify your account via OTP or contact support.`
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          role: user.role ? { name: user.role.name, key: user.role.key, type: user.role.type } : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send OTP verification code to Email
 */
async function sendOTP(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.'
      });
    }

    // Generate 6-digit code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, salt);

    // Save to database with 5 minute expiration
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    await user.update({
      otp: hashedOtp,
      otpExpiresAt,
      lastOtpSentAt: new Date()
    });

    // Send email using SMTP helper
    await sendOtpEmail(user.email, otpCode);

    return res.status(200).json({
      success: true,
      message: 'Verification OTP has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify OTP code and sign-in
 */
async function verifyOTP(req, res, next) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required.'
      });
    }

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked.'
      });
    }

    // Verify OTP exists and has not expired
    if (!user.otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Verification OTP code has expired or is invalid. Please request a new one.'
      });
    }

    // Compare OTP
    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP code.'
      });
    }

    // Clean up OTP fields and auto-activate 'pending' users
    const updates = {
      otp: null,
      otpExpiresAt: null
    };

    if (user.status === 'pending') {
      updates.status = 'active';

      // Trigger Notification for admins since the user just verified their OTP for the first time
      try {
        const admins = await User.findAll({
          include: [{
            model: Role,
            as: 'role',
            where: {
              type: 'admin'
            }
          }]
        });

        const notifications = admins.map(admin => ({
          userId: admin.id,
          title: 'New User Registration',
          message: `A new user (${user.name}) has registered successfully.`,
          type: 'registration',
          isRead: false
        }));

        const createdNotifications = await AppNotification.bulkCreate(notifications);

        if (createdNotifications.length > 0) {
          getIo().to('admin_room').emit('new_notification', {
            title: 'New User Registration',
            message: `A new user (${user.name}) has registered successfully.`,
            type: 'registration'
          });
        }
      } catch (notifErr) {
        console.error('[VerifyOTP] Failed to create notifications:', notifErr.message);
      }
    }

    await user.update(updates);

    // Send success email (non-blocking)
    sendVerificationSuccessEmail(user.email, user.name).catch(err => {
      console.error(`[VerifyOTP] Failed to send success email to ${user.email}:`, err.message);
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(200).json({
      success: true,
      message: 'OTP verification successful. Logged in successfully.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status === 'pending' ? 'active' : user.status,
          role: user.role ? { name: user.role.name, key: user.role.key, type: user.role.type } : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.'
      });
    }

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, as: 'role' }]
    });

    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Account is suspended, pending, or user not found.'
      });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile with roles and permissions matrix list
 */
async function getMe(req, res, next) {
  try {
    // Fetch user, their role, and the specific RolePermission matrix
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Role,
          as: 'role',
          include: [
            {
              model: RolePermission,
              as: 'permissions',
              include: [{ model: Module, as: 'module' }]
            }
          ]
        }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Map permissions matrix into a clean client structure grouped by module
    const permissionsMatrix = {};
    
    if (user.role) {
      if (user.role.type === 'user') {
        // User-type roles get access to all user-facing modules
        const userModules = ['dashboard', 'trading', 'copy_trading', 'prop_trading', 'finance', 'ib_system', 'support_desk', 'reports'];
        userModules.forEach(mod => {
          permissionsMatrix[mod] = ['view'];
        });
      } else if (user.role.key === 'super_admin') {
        // Super admin has all modules and actions
        const allModules = await Module.findAll();
        const allActions = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'assign'];
        
        allModules.forEach(mod => {
          permissionsMatrix[mod.key] = allActions;
        });
      } else if (user.role.permissions) {
        user.role.permissions.forEach(rp => {
          if (rp.module) {
            if (!permissionsMatrix[rp.module.key]) {
              permissionsMatrix[rp.module.key] = [];
            }
            permissionsMatrix[rp.module.key].push(rp.action);
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          country: user.country,
          phone: user.phone,
          status: user.status,
          wallet_balance: user.wallet_balance,
          lb_name: user.lb_name,
          isIB: user.isIB,
          role: user.role ? {
            id: user.role.id,
            name: user.role.name,
            key: user.role.key,
            type: user.role.type,
            scope: user.role.scope,
            status: user.role.status
          } : null,
          permissions: permissionsMatrix
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Forgot Password - Send OTP
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Your account is blocked. Please contact support.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, salt);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await user.update({
      otp: hashedOtp,
      otpExpiresAt,
      lastOtpSentAt: new Date()
    });

    await sendPasswordResetEmail(user.email, otpCode);

    return res.status(200).json({
      success: true,
      message: 'Password reset code has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset Password - Verify OTP and update password
 */
async function resetPassword(req, res, next) {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    if (!user.otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'Reset code has expired or is invalid.' });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid reset code.' });
    }

    // Set new password, hook will hash it automatically
    user.password = newPassword;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. Please log in.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP,
  refresh,
  getMe,
  forgotPassword,
  resetPassword
};
