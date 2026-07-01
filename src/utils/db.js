const mongoose = require('mongoose');
const User = require('../models/User');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shiptrack';
  await mongoose.connect(uri);
  console.log(`[DB] Connected to MongoDB`);
  await seedAdmin();
}

async function seedAdmin() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const email    = process.env.ADMIN_EMAIL    || 'admin@shiptrack.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const name     = process.env.ADMIN_NAME     || 'Super Admin';

  await User.create({ name, email, password, role: 'superadmin' });
  console.log(`[SEED] Admin user created: ${email} / ${password}`);
  console.log(`[SEED] ⚠️  Change the admin password immediately after first login!`);
}

module.exports = { connectDB };
