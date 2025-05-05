const User = require('../models/User');

// Handle Signup
exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = new User({ email, password });
    await user.save();
    res.json({ success: true });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: "Email already exists." });
    } else {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  }
};

// Handle Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && user.password === password) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
