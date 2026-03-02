const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// In-memory OTP storage
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const otp = generateOTP();
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(email, { otp, expiry });

    // Send email using Gmail SMTP
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'PanCred Protocol - Your Verification OTP',
        text: `Your 6-digit verification code is: ${otp}. This code will expire in 5 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const record = otpStore.get(email);

    if (!record) {
        return res.json({ verified: false, message: 'No OTP found for this email' });
    }

    if (Date.now() > record.expiry) {
        otpStore.delete(email);
        return res.json({ verified: false, message: 'OTP has expired' });
    }

    if (record.otp === otp) {
        otpStore.delete(email); // One-time use
        return res.json({ verified: true, message: 'OTP verified successfully' });
    } else {
        return res.json({ verified: false, message: 'Invalid OTP' });
    }
});

module.exports = router;
