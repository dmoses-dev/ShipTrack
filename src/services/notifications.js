const axios = require('axios');
const nodemailer = require('nodemailer');

// ─── SMS via Termii ─────────────────────────────────────────────────────────
async function sendSMS(to, message) {
  if (!process.env.TERMII_API_KEY) {
    console.log('[SMS SKIP] No TERMII_API_KEY set. Message:', message);
    return;
  }
  try {
    const phone = to.replace(/\D/g, '').replace(/^0/, '234'); // normalise to 234xxxxxxxxxx
    await axios.post('https://api.ng.termii.com/api/sms/send', {
      to: phone,
      from: process.env.TERMII_SENDER_ID || 'ShipTrack',
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: process.env.TERMII_API_KEY,
    });
    console.log(`[SMS] Sent to ${phone}`);
  } catch (err) {
    console.error('[SMS ERROR]', err.response?.data || err.message);
  }
}

// ─── Email via Nodemailer ────────────────────────────────────────────────────
let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    console.log('[EMAIL SKIP] No SMTP_USER set. Subject:', subject);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'ShipTrack <noreply@shiptrack.com>',
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent "${subject}" to ${to}`);
  } catch (err) {
    console.error('[EMAIL ERROR]', err.message);
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────
const company = () => process.env.COMPANY_NAME || 'ShipTrack Logistics';

function emailBase(content) {
  return `
  <!DOCTYPE html><html><head>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f7f8fa;margin:0;padding:0}
    .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e5ed}
    .header{background:#0f1117;padding:24px 32px;color:#fff}
    .header h2{margin:0;font-size:18px;font-weight:700}
    .header p{margin:4px 0 0;color:rgba(255,255,255,.5);font-size:13px}
    .body{padding:28px 32px}
    .status{display:inline-block;padding:6px 16px;border-radius:100px;font-size:13px;font-weight:600;margin:12px 0}
    .info{background:#f7f8fa;border-radius:8px;padding:16px;margin:16px 0}
    .info-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #e2e5ed}
    .info-row:last-child{border:none}
    .label{color:#5a5f72}
    .val{font-weight:600;color:#0f1117}
    .btn{display:inline-block;background:#1a6ef5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
    .footer{padding:20px 32px;background:#f7f8fa;font-size:12px;color:#9a9eb0;text-align:center;border-top:1px solid #e2e5ed}
  </style></head><body>
  <div class="wrap">
    <div class="header">
      <h2>${company()}</h2>
      <p>Shipment Notification</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">${company()} · ${process.env.COMPANY_ADDRESS || ''}<br/>
    ${process.env.COMPANY_PHONE || ''} · ${process.env.COMPANY_EMAIL || ''}</div>
  </div></body></html>`;
}

// ─── Notification Events ─────────────────────────────────────────────────────

async function notifyShipmentCreated(shipment) {
  const { trackingNumber, recipient, sender, description, deliveryFee } = shipment;

  // SMS to recipient
  await sendSMS(recipient.phone,
    `Hi ${recipient.name}, a package "${description}" is on its way to you from ${sender.name}. Track it with: ${trackingNumber}. - ${company()}`
  );

  // Email to recipient (if provided)
  if (recipient.email) {
    await sendEmail(recipient.email, `Your shipment ${trackingNumber} has been booked`, emailBase(`
      <p>Hi <strong>${recipient.name}</strong>,</p>
      <p>A shipment has been created for you by <strong>${sender.name}</strong>.</p>
      <div class="info">
        <div class="info-row"><span class="label">Tracking Number</span><span class="val">${trackingNumber}</span></div>
        <div class="info-row"><span class="label">Package</span><span class="val">${description}</span></div>
        <div class="info-row"><span class="label">Delivery Fee</span><span class="val">₦${Number(deliveryFee).toLocaleString()}</span></div>
      </div>
      <p>Use your tracking number to follow your shipment in real time.</p>
    `));
  }

  // SMS to sender
  await sendSMS(sender.phone,
    `Your shipment to ${recipient.name} has been booked. Tracking: ${trackingNumber}. - ${company()}`
  );
}

async function notifyStatusUpdate(shipment) {
  const { trackingNumber, recipient, status } = shipment;
  const msg = `Hi ${recipient.name}, your shipment ${trackingNumber} status is now: ${status}. - ${company()}`;
  await sendSMS(recipient.phone, msg);

  if (recipient.email) {
    await sendEmail(recipient.email, `Shipment ${trackingNumber} update: ${status}`, emailBase(`
      <p>Hi <strong>${recipient.name}</strong>,</p>
      <p>Your shipment status has been updated.</p>
      <div class="info">
        <div class="info-row"><span class="label">Tracking</span><span class="val">${trackingNumber}</span></div>
        <div class="info-row"><span class="label">New Status</span><span class="val">${status}</span></div>
      </div>
      <p>${status === 'Out for Delivery' ? '🚚 Your package is on its way — expect delivery today!' : ''}</p>
      <p>${status === 'Delivered' ? '✅ Your package has been delivered. Thank you for using ' + company() + '!' : ''}</p>
    `));
  }
}

async function notifyPaymentConfirmed(shipment) {
  const { trackingNumber, recipient, deliveryFee } = shipment;
  await sendSMS(recipient.phone,
    `Payment of ₦${Number(deliveryFee).toLocaleString()} confirmed for shipment ${trackingNumber}. Thank you! - ${company()}`
  );
}

module.exports = { sendSMS, sendEmail, notifyShipmentCreated, notifyStatusUpdate, notifyPaymentConfirmed };
