const mongoose = require("mongoose");
const Campaign = require("../data/mongooseDataStructure/campaign");
const Player = require("../data/mongooseDataStructure/player");

const MIN_ALLOWED_PLAYERS = 2;
const MAX_ALLOWED_PLAYERS = 12;
const DEFAULT_MAX_PLAYERS = 6;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeCallback = (callback) => (typeof callback === "function" ? callback : () => {});

const sanitizeText = (value, maxLength = 250) =>
    String(value || "")
        .trim()
        .slice(0, maxLength);

const sanitizeCode = (value) =>
    String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

const toObjectIdString = (value) => {
    if (!value) return "";
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
};

const isCampaignMember = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;

    if (String(campaign.dmId) === normalizedPlayerID) return true;
    return (campaign.players || []).some((memberID) => String(memberID) === normalizedPlayerID);
};

const formatCampaign = (campaignDoc) => {
    const campaign = campaignDoc?.toObject ? campaignDoc.toObject() : campaignDoc;
    if (!campaign) return null;

    const players = Array.isArray(campaign.players) ? campaign.players : [];
    const activeLobby = campaign.activeLobby || {};

    return {
        _id: String(campaign._id),
        name: campaign.name || "Untitled Campaign",
        description: campaign.description || "",
        joinCode: campaign.joinCode || "",
        dmId: toObjectIdString(campaign.dmId),
        dmName: typeof campaign.dmId === "object" ? campaign.dmId.username || "" : "",
        maxPlayers: Number(campaign.maxPlayers) || DEFAULT_MAX_PLAYERS,
        isPrivate: Boolean(campaign.isPrivate),
        setting: campaign.setting || "",
        memberCount: players.length,
        players: players.map((player) => ({
            _id: toObjectIdString(player),
            username: typeof player === "object" ? player.username || "" : "",
        })),
        gameSaves: Array.isArray(campaign.gameSaves)
            ? campaign.gameSaves.map((saveRef) => toObjectIdString(saveRef))
            : [],
        activeGameSave: toObjectIdString(campaign.activeGameSave),
        activeLobby: {
            isActive: Boolean(activeLobby.isActive),
            lobbyCode: activeLobby.lobbyCode || "",
            startedBy: toObjectIdString(activeLobby.startedBy),
            startedAt: activeLobby.startedAt || null,
            members: Array.isArray(activeLobby.members)
                ? activeLobby.members.map((member) => toObjectIdString(member))
                : [],
        },
        createdAt: campaign.createdAt || null,
    };
};

const generateRandomCode = (length) => {
    let output = "";
    for (let i = 0; i < length; i += 1) {
        const idx = Math.floor(Math.random() * CODE_CHARS.length);
        output += CODE_CHARS[idx];
    }
    return output;
};

const generateUniqueCode = async (existsFn, length = JOIN_CODE_LENGTH, maxAttempts = 40) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const code = generateRandomCode(length);
        const exists = await existsFn(code);
        if (!exists) return code;
    }
    throw new Error("Unable to generate a unique code. Please try again.");
};

const readCampaignForResponse = async (campaignID) =>
    Campaign.findById(campaignID)
        .populate({ path: "dmId", select: "_id username" })
        .populate({ path: "players", select: "_id username" })
        .lean();

