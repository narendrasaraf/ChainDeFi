const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    console.log('Testing with user:', process.env.EMAIL_USER);
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // send to self
        subject: 'Email Test',
        text: 'If you see this, email service is working.'
    };

    try {
        console.log('Sending test email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Email test failed:', error);
    }
}

testEmail();
