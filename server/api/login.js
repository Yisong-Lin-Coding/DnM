const express = require("express");
const router = express.Router();
const Player = require("../data/mongooseDataStructure/player");

router.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await Player.findOne({ username });
  if (!user) return res.status(401).json({ error: "User not found" });

  // In production, use bcrypt to compare hashed passwords!
  if (user.password !== password) {
    return res.status(401).json({ error: "Invalid password" });
  }
  res.json({ success: true, userId: user._id });
});

module.exports = router;