module.exports = (socket) => {
    socket.on("campaign_list", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const campaigns = await Campaign.find({
                $or: [{ dmId: playerID }, { players: playerID }],
            })
                .sort({ createdAt: -1 })
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" });

            respond({
                success: true,
                campaigns: campaigns.map((campaign) => formatCampaign(campaign)).filter(Boolean),
            });
        } catch (error) {
            console.error("[campaign_list] failed", error);
            respond({ success: false, message: error.message || "Failed to load campaigns" });
        }
    });

    socket.on("campaign_create", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const player = await Player.findById(playerID).select("_id");
            if (!player) {
                return respond({ success: false, message: "Player not found" });
            }

            const name = sanitizeText(data?.name, 80);
            if (!name) {
                return respond({ success: false, message: "Campaign name is required" });
            }

            const description = sanitizeText(data?.description, 1000);
            const setting = sanitizeText(data?.setting, 120);
            const requestedMaxPlayers = Number.parseInt(data?.maxPlayers, 10);
            const maxPlayers = Number.isFinite(requestedMaxPlayers)
                ? clamp(requestedMaxPlayers, MIN_ALLOWED_PLAYERS, MAX_ALLOWED_PLAYERS)
                : DEFAULT_MAX_PLAYERS;
            const isPrivate = Boolean(data?.isPrivate);

            const joinCode = await generateUniqueCode(async (code) =>
                Campaign.exists({ joinCode: code })
            );

            const createdCampaign = await Campaign.create({
                name,
                description,
                setting,
                joinCode,
                maxPlayers,
                isPrivate,
                dmId: player._id,
                players: [player._id],
                activeLobby: {
                    isActive: false,
                    lobbyCode: "",
                    startedBy: null,
                    startedAt: null,
                    members: [],
                },
            });

            await Player.findByIdAndUpdate(player._id, {
                $addToSet: { campaigns: createdCampaign._id },
            });

            const campaignForClient = await readCampaignForResponse(createdCampaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_create] failed", error);
            respond({ success: false, message: error.message || "Failed to create campaign" });
        }
    });

    socket.on("campaign_join", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID)) {
                return respond({ success: false, message: "Valid playerID is required" });
            }

            const joinCode = sanitizeCode(data?.joinCode);
            if (!joinCode || joinCode.length < JOIN_CODE_LENGTH) {
                return respond({ success: false, message: "A valid campaign code is required" });
            }

            const player = await Player.findById(playerID).select("_id");
            if (!player) {
                return respond({ success: false, message: "Player not found" });
            }

            const campaign = await Campaign.findOne({ joinCode });
            if (!campaign) {
                return respond({ success: false, message: "Campaign code not found" });
            }

            if (isCampaignMember(campaign, playerID)) {
                const existingCampaign = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    alreadyJoined: true,
                    campaign: formatCampaign(existingCampaign),
                });
            }

            if ((campaign.players || []).length >= campaign.maxPlayers) {
                return respond({
                    success: false,
                    message: "This campaign is full",
                });
            }

            campaign.players.addToSet(player._id);
            await campaign.save();

            await Player.findByIdAndUpdate(player._id, {
                $addToSet: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_join] failed", error);
            respond({ success: false, message: error.message || "Failed to join campaign" });
        }
    });

    socket.on("campaign_startLobby", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "You must be in this campaign to start its lobby",
                });
            }

            const lobbyCode = await generateUniqueCode(async (code) =>
                Campaign.exists({ "activeLobby.isActive": true, "activeLobby.lobbyCode": code })
            );

            campaign.activeLobby = {
                isActive: true,
                lobbyCode,
                startedBy: playerID,
                startedAt: new Date(),
                members: [playerID],
            };

            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                gameID: String(campaign._id),
                lobbyCode,
            });
        } catch (error) {
            console.error("[campaign_startLobby] failed", error);
            respond({ success: false, message: error.message || "Failed to start lobby" });
        }
    });

    socket.on("campaign_joinLobby", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can join this lobby",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "This campaign does not have an active lobby",
                });
            }

            const providedLobbyCode = sanitizeCode(data?.lobbyCode);
            if (
                providedLobbyCode &&
                providedLobbyCode !== sanitizeCode(campaign.activeLobby.lobbyCode)
            ) {
                return respond({ success: false, message: "Lobby code mismatch" });
            }

            const existingLobbyMembers = Array.isArray(campaign.activeLobby.members)
                ? campaign.activeLobby.members.map((member) => String(member))
                : [];

            if (!existingLobbyMembers.includes(String(playerID))) {
                campaign.activeLobby.members.push(playerID);
                await campaign.save();
            }

            respond({
                success: true,
                gameID: String(campaign._id),
                campaignID: String(campaign._id),
                lobbyCode: campaign.activeLobby.lobbyCode,
            });
        } catch (error) {
            console.error("[campaign_joinLobby] failed", error);
            respond({ success: false, message: error.message || "Failed to join lobby" });
        }
    });
};
