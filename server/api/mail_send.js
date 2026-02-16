const mongoose = require("mongoose");
const Player = require("../data/mongooseDataStructure/player");
const Messages = require("../data/mongooseDataStructure/messages");

const safeCallback = (callback) => (typeof callback === "function" ? callback : () => {});

const sanitizeText = (value, maxLength = 400) =>
    String(value || "")
        .trim()
        .slice(0, maxLength);

module.exports = (socket) => {
    socket.on("mail_send", async (data, callback) => {
        const respond = safeCallback(callback);
        const fromPlayerID = String(data?.fromPlayerID || "").trim();
        const toUsername = sanitizeText(data?.toUsername, 40);
        const subject = sanitizeText(data?.subject, 120);
        const message = sanitizeText(data?.message, 4000);
        const kind = sanitizeText(data?.kind, 40) || "direct";

        try {
            if (!mongoose.isValidObjectId(fromPlayerID)) {
                return respond({ success: false, message: "Valid fromPlayerID is required" });
            }

            if (!toUsername) {
                return respond({ success: false, message: "Recipient username is required" });
            }

            if (!message) {
                return respond({ success: false, message: "Message body is required" });
            }

            const [sender, recipient] = await Promise.all([
                Player.findById(fromPlayerID).select("_id username"),
                Player.findOne({ username: toUsername }).select("_id username"),
            ]);

            if (!sender) {
                return respond({ success: false, message: "Sender not found" });
            }
            if (!recipient) {
                return respond({ success: false, message: "Recipient not found" });
            }

            const createdMessage = await Messages.create({
                from: sender._id,
                to: [recipient._id],
                kind,
                subject,
                message,
                payload: {},
                status: "sent",
                readBy: [],
            });

            respond({
                success: true,
                messageID: String(createdMessage._id),
                to: {
                    _id: String(recipient._id),
                    username: recipient.username || toUsername,
                },
            });
        } catch (error) {
            console.error("[mail_send] failed", error);
            respond({ success: false, message: error.message || "Failed to send message" });
        }
    });
};
