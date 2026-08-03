import ErrorResponse from '../utils/errorResponse.js';
import AsyncHandler from '../middleware/async.js';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import User from '../models/User.js';
import { createVerificationCode, verifyAndConsumeCode } from '../utils/verificationCode.js';

const sendVerificationEmail = (email, code, subject) =>
    sendEmail({
        email,
        subject,
        message: `Your ActivSwitzerland verification code is ${code}. It expires in 5 minutes.`,
    });

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

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail }).select('+isValid +password');

    if (user && user.isValid) {
        return next(
            new ErrorResponse('Email already exists', 400)
        );
    }

    if (user && !user.isValid) {
        // Previously registered but never verified — update in place and resend a code
        user.firstName = firstName;
        user.lastName = lastName;
        user.country = country;
        user.password = password;
        user.emailUpdates = emailUpdates;
        await user.save();
    } else {
        user = await User.create({
            firstName,
            lastName,
            country,
            email: normalizedEmail,
            password,
            emailUpdates,
        });
    }

    const code = await createVerificationCode('email-verify', normalizedEmail);
    await sendVerificationEmail(normalizedEmail, code, 'Verify your email');

    res.status(201).json({
        success: true,
        data: { email: normalizedEmail, verificationRequired: true },
    });
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = AsyncHandler(async (req, res, next) => {
    const email = req.body.email.trim().toLowerCase();
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

    // Check user has validated their email — one-time verification, not 2FA-on-every-login
    if (!user.isValid) {
        const code = await createVerificationCode('email-verify', email);
        await sendVerificationEmail(email, code, 'Verify your email');

        // Extra fields (verificationRequired/email) can't travel through ErrorResponse/errorHandler
        // (it only ever echoes {success:false, err:message}), so respond directly here.
        return res.status(403).json({
            success: false,
            verificationRequired: true,
            email,
            err: 'Your email is still pending validation. A new code has been sent.',
        });
    }

    sendTokenResponse(user, 200, res);
});

// @desc    Verify email with a 5-digit code, issues JWT on success
// @route   POST /api/v1/auth/verifyEmail
// @access  Public
export const verifyEmail = AsyncHandler(async (req, res, next) => {
    const email = req.body.email?.trim().toLowerCase();
    const code = req.body.code;

    if (!email || !code) {
        return next(new ErrorResponse('Please provide email and code', 400));
    }

    const user = await User.findOne({ email }).select('+isValid');

    if (!user) {
        return next(new ErrorResponse('Invalid credentials.', 401));
    }

    // Idempotent — handles double-submit/back-button on an already-verified account
    if (user.isValid) {
        return sendTokenResponse(user, 200, res);
    }

    await verifyAndConsumeCode('email-verify', email, code);

    user.isValid = true;
    await user.save();

    sendTokenResponse(user, 200, res);
});

// @desc    Resend the register/login verification code
// @route   POST /api/v1/auth/resendVerification
// @access  Public
export const resendVerification = AsyncHandler(async (req, res, next) => {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
        return next(new ErrorResponse('Please provide an email', 400));
    }

    const user = await User.findOne({ email }).select('+isValid');

    if (!user || user.isValid) {
        return next(
            new ErrorResponse(`There is no pending verification for email: ${email}`, 500)
        );
    }

    const code = await createVerificationCode('email-verify', email);
    await sendVerificationEmail(email, code, 'Verify your email');

    res.status(200).json({ success: true, data: 'Code resent' });
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
            new ErrorResponse('User not found', 404)
        );
    }

    const { firstName, lastName, country, emailUpdates, email } = req.body;

    // update fields that don't need verification immediately
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (country !== undefined) user.country = country;
    if (emailUpdates !== undefined) user.emailUpdates = emailUpdates;

    let emailVerificationPending = false;
    let pendingEmail;
    let emailUpdateError;
    const normalizedEmail = email?.trim().toLowerCase();

    if (normalizedEmail && normalizedEmail !== user.email) {
        const taken = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (taken) {
            return next(new ErrorResponse('Email already in use', 400));
        }

        // Don't write user.email yet — only verifyEmailChange does that, once confirmed.
        // A mail-send failure (e.g. bad SMTP creds) shouldn't cost the user the other
        // profile fields they just edited, so it's reported alongside a 200 instead of
        // aborting the whole request.
        try {
            const code = await createVerificationCode('email-change', user.id, { newEmail: normalizedEmail });
            await sendVerificationEmail(normalizedEmail, code, 'Confirm your new email');
            emailVerificationPending = true;
            pendingEmail = normalizedEmail;
        } catch (err) {
            console.error('Failed to send email-change verification email:', err);
            emailUpdateError = 'Could not send the verification email. Please try again shortly.';
        }
    }

    await user.save();

    res.status(200).json({
        success: true,
        data: user,
        emailVerificationPending,
        pendingEmail,
        emailUpdateError,
    });
});

// @desc    Verify a pending email change with a 5-digit code
// @route   POST /api/v1/auth/verifyEmailChange
// @access  Private
export const verifyEmailChange = AsyncHandler(async (req, res, next) => {
    const code = req.body.code;

    if (!code) {
        return next(new ErrorResponse('Please provide a code', 400));
    }

    const { newEmail } = await verifyAndConsumeCode('email-change', req.user.id, code);

    // Race guard — re-check in case the address was claimed since updateUser was called
    const taken = await User.findOne({ email: newEmail, _id: { $ne: req.user.id } });
    if (taken) {
        return next(new ErrorResponse('Email already in use', 400));
    }

    const user = await User.findById(req.user.id);
    user.email = newEmail;
    await user.save();

    res.status(200).json({ success: true, data: user });
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


export default {
    register,
    login,
    verifyEmail,
    resendVerification,
    getMe,
    updateUser,
    verifyEmailChange,
    updatePassword,
    forgotPassword,
    resetPassword,
};
