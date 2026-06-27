const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');

let clientStatus = 'initializing'; // 'disconnected', 'initializing', 'qr_ready', 'ready'
let currentQrDataUrl = null;

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth' // Save auth sessions locally in backend folder
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
  },
  puppeteer: {
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});


client.on('qr', async (qr) => {
  clientStatus = 'qr_ready';
  console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP TO ENABLE AUTO MESSAGING ---');
  qrcodeTerminal.generate(qr, { small: true });
  
  try {
    // Generate base64 Data URL of the QR code for frontend UI
    currentQrDataUrl = await QRCode.toDataURL(qr);
  } catch (err) {
    console.error('Failed to generate base64 QR code:', err);
  }
});

client.on('ready', () => {
  clientStatus = 'ready';
  currentQrDataUrl = null;
  console.log('\n=============================================');
  console.log('WhatsApp Client is READY! Auto alerts active.');
  console.log('=============================================\n');
});

client.on('authenticated', () => {
  console.log('WhatsApp Client authenticated successfully.');
});

client.on('auth_failure', (msg) => {
  clientStatus = 'disconnected';
  console.error('WhatsApp Auth failure:', msg);
});

client.on('disconnected', (reason) => {
  clientStatus = 'disconnected';
  currentQrDataUrl = null;
  console.log('WhatsApp Client was disconnected:', reason);
});

// Initialize connection
client.initialize().catch(err => {
  console.error('Failed to initialize WhatsApp Web client:', err);
  clientStatus = 'disconnected';
});

// Helper function to send messages
async function sendWhatsAppMessage(number, message) {
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not ready. Status: ' + clientStatus);
  }

  // Clean phone number (keep digits only)
  let cleanNumber = number.replace(/\D/g, '');
  
  // Format matching WhatsApp structure (e.g. 919876543210@c.us)
  if (!cleanNumber.endsWith('@c.us')) {
    cleanNumber = `${cleanNumber}@c.us`;
  }

  try {
    const response = await client.sendMessage(cleanNumber, message);
    console.log(`Automated message sent to ${cleanNumber} successfully:`, message);
    return response;
  } catch (err) {
    console.error(`Failed to send automated WhatsApp message to ${cleanNumber}:`, err.message);
    throw err;
  }
}

function getWhatsAppStatus() {
  return {
    status: clientStatus,
    qr: currentQrDataUrl
  };
}

module.exports = {
  sendWhatsAppMessage,
  getWhatsAppStatus,
  client
};
