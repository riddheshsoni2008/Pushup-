const cron = require('node-cron');
const db = require('./database');
const { sendWhatsAppMessage, getWhatsAppStatus } = require('./whatsapp');

// Helper to get local date string YYYY-MM-DD
function getLocalDateString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

// Check and send WhatsApp reminders
async function checkAndSendReminders() {
  const whatsappState = getWhatsAppStatus();
  if (whatsappState.status !== 'ready') {
    console.log('[Cron] Skipping automatic reminder: WhatsApp client is not connected.');
    return;
  }

  db.get("SELECT * FROM users WHERE username = 'default'", (errUser, user) => {
    if (errUser || !user) {
      console.error('[Cron] Error fetching user settings:', errUser?.message);
      return;
    }

    if (!user.phone_number) {
      console.log('[Cron] Skipping reminder: No phone number configured.');
      return;
    }

    db.get(
      "SELECT SUM(reps) as total_reps FROM logs WHERE date = (DATE('now', 'localtime'))",
      async (errSum, sumRow) => {
        if (errSum) {
          console.error('[Cron] Error calculating reps today:', errSum.message);
          return;
        }

        const repsToday = sumRow.total_reps || 0;
        const target = user.daily_target;

        if (repsToday < target) {
          const remaining = target - repsToday;
          const msg = `Hey! 🏋️‍♂️ FitPosture alert! You have only completed ${repsToday} out of your daily target of ${target} push-ups today. You need ${remaining} more reps to maintain your ${user.streak}-day streak! Get moving! 🔥`;

          try {
            await sendWhatsAppMessage(user.phone_number, msg);
            console.log('[Cron] Automated warning message successfully sent to:', user.phone_number);
          } catch (errSend) {
            console.error('[Cron] Failed to dispatch reminder:', errSend.message);
          }
        } else {
          console.log('[Cron] User completed their daily target. No reminder needed.');
        }
      }
    );
  });
}

// Schedule the cron job to run every day at 9:00 PM (21:00)
// Cron pattern: minute hour day-of-month month day-of-week
cron.schedule('0 21 * * *', () => {
  console.log('[Cron] Running daily 9:00 PM check...');
  checkAndSendReminders();
});

console.log('[Cron] Scheduler initialized to run check daily at 9:00 PM.');

module.exports = {
  checkAndSendReminders
};
