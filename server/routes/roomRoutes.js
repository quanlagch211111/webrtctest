const express = require("express");
const router = express.Router();
const Room = require("../models/Room");

// Create or join a room
router.get("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    let room = await Room.findOne({ roomId });
    
    if (!room) {
      room = new Room({ roomId });
      await room.save();
    }
    
    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;