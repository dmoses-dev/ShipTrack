const express = require('express');
const router = express.Router();
const Courier = require('../models/Courier');
const Shipment = require('../models/Shipment');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    const couriers = await Courier.find(filter).sort('name');
    res.json({ success: true, data: couriers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const courier = await Courier.create(req.body);
    res.status(201).json({ success: true, data: courier });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/:id', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const courier = await Courier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!courier) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: courier });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    await Courier.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Courier's active shipments
router.get('/:id/shipments', requireAuth, async (req, res) => {
  try {
    const shipments = await Shipment.find({
      courier: req.params.id,
      status: { $nin: ['Delivered', 'Failed', 'Returned'] }
    }).sort('-createdAt');
    res.json({ success: true, data: shipments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
