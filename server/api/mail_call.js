const mongoose = require("mongoose");
const Player = require("../data/mongooseDataStructure/player");
const Campaign = require("../data/mongooseDataStructure/campaign");
const Messages = require("../data/mongooseDataStructure/messages");

const safeCallback = (callback) => (typeof callback === "function" ? callback : () => {});

const toObjectIdString = (value) => {
    if (!value) return "";
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
};

const toPlainObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
};

const formatMessageForPlayer = (messageDoc, playerID) => {
    const message = messageDoc?.toObject ? messageDoc.toObject() : messageDoc;
    if (!message) return null;

    const from = message.from && typeof message.from === "object"
        ? {
            _id: toObjectIdString(message.from),
            username: message.from.username || "",
        }
        : {
            _id: toObjectIdString(message.from),
            username: "",
        };

    const normalizedPlayerID = String(playerID || "");
    const readBy = Array.isArray(message.readBy) ? message.readBy.map((reader) => String(reader)) : [];
    const messageText = String(message.message || "");

    return {
        _id: String(message._id),
        from,
        to: Array.isArray(message.to) ? message.to.map((recipient) => toObjectIdString(recipient)) : [],
        kind: message.kind || "system",
        subject: message.subject || "",
        message: messageText,
        snippet: messageText.slice(0, 220),
        payload: toPlainObject(message.payload),
        status: message.status || "sent",
        time: message.time || message.createdAt || null,
        actedAt: message.actedAt || null,
        unread: normalizedPlayerID ? !readBy.includes(normalizedPlayerID) : false,
    };
};

module.exports = (socket) => {
    socket.on("mail_call", async (data, callback) => {
        const respond = safeCallback(callback);
        const playerID = String(data?.playerID || "").trim();

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const playerExists = await Player.exists({ _id: playerID });
            if (!playerExists) {
                return respond({ success: false, message: "Player not found" });
            }

            const messages = await Messages.find({ to: playerID })
                .sort({ time: -1, createdAt: -1 })
                .limit(100)
                .populate({ path: "from", select: "_id username" });

            const formattedMessages = messages
                .map((messageDoc) => formatMessageForPlayer(messageDoc, playerID))
                .filter(Boolean);

            respond({
                success: true,
                messages: formattedMessages,
                unreadCount: formattedMessages.filter((message) => message.unread).length,
            });
        } catch (error) {
            console.error("[mail_call] failed", error);
            respond({ success: false, message: error.message || "Failed to load mailbox" });
        }
    });

    socket.on("mail_markRead", async (data, callback) => {
        const respond = safeCallback(callback);
        const playerID = String(data?.playerID || "").trim();
        const messageID = String(data?.messageID || "").trim();

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(messageID)) {
                return respond({ success: false, message: "Valid playerID and messageID are required" });
            }

            const message = await Messages.findOne({ _id: messageID, to: playerID });
            if (!message) {
                return respond({ success: false, message: "Message not found" });
            }

            message.readBy = Array.isArray(message.readBy) ? message.readBy : [];
            const alreadyRead = message.readBy.some((readerID) => String(readerID) === playerID);
            if (!alreadyRead) {
                message.readBy.push(playerID);
                await message.save();
            }

            respond({ success: true, messageID: String(message._id) });
        } catch (error) {
            console.error("[mail_markRead] failed", error);
            respond({ success: false, message: error.message || "Failed to mark message read" });
        }
    });

    socket.on("mail_respondInvite", async (data, callback) => {
        const respond = safeCallback(callback);
        const playerID = String(data?.playerID || "").trim();
        const messageID = String(data?.messageID || "").trim();
        const action = String(data?.action || "").trim().toLowerCase();

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(messageID)) {
                return respond({ success: false, message: "Valid playerID and messageID are required" });
            }

            if (!["accept", "decline"].includes(action)) {
                return respond({ success: false, message: "Action must be accept or decline" });
            }

            const inviteMessage = await Messages.findOne({ _id: messageID, to: playerID });
            if (!inviteMessage) {
                return respond({ success: false, message: "Invite message not found" });
            }

            if (inviteMessage.kind !== "campaign_invite") {
                return respond({ success: false, message: "This message is not a campaign invite" });
            }

            if (inviteMessage.status !== "pending") {
                return respond({
                    success: false,
                    message: "This invite has already been handled",
                    status: inviteMessage.status,
                });
            }

            inviteMessage.readBy = Array.isArray(inviteMessage.readBy) ? inviteMessage.readBy : [];
            if (!inviteMessage.readBy.some((readerID) => String(readerID) === playerID)) {
                inviteMessage.readBy.push(playerID);
            }

            if (action === "decline") {
                inviteMessage.status = "declined";
                inviteMessage.actedAt = new Date();
                await inviteMessage.save();
                return respond({
                    success: true,
                    action,
                    status: inviteMessage.status,
                    messageID: String(inviteMessage._id),
                });
            }

            const campaignID = String(inviteMessage.payload?.campaignID || "").trim();
            if (!mongoose.isValidObjectId(campaignID)) {
                inviteMessage.status = "expired";
                inviteMessage.actedAt = new Date();
                await inviteMessage.save();
                return respond({ success: false, message: "Invite is missing a valid campaign reference" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                inviteMessage.status = "expired";
                inviteMessage.actedAt = new Date();
                await inviteMessage.save();
                return respond({ success: false, message: "Campaign no longer exists" });
            }

            const isBanned = Array.isArray(campaign.bannedPlayers)
                ? campaign.bannedPlayers.some((memberID) => String(memberID) === playerID)
                : false;
            if (isBanned) {
                inviteMessage.status = "declined";
                inviteMessage.actedAt = new Date();
                await inviteMessage.save();
                return respond({ success: false, message: "You are banned from this campaign" });
            }

            const isAlreadyMember = String(campaign.dmId) === playerID ||
                (Array.isArray(campaign.players)
                    ? campaign.players.some((memberID) => String(memberID) === playerID)
                    : false);
            if (!isAlreadyMember && (campaign.players || []).length >= campaign.maxPlayers) {
                return respond({
                    success: false,
                    message: "This campaign is currently full. Try again later.",
                });
            }

            if (!isAlreadyMember) {
                campaign.players.addToSet(playerID);
                await campaign.save();
                await Player.findByIdAndUpdate(playerID, {
                    $addToSet: { campaigns: campaign._id },
                });
            }

            inviteMessage.status = "accepted";
            inviteMessage.actedAt = new Date();
            await inviteMessage.save();

            respond({
                success: true,
                action,
                status: inviteMessage.status,
                messageID: String(inviteMessage._id),
                campaignID: String(campaign._id),
                campaignName: campaign.name || "Campaign",
            });
        } catch (error) {
            console.error("[mail_respondInvite] failed", error);
            respond({ success: false, message: error.message || "Failed to respond to invite" });
        }
    });
};
