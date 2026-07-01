const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name:    { type: String, required: true },
  phone:   { type: String, required: true },
  email:   { type: String },
  address: { type: String, required: true },
  city:    { type: String },
  state:   { type: String },
}, { _id: false });

const historySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  note:      { type: String },
  location:  { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  trackingNumber: { type: String, unique: true },   // auto-generated
  sender:   partySchema,
  recipient: partySchema,

  description:  { type: String, required: true },
  weight:       { type: Number },                   // kg
  dimensions:   { width: Number, height: Number, length: Number }, // cm
  quantity:     { type: Number, default: 1 },
  packageType:  { type: String, enum: ['Document', 'Parcel', 'Fragile', 'Food', 'Electronics', 'Other'], default: 'Parcel' },

  priority:     { type: String, enum: ['Standard', 'Express', 'Urgent', 'Same-Day'], default: 'Standard' },
  status:       {
    type: String,
    enum: ['Pending', 'Confirmed', 'Picked Up', 'In Transit', 'At Hub', 'Out for Delivery', 'Delivered', 'Failed', 'Returned'],
    default: 'Pending'
  },

  courier:      { type: mongoose.Schema.Types.ObjectId, ref: 'Courier' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Payment
  deliveryFee:  { type: Number, default: 0 },
  paymentStatus:{ type: String, enum: ['Unpaid', 'Paid', 'Waived'], default: 'Unpaid' },
  paymentRef:   { type: String },                   // Paystack reference
  paymentMethod:{ type: String, enum: ['Cash', 'Transfer', 'Card', 'Paystack'], default: 'Cash' },

  estimatedDelivery: { type: Date },
  deliveredAt:  { type: Date },

  notes:        { type: String },
  history:      [historySchema],

  // Notification flags
  smsNotified:    { type: Boolean, default: false },
  emailNotified:  { type: Boolean, default: false },
}, { timestamps: true });

// Auto-generate tracking number
shipmentSchema.pre('save', async function(next) {
  if (this.trackingNumber) return next();
  const count = await mongoose.model('Shipment').countDocuments();
  const pad = String(count + 1).padStart(5, '0');
  const year = new Date().getFullYear();
  this.trackingNumber = `TRK-${year}-${pad}`;
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);
