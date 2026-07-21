import ErrorResponse from '../utils/errorResponse.js';
import AsyncHandler from '../middleware/async.js';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import User from '../models/User.js';

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
export const register = AsyncHandler(async (req, res, next) => {
    const { firstName, lastName, country, email, password, emailUpdates } = req.body;

    // Check for required fields
    if (!firstName || !lastName || !email || !password || !country) {
        return next(
            new ErrorResponse('Please provide all required fields', 400)
        );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(
            new ErrorResponse('Email already exists', 400)
        );
    }

    // Create user
    const user = await User.create({
        firstName,
        lastName,
        country,
        email,
        password,
        emailUpdates,
    });

    sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = AsyncHandler(async (req, res, next) => {
    const email = req.body.email.trim();
    const password = req.body.password.trim();

    // Validate email and password
    if (!email || !password) {
        return next(
            new ErrorResponse('Please provide and email and password', 400)
        );
    }

    // Check for user
    const user = await User.findOne({ email }).select('+isValid +password');

    if (!user) {
        return next(new ErrorResponse('Invalid credentials.', 401));
    }

    // Check is password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid credentials.', 401));
    }

    // Check user has validated their email
    if (!user.isValid) {
        return next(new ErrorResponse('Your email is still pending validation. Please refer to the email that was sent to you.', 403))
    }

    sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   POST /api/v1/auth/me
// @access  Private
export const getMe = AsyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        data: user,
    });
});

// @desc    Update user
// @route   POST /api/v1/auth/userupdate
// @access  Private
export const updateUser = AsyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id)

    if (!user) {
        return next(
            new ErrorResponse(`There is no user with email: ${req.body.email}`, 500)
        );
    }

    const { firstName, lastName, email } = req.body

    // update names immediately
    if (firstName) user.firstName = firstName
    if (lastName) user.lastName = lastName

    await user.save();

});

// @desc    Update password
// @route   POST /api/v1/auth/passwordupdate
// @access  Private
export const updatePassword = AsyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
        return next(new ErrorResponse('Password is incorrect', 401));
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
export const forgotPassword = AsyncHandler(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(
            new ErrorResponse(`There is no user with email: ${req.body.email}`, 500)
        );
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset url
    const resetUrl = `${req.protocol}://${req.get(
        'host'
    )}/api/v1/auth/resetpassword/${resetToken}`;

    // Create message
    const message = `You are recieving this email because you (or someone else) has
    request the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password reset token',
            message: message,
        });

        res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
        user.getResetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return next(new ErrorResponse('Email could not be sent', 500));
    }
});

// @desc    Forgot reset  password
// @route   POST /api/v1/auth/resetpassword/:resettoken
// @access  Public
export const resetPassword = AsyncHandler(async (req, res, next) => {
    // Get hashed token
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
    });

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    sendTokenResponse(user, 200, res);
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();
    const options = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
    };

    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        token,
    });
};


export default { register, login, getMe, updatePassword, forgotPassword, resetPassword }