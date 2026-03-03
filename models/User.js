const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  rollNo: { type: String, unique: true },
  email: String,
  department: String,
  year: String,
  phone: String,
  attendedCTF: String,
  qrCode: String,
  checkedIn: { type: Boolean, default: false },
  checkInTime: Date
});

module.exports = mongoose.model("User", UserSchema);