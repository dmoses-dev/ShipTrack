const express = require('express');
const router = express.Router();
const path = require('path');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, '../../views/login.html'));
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase(), isActive: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.redirect('/auth/login?error=invalid');
    }
    req.session.userId    = user._id.toString();
    req.session.userName  = user.name;
    req.session.userEmail = user.email;
    req.session.role      = user.role;
    user.lastLogin = new Date();
    await user.save();
    res.redirect(req.query.next || '/admin');
  } catch (err) {
    console.error(err);
    res.redirect('/auth/login?error=server');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

// Session info for frontend layout.js
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: {
    id: req.session.userId, name: req.session.userName,
    email: req.session.userEmail, role: req.session.role,
  }});
});

router.get('/users', requireAuth, requireRole('superadmin','admin'), async (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/users.html'));
});

router.post('/users', requireAuth, requireRole('superadmin','admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.redirect('/admin/users?error=exists');
    await User.create({ name, email, password, role, phone });
    res.redirect('/admin/users?success=1');
  } catch (err) { res.redirect('/admin/users?error=server'); }
});

router.get('/users/list', requireAuth, requireRole('superadmin','admin'), async (req, res) => {
  const users = await User.find({}, '-password').sort('-createdAt');
  res.json({ success: true, data: users });
});

router.delete('/users/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  if (req.params.id === req.session.userId)
    return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
  await User.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true });
});

module.exports = router;
