const nodemailer = require('nodemailer');

async function sendNotification(data) {
  const message = `🎉 New Registration Submitted!\n\nName: ${data.full_name}\nPassport: ${data.passport_number}\nEmail: ${data.email}\nRef ID: ${data.registrationId}`;
  
  // 1. Webhook Notification (Slack/Discord/Teams)
  if (process.env.WEBHOOK_URL) {
    try {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message, text: message }) // 'content' for Discord, 'text' for Slack
      });
      console.log('✅ Webhook notification sent');
    } catch (err) {
      console.error('⚠️ Failed to send webhook:', err.message);
    }
  }

  // 2. Email Notification (Nodemailer)
  if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.NOTIFICATION_EMAIL) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4, // Force IPv4 to fix ENETUNREACH issues
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await transporter.sendMail({
        from: `"Registration Portal" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `New Registration: ${data.full_name || 'Traveler'}`,
        text: message,
      });
      console.log('✅ Email notification sent');
    } catch (err) {
      console.error('⚠️ Failed to send email:', err.message);
    }
  }
}

module.exports = { sendNotification };
