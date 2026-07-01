const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  shipment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
  amount:     { type: Number, required: true },       // in kobo for Paystack
  reference:  { type: String, unique: true },         // Paystack reference
  status:     { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  channel:    { type: String },                       // card, bank, ussd etc
  paidAt:     { type: Date },
  metadata:   { type: mongoose.Schema.Types.Mixed },  // raw Paystack response
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
