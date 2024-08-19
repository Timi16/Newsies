const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  categories: [String]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
