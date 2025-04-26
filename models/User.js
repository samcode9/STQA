const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true, // removes extra spaces
    lowercase: true, // saves emails in lowercase
  },
  password: {
    type: String,
    required: true,
  },
});

// Create the User model
const User = mongoose.model('userdata', userSchema);

// Export the model
module.exports = User;
