const axios = require('axios');

const base = 'https://api.paystack.co';
const headers = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Initialize a Paystack transaction.
 * amount is in Naira — we convert to kobo.
 */
async function initializePayment({ email, amount, reference, metadata = {}, callbackUrl }) {
  const res = await axios.post(`${base}/transaction/initialize`, {
    email,
    amount: Math.round(amount * 100),  // kobo
    reference,
    metadata,
    callback_url: callbackUrl,
  }, { headers: headers() });
  return res.data.data; // { authorization_url, access_code, reference }
}

/**
 * Verify a Paystack transaction by reference.
 */
async function verifyPayment(reference) {
  const res = await axios.get(`${base}/transaction/verify/${reference}`, { headers: headers() });
  return res.data.data; // { status, amount, channel, paid_at, ... }
}

module.exports = { initializePayment, verifyPayment };
