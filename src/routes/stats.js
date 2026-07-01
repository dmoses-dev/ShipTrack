// Standalone public stats route (safe totals only — no sensitive data)
const express = require('express');
const router = express.Router();
const Shipment = require('../models/Shipment');

router.get('/', async (req, res) => {
  try {
    const [total, inTransit, outForDelivery, delivered] = await Promise.all([
      Shipment.countDocuments(),
      Shipment.countDocuments({ status: 'In Transit' }),
      Shipment.countDocuments({ status: 'Out for Delivery' }),
      Shipment.countDocuments({ status: 'Delivered' }),
    ]);
    res.json({ success: true, data: { total, inTransit, outForDelivery, delivered } });
  } catch {
    res.json({ success: true, data: { total: 0, inTransit: 0, outForDelivery: 0, delivered: 0 } });
  }
});

module.exports = router;
