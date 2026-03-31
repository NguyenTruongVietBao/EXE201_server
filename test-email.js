require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('--- Email Configuration ---');
  console.log('Service:', process.env.EMAIL_SERVICE);
  console.log('Username:', process.env.EMAIL_USERNAME);
  console.log('From:', process.env.EMAIL_FROM);
  console.log('--- Starting Connection Test ---');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  try {
    // 1. Verify connection
    await transporter.verify();
    console.log('✅ Connection verification successful!');

    // 2. Try sending a test email
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Test App'}" <${process.env.EMAIL_USERNAME}>`,
      to: process.env.EMAIL_USERNAME, // Send to self
      subject: 'Nodemailer Test Email',
      text: 'If you are reading this, Nodemailer is working correctly.',
      html: '<b>If you are reading this, Nodemailer is working correctly.</b>',
    });

    console.log('✅ Message sent: %s', info.messageId);
    console.log('✅ Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('❌ Email test failed:');
    console.error(error);
    
    if (error.code === 'EAUTH') {
      console.log('\n--- Troubleshooting Tip ---');
      console.log('It looks like an authentication error.');
      console.log('1. Make sure 2FA is ON in your Google account.');
      console.log('2. Make sure you are using an "App Password" (16 characters), NOT your regular account password.');
    }
  }
}

testEmail();
