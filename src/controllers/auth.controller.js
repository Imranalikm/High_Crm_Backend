const { User, Role, RolePermission, Module } = require('../models');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.helper');
const { sendOtpEmail } = require('../utils/email.helper');
const bcrypt = require('bcryptjs');

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password, country, phone, lb_name, isIB } = req.body;

    // Validate request inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    // Default registered users to 'Read Only' role
    const readOnlyRole = await Role.findOne({ where: { key: 'read_only' } });
    const roleId = readOnlyRole ? readOnlyRole.id : null;

    // Create user. Status defaults to 'pending'
    const user = await User.create({
      name,
      email,
      password,
      country,
      phone,
      lb_name,
      isIB: isIB !== undefined ? isIB : false,
      roleId,
      status: 'pending'
    });

    // Self audit update (User ID is now integer)
    await user.update({
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
      message: 'Registration successful. Account status is pending email/OTP verification.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userWithRole.id,
          name: userWithRole.name,
          email: userWithRole.email,
          status: userWithRole.status,
          role: userWithRole.role ? { name: userWithRole.role.name, key: userWithRole.role.key } : null
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
          role: user.role ? { name: user.role.name, key: user.role.key } : null
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
    }

    await user.update(updates);

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
          role: user.role ? { name: user.role.name, key: user.role.key } : null
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
      if (user.role.key === 'super_admin') {
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

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP,
  refresh,
  getMe
};
