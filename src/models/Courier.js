const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  phone:       { type: String, required: true, trim: true },
  email:       { type: String, trim: true, lowercase: true },
  vehicleType: { type: String, enum: ['Motorcycle', 'Bicycle', 'Car', 'Van', 'Truck'], default: 'Motorcycle' },
  vehiclePlate:{ type: String, trim: true },
  zone:        { type: String, trim: true },          // area of operation
  status:      { type: String, enum: ['Available', 'Busy', 'Offline'], default: 'Available' },
  isActive:    { type: Boolean, default: true },
  totalDeliveries: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Courier', courierSchema);
