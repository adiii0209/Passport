async function sendNotification(data) {
  const message = `🎉 New Registration Submitted!\n\nName: ${data.full_name}\nPassport: ${data.passport_number}\nEmail: ${data.email}\nRef ID: ${data.registrationId}`;
  
  // Webhook Notification (Slack/Discord/Teams)
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
}

module.exports = { sendNotification };
