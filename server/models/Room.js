const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  messages: [
    {
      text: String,
      sender: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = mongoose.model("Room", RoomSchema);