const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Shipment = require('../models/Shipment');
const Payment = require('../models/Payment');
const { initializePayment, verifyPayment } = require('../services/paystack');
const { notifyPaymentConfirmed } = require('../services/notifications');

// POST /payments/initiate  — called from tracking page or admin
router.post('/initiate', async (req, res) => {
  try {
    const { trackingNumber, email } = req.body;
    const shipment = await Shipment.findOne({ trackingNumber });
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    if (shipment.paymentStatus === 'Paid') return res.status(400).json({ success: false, message: 'Already paid' });

    const reference = `SHT-${uuidv4().replace(/-/g,'').slice(0,12).toUpperCase()}`;
    const payEmail = email || shipment.recipient.email || shipment.sender.email;
    if (!payEmail) return res.status(400).json({ success: false, message: 'Email required for payment' });

    const callbackUrl = `${process.env.APP_URL || 'http://localhost:3000'}/payments/verify?ref=${reference}`;

    const data = await initializePayment({
      email: payEmail,
      amount: shipment.deliveryFee,
      reference,
      metadata: { trackingNumber, shipmentId: shipment._id.toString() },
      callbackUrl,
    });

    // Save pending payment
    await Payment.create({ shipment: shipment._id, amount: shipment.deliveryFee * 100, reference, status: 'pending' });

    res.json({ success: true, data: { authorizationUrl: data.authorization_url, reference } });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

// GET /payments/verify  — Paystack redirects here after payment
router.get('/verify', async (req, res) => {
  try {
    const { ref } = req.query;
    const paystackData = await verifyPayment(ref);

    const payment = await Payment.findOne({ reference: ref });
    if (!payment) return res.redirect('/track?error=payment_not_found');

    if (paystackData.status === 'success') {
      payment.status = 'success';
      payment.channel = paystackData.channel;
      payment.paidAt = new Date(paystackData.paid_at);
      payment.metadata = paystackData;
      await payment.save();

      const shipment = await Shipment.findByIdAndUpdate(payment.shipment, {
        paymentStatus: 'Paid',
        paymentRef: ref,
        paymentMethod: 'Paystack',
      }, { new: true });

      if (shipment) notifyPaymentConfirmed(shipment).catch(console.error);

      res.redirect(`/track?q=${shipment?.trackingNumber}&paid=1`);
    } else {
      payment.status = 'failed';
      await payment.save();
      res.redirect('/track?error=payment_failed');
    }
  } catch (err) {
    console.error(err.message);
    res.redirect('/track?error=verification_failed');
  }
});

module.exports = router;
