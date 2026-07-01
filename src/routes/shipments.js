const express = require('express');
const router = express.Router();
const path = require('path');
const Shipment = require('../models/Shipment');
const Courier = require('../models/Courier');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifyShipmentCreated, notifyStatusUpdate } = require('../services/notifications');
const { generateWaybill } = require('../services/waybill');

// ── GET all shipments (admin) ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, priority, search, courierId, page = 1, limit = 25 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (courierId) filter.courier = courierId;
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { trackingNumber: re },
        { 'sender.name': re },
        { 'recipient.name': re },
        { 'recipient.phone': re },
        { description: re },
      ];
    }

    const total = await Shipment.countDocuments(filter);
    const shipments = await Shipment.find(filter)
      .populate('courier', 'name phone vehicleType status')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), data: shipments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET stats ────────────────────────────────────────────────────────────────
router.get('/meta/stats', requireAuth, async (req, res) => {
  try {
    const [total, pending, inTransit, outForDelivery, delivered, failed, unpaid] = await Promise.all([
      Shipment.countDocuments(),
      Shipment.countDocuments({ status: 'Pending' }),
      Shipment.countDocuments({ status: 'In Transit' }),
      Shipment.countDocuments({ status: 'Out for Delivery' }),
      Shipment.countDocuments({ status: 'Delivered' }),
      Shipment.countDocuments({ status: 'Failed' }),
      Shipment.countDocuments({ paymentStatus: 'Unpaid' }),
    ]);
    const revenueAgg = await Shipment.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$deliveryFee' } } },
    ]);
    const revenue = revenueAgg[0]?.total || 0;
    res.json({ success: true, data: { total, pending, inTransit, outForDelivery, delivered, failed, unpaid, revenue } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET single shipment (public — for tracking) ──────────────────────────────
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const s = await Shipment.findOne({ trackingNumber: req.params.trackingNumber.toUpperCase() })
      .populate('courier', 'name phone vehicleType');
    if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
    // Return limited fields for public
    res.json({ success: true, data: {
      trackingNumber: s.trackingNumber,
      description: s.description,
      packageType: s.packageType,
      status: s.status,
      priority: s.priority,
      sender: { name: s.sender.name, city: s.sender.city, state: s.sender.state },
      recipient: { name: s.recipient.name, city: s.recipient.city, state: s.recipient.state },
      courier: s.courier ? { name: s.courier.name, phone: s.courier.phone, vehicleType: s.courier.vehicleType } : null,
      estimatedDelivery: s.estimatedDelivery,
      deliveredAt: s.deliveredAt,
      history: s.history,
      createdAt: s.createdAt,
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET single by ID (admin) ─────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const s = await Shipment.findById(req.params.id)
      .populate('courier', 'name phone vehicleType zone')
      .populate('createdBy', 'name');
    if (!s) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST create shipment ─────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.session.userId };
    const shipment = await Shipment.create(data);

    // Add initial history entry
    shipment.history.push({ status: 'Pending', note: 'Shipment created', updatedBy: req.session.userId });
    await shipment.save();

    // Fire notifications in background (don't await — keep response fast)
    notifyShipmentCreated(shipment).catch(console.error);

    res.status(201).json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PATCH update status ──────────────────────────────────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, note, location } = req.body;
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found' });

    shipment.status = status;
    if (status === 'Delivered') shipment.deliveredAt = new Date();
    shipment.history.push({ status, note, location, updatedBy: req.session.userId });
    await shipment.save();

    // Notify in background
    notifyStatusUpdate(shipment).catch(console.error);

    res.json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PATCH assign courier ─────────────────────────────────────────────────────
router.patch('/:id/assign', requireAuth, requireRole('superadmin', 'admin', 'dispatcher'), async (req, res) => {
  try {
    const { courierId } = req.body;
    const [shipment, courier] = await Promise.all([
      Shipment.findById(req.params.id),
      Courier.findById(courierId),
    ]);
    if (!shipment || !courier) return res.status(404).json({ success: false, message: 'Shipment or courier not found' });

    shipment.courier = courierId;
    shipment.history.push({ status: shipment.status, note: `Assigned to courier: ${courier.name}`, updatedBy: req.session.userId });
    courier.status = 'Busy';
    await Promise.all([shipment.save(), courier.save()]);

    res.json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── GET waybill PDF ──────────────────────────────────────────────────────────
router.get('/:id/waybill', requireAuth, async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id).populate('courier', 'name phone');
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found' });

    const filePath = await generateWaybill(shipment);
    res.download(filePath, `waybill-${shipment.trackingNumber}.pdf`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Could not generate waybill' });
  }
});

// ── PATCH update payment status (cash/transfer) ──────────────────────────────
router.patch('/:id/payment', requireAuth, async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, paymentRef } = req.body;
    const shipment = await Shipment.findByIdAndUpdate(req.params.id,
      { paymentStatus, paymentMethod, paymentRef },
      { new: true }
    );
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: shipment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    await Shipment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
