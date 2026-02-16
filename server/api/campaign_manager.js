const mongoose = require("mongoose");
const Campaign = require("../data/mongooseDataStructure/campaign");
const GameSave = require("../data/mongooseDataStructure/gameSave");
const Player = require("../data/mongooseDataStructure/player");
const Messages = require("../data/mongooseDataStructure/messages");
const Character = require("../data/mongooseDataStructure/character");

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

const toPlainObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
};

const isCampaignMember = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;

    if (String(campaign.dmId) === normalizedPlayerID) return true;
    return (campaign.players || []).some((memberID) => String(memberID) === normalizedPlayerID);
};

const isCampaignDM = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return toObjectIdString(campaign.dmId) === normalizedPlayerID;
};

const isCampaignBanned = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return (campaign.bannedPlayers || []).some((bannedID) => String(bannedID) === normalizedPlayerID);
};

const buildCampaignMemberIDSet = (campaign) => {
    const memberIDs = new Set();
    const dmID = toObjectIdString(campaign?.dmId);
    if (dmID) memberIDs.add(dmID);

    if (Array.isArray(campaign?.players)) {
        campaign.players.forEach((member) => {
            const memberID = toObjectIdString(member);
            if (memberID) memberIDs.add(memberID);
        });
    }

    return memberIDs;
};

const formatCharacterSummary = (characterDoc) => {
    const character = characterDoc?.toObject ? characterDoc.toObject() : characterDoc;
    if (!character) return null;

    return {
        _id: toObjectIdString(character),
        name: character.name || "Unnamed Character",
        level: Number(character.level) || 1,
        playerId: toObjectIdString(character.playerId),
    };
};

const formatCampaign = (campaignDoc) => {
    const campaign = campaignDoc?.toObject ? campaignDoc.toObject() : campaignDoc;
    if (!campaign) return null;

    const players = Array.isArray(campaign.players) ? campaign.players : [];
    const bannedPlayers = Array.isArray(campaign.bannedPlayers) ? campaign.bannedPlayers : [];
    const activeLobby = campaign.activeLobby || {};
    const memberIDs = buildCampaignMemberIDSet(campaign);

    const characterAssignments = new Map();
    if (Array.isArray(campaign.characterAssignments)) {
        campaign.characterAssignments.forEach((assignment) => {
            const playerID = toObjectIdString(assignment?.playerId);
            const characterID = toObjectIdString(assignment?.characterId);
            if (!playerID || !characterID) return;
            if (memberIDs.size > 0 && !memberIDs.has(playerID)) return;
            if (characterAssignments.has(playerID)) return;

            const characterRef =
                assignment?.characterId && typeof assignment.characterId === "object"
                    ? assignment.characterId
                    : null;
            const playerRef =
                assignment?.playerId && typeof assignment.playerId === "object"
                    ? assignment.playerId
                    : null;

            characterAssignments.set(playerID, {
                playerId: playerID,
                playerName: playerRef?.username || "",
                characterId: characterID,
                characterName: characterRef?.name || "",
                characterLevel: Number(characterRef?.level) || null,
                selectedBy: toObjectIdString(assignment?.selectedBy),
                selectedAt: assignment?.selectedAt || null,
            });
        });
    }

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
        bannedPlayers: bannedPlayers.map((player) => ({
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
        characterAssignments: Array.from(characterAssignments.values()),
        createdAt: campaign.createdAt || null,
    };
};

const formatGameSave = (gameSaveDoc) => {
    const gameSave = gameSaveDoc?.toObject ? gameSaveDoc.toObject() : gameSaveDoc;
    if (!gameSave) return null;

    const metadata =
        gameSave.metadata instanceof Map
            ? Object.fromEntries(gameSave.metadata.entries())
            : toPlainObject(gameSave.metadata);

    return {
        _id: String(gameSave._id),
        campaignId: toObjectIdString(gameSave.campaignId),
        name: gameSave.name || "Untitled Save",
        description: gameSave.description || "",
        savedBy: toObjectIdString(gameSave.savedBy),
        version: Number(gameSave.version) || 1,
        isAutoSave: Boolean(gameSave.isAutoSave),
        metadata,
        createdAt: gameSave.createdAt || null,
        updatedAt: gameSave.updatedAt || null,
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
        .populate({ path: "bannedPlayers", select: "_id username" })
        .populate({ path: "characterAssignments.playerId", select: "_id username" })
        .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" })
        .lean();

module.exports = (socket) => {
    socket.on("campaign_getGameContext", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID)
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "bannedPlayers", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can access this game",
                });
            }

            let activeGameSave = null;
            let snapshot = {};
            if (campaign.activeGameSave && mongoose.isValidObjectId(campaign.activeGameSave)) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                });
                if (saveDoc) {
                    activeGameSave = formatGameSave(saveDoc);
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const isDM = String(campaign.dmId?._id || campaign.dmId) === String(playerID);

            respond({
                success: true,
                campaign: formatCampaign(campaign),
                permissions: {
                    isDM,
                    canEditWorld: isDM,
                },
                activeGameSave,
                snapshot,
            });
        } catch (error) {
            console.error("[campaign_getGameContext] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load game context",
            });
        }
    });

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
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "bannedPlayers", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });

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
                characterAssignments: [],
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

            if (isCampaignBanned(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "You are banned from this campaign",
                });
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

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can start or reset this lobby",
                });
            }

            const lobbyCode = await generateUniqueCode(async (code) =>
                Campaign.exists({ "activeLobby.isActive": true, "activeLobby.lobbyCode": code })
            );

            const defaultLobbyMembers = Array.from(
                new Set([
                    String(campaign.dmId),
                    ...(Array.isArray(campaign.players)
                        ? campaign.players.map((memberID) => String(memberID))
                        : []),
                ])
            );

            campaign.activeLobby = {
                isActive: true,
                lobbyCode,
                startedBy: playerID,
                startedAt: new Date(),
                members: defaultLobbyMembers,
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

            const allowedLobbyMembers = Array.isArray(campaign.activeLobby.members)
                ? campaign.activeLobby.members.map((member) => String(member))
                : [];

            if (
                allowedLobbyMembers.length > 0 &&
                !allowedLobbyMembers.includes(String(playerID))
            ) {
                return respond({
                    success: false,
                    message: "The DM has not granted this player access to the active lobby",
                });
            }

            if (!isCampaignDM(campaign, playerID)) {
                const playerAssignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (assignment) => String(assignment?.playerId) === String(playerID)
                      ) || null
                    : null;
                let hasAssignedCharacter = false;

                if (playerAssignment?.characterId && mongoose.isValidObjectId(playerAssignment.characterId)) {
                    const validCharacter = await Character.exists({
                        _id: playerAssignment.characterId,
                        playerId: playerID,
                    });
                    hasAssignedCharacter = Boolean(validCharacter);

                    if (!hasAssignedCharacter) {
                        campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                            (assignment) => String(assignment?.playerId) !== String(playerID)
                        );
                        await campaign.save();
                    }
                }

                if (!hasAssignedCharacter) {
                    return respond({
                        success: false,
                        requiresCharacterSelection: true,
                        message: "Choose a character for this campaign before entering the lobby",
                    });
                }
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

    socket.on("campaign_getCharacterChoices", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID)
                .populate({ path: "dmId", select: "_id username" })
                .populate({ path: "players", select: "_id username" })
                .populate({ path: "characterAssignments.playerId", select: "_id username" })
                .populate({ path: "characterAssignments.characterId", select: "_id name level playerId" });

            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view lobby character choices",
                });
            }

            let availableCharacters = await Character.find({ playerId: playerID })
                .select("_id name level playerId")
                .sort({ updatedAt: -1, createdAt: -1 });

            if (!availableCharacters.length) {
                const playerWithCharacters = await Player.findById(playerID)
                    .select("_id characters")
                    .populate({ path: "characters", select: "_id name level playerId" });

                if (playerWithCharacters && Array.isArray(playerWithCharacters.characters)) {
                    availableCharacters = playerWithCharacters.characters;
                }
            }
            const formattedCampaign = formatCampaign(campaign);

            const isDM = isCampaignDM(campaign, playerID);
            const selectedAssignment = Array.isArray(formattedCampaign?.characterAssignments)
                ? formattedCampaign.characterAssignments.find(
                      (assignment) => assignment.playerId === String(playerID)
                  ) || null
                : null;

            let allCharactersByPlayer = [];
            if (isDM) {
                const memberIDs = Array.from(buildCampaignMemberIDSet(campaign)).filter((memberID) =>
                    mongoose.isValidObjectId(memberID)
                );
                const assignmentByPlayer = new Map(
                    (formattedCampaign?.characterAssignments || []).map((assignment) => [
                        assignment.playerId,
                        assignment.characterId,
                    ])
                );
                const dmID = toObjectIdString(campaign.dmId);

                const playersWithCharacters = await Player.find({
                    _id: { $in: memberIDs },
                })
                    .select("_id username characters")
                    .populate({ path: "characters", select: "_id name level playerId" });

                allCharactersByPlayer = playersWithCharacters
                    .map((member) => {
                        const memberID = String(member._id);
                        const assignedCharacterId = assignmentByPlayer.get(memberID) || "";
                        const characters = Array.isArray(member.characters)
                            ? member.characters
                                  .map((characterDoc) => {
                                      const summary = formatCharacterSummary(characterDoc);
                                      if (!summary) return null;
                                      return {
                                          ...summary,
                                          isSelected: summary._id === assignedCharacterId,
                                      };
                                  })
                                  .filter(Boolean)
                            : [];

                        return {
                            playerId: memberID,
                            playerName: member.username || "",
                            assignedCharacterId,
                            characters,
                        };
                    })
                    .sort((a, b) => {
                        if (a.playerId === dmID) return -1;
                        if (b.playerId === dmID) return 1;
                        return (a.playerName || "").localeCompare(b.playerName || "");
                    });
            }

            respond({
                success: true,
                campaign: formattedCampaign,
                assignments: formattedCampaign?.characterAssignments || [],
                selectedAssignment,
                availableCharacters: availableCharacters
                    .map((character) => formatCharacterSummary(character))
                    .filter(Boolean),
                allCharactersByPlayer,
                canManageAllCharacters: isDM,
            });
        } catch (error) {
            console.error("[campaign_getCharacterChoices] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load campaign character choices",
            });
        }
    });

    socket.on("campaign_setCharacterAssignment", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(characterID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and characterID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeLobby characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can set lobby characters",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "Start the lobby before selecting a character",
                });
            }

            const allowedLobbyMembers = Array.isArray(campaign.activeLobby.members)
                ? campaign.activeLobby.members.map((member) => String(member))
                : [];
            if (
                allowedLobbyMembers.length > 0 &&
                !allowedLobbyMembers.includes(String(playerID))
            ) {
                return respond({
                    success: false,
                    message: "The DM has not granted this player access to the active lobby",
                });
            }

            const character = await Character.findById(characterID).select("_id name level playerId");
            if (!character) {
                return respond({ success: false, message: "Character not found" });
            }

            let characterOwnedByPlayer = String(character.playerId) === String(playerID);
            if (!characterOwnedByPlayer) {
                const linkedToPlayer = await Player.exists({
                    _id: playerID,
                    characters: character._id,
                });
                characterOwnedByPlayer = Boolean(linkedToPlayer);
            }

            if (!characterOwnedByPlayer) {
                return respond({
                    success: false,
                    message: "You can only assign your own character to this lobby",
                });
            }

            if (String(character.playerId || "") !== String(playerID)) {
                await Character.updateOne({ _id: character._id }, { $set: { playerId: playerID } });
            }

            const nextAssignments = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.filter(
                      (assignment) => String(assignment?.playerId) !== String(playerID)
                  )
                : [];
            nextAssignments.push({
                playerId,
                characterId,
                selectedBy: playerID,
                selectedAt: new Date(),
            });
            campaign.characterAssignments = nextAssignments;

            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            const formattedCampaign = formatCampaign(campaignForClient);
            const assignment = Array.isArray(formattedCampaign?.characterAssignments)
                ? formattedCampaign.characterAssignments.find(
                      (entry) => String(entry.playerId) === String(playerID)
                  ) || null
                : null;

            respond({
                success: true,
                campaign: formattedCampaign,
                assignment,
                character: formatCharacterSummary(character),
            });
        } catch (error) {
            console.error("[campaign_setCharacterAssignment] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to select lobby character",
            });
        }
    });

    socket.on("campaign_forceRemoveCharacterAssignment", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, targetPlayerID } = data || {};
        const characterID = String(data?.characterID || "").trim();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(targetPlayerID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and targetPlayerID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id name dmId players characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can remove assigned characters",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => String(entry?.playerId) === String(targetPlayerID)
                  )
                : null;
            if (!assignment) {
                return respond({
                    success: false,
                    message: "That player does not currently have a selected character",
                });
            }

            const assignedCharacterID = toObjectIdString(assignment.characterId);
            if (characterID && characterID !== assignedCharacterID) {
                return respond({
                    success: false,
                    message: "Selected character does not match the player's current assignment",
                });
            }

            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (entry) => String(entry?.playerId) !== String(targetPlayerID)
            );
            await campaign.save();

            const [dmPlayer, targetPlayer, removedCharacter] = await Promise.all([
                Player.findById(playerID).select("_id username"),
                Player.findById(targetPlayerID).select("_id username"),
                Character.findById(assignedCharacterID).select("_id name level"),
            ]);

            if (targetPlayer) {
                await Messages.create({
                    from: dmPlayer?._id || null,
                    to: [targetPlayer._id],
                    kind: "campaign_character_removed",
                    subject: `Character Removed: ${campaign.name || "Campaign"}`,
                    message: `${dmPlayer?.username || "DM"} removed your selected character${
                        removedCharacter?.name ? ` (${removedCharacter.name})` : ""
                    } from "${campaign.name || "this campaign"}". Choose another character before entering the lobby.`,
                    payload: {
                        campaignID: String(campaign._id),
                        campaignName: campaign.name || "Campaign",
                        removedCharacterID: assignedCharacterID,
                        removedCharacterName: removedCharacter?.name || "",
                        removedByID: String(playerID),
                    },
                    status: "sent",
                    readBy: [],
                });
            }

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                removedPlayerID: String(targetPlayerID),
                removedCharacterID: assignedCharacterID,
            });
        } catch (error) {
            console.error("[campaign_forceRemoveCharacterAssignment] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to remove assigned character",
            });
        }
    });

    socket.on("campaign_leave", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeLobby characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: true,
                    alreadyLeft: true,
                    campaignID: String(campaignID),
                });
            }

            if (isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "The DM cannot leave their own campaign",
                });
            }

            campaign.players = (campaign.players || []).filter(
                (member) => String(member) !== String(playerID)
            );
            if (Array.isArray(campaign.activeLobby?.members)) {
                campaign.activeLobby.members = campaign.activeLobby.members.filter(
                    (member) => String(member) !== String(playerID)
                );
            }
            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (assignment) => String(assignment?.playerId) !== String(playerID)
            );

            await campaign.save();

            await Player.findByIdAndUpdate(playerID, {
                $pull: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                leftCampaignID: String(campaign._id),
            });
        } catch (error) {
            console.error("[campaign_leave] failed", error);
            respond({ success: false, message: error.message || "Failed to leave campaign" });
        }
    });

    socket.on("campaign_setLobbyMembers", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId players activeLobby");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can manage lobby players",
                });
            }

            if (!campaign.activeLobby?.isActive || !campaign.activeLobby?.lobbyCode) {
                return respond({
                    success: false,
                    message: "Start the lobby before managing players",
                });
            }

            const campaignMemberIDs = new Set(
                Array.isArray(campaign.players) ? campaign.players.map((member) => String(member)) : []
            );
            campaignMemberIDs.add(String(campaign.dmId));

            const requestedMemberIDs = Array.isArray(data?.memberIDs) ? data.memberIDs : [];
            const normalizedRequestedMembers = Array.from(
                new Set(
                    requestedMemberIDs
                        .map((memberID) => String(memberID || "").trim())
                        .filter((memberID) => mongoose.isValidObjectId(memberID))
                )
            );

            const filteredMembers = normalizedRequestedMembers.filter((memberID) =>
                campaignMemberIDs.has(memberID)
            );
            const nextLobbyMembers = Array.from(new Set([String(campaign.dmId), ...filteredMembers]));

            campaign.activeLobby.members = nextLobbyMembers;
            await campaign.save();

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                members: nextLobbyMembers,
            });
        } catch (error) {
            console.error("[campaign_setLobbyMembers] failed", error);
            respond({ success: false, message: error.message || "Failed to update lobby players" });
        }
    });

    socket.on("campaign_managePlayer", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, targetPlayerID } = data || {};
        const action = String(data?.action || "").trim().toLowerCase();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(targetPlayerID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and targetPlayerID are required",
                });
            }

            if (!["kick", "ban", "unban"].includes(action)) {
                return respond({
                    success: false,
                    message: "Action must be kick, ban, or unban",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players bannedPlayers activeLobby characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can manage players",
                });
            }

            if (toObjectIdString(campaign.dmId) === String(targetPlayerID)) {
                return respond({
                    success: false,
                    message: "The DM cannot be removed or banned",
                });
            }

            if (action === "unban") {
                campaign.bannedPlayers = (campaign.bannedPlayers || []).filter(
                    (member) => String(member) !== String(targetPlayerID)
                );
                await campaign.save();

                const campaignForClient = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    campaign: formatCampaign(campaignForClient),
                });
            }

            const campaignPlayers = Array.isArray(campaign.players)
                ? campaign.players.map((member) => String(member))
                : [];

            if (!campaignPlayers.includes(String(targetPlayerID))) {
                return respond({
                    success: false,
                    message: "Target player is not currently in this campaign",
                });
            }

            campaign.players = (campaign.players || []).filter(
                (member) => String(member) !== String(targetPlayerID)
            );
            if (Array.isArray(campaign.activeLobby?.members)) {
                campaign.activeLobby.members = campaign.activeLobby.members.filter(
                    (member) => String(member) !== String(targetPlayerID)
                );
            }
            campaign.characterAssignments = (campaign.characterAssignments || []).filter(
                (assignment) => String(assignment?.playerId) !== String(targetPlayerID)
            );

            if (action === "ban") {
                campaign.bannedPlayers.addToSet(targetPlayerID);
            }

            await campaign.save();
            await Player.findByIdAndUpdate(targetPlayerID, {
                $pull: { campaigns: campaign._id },
            });

            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
            });
        } catch (error) {
            console.error("[campaign_managePlayer] failed", error);
            respond({ success: false, message: error.message || "Failed to manage player" });
        }
    });

    socket.on("campaign_invitePlayer", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const username = sanitizeText(data?.username, 40);

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            if (!username) {
                return respond({
                    success: false,
                    message: "A username is required to invite a player",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id name description joinCode dmId players bannedPlayers maxPlayers"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can invite players",
                });
            }

            const [invitee, sender] = await Promise.all([
                Player.findOne({ username }).select("_id username"),
                Player.findById(playerID).select("_id username"),
            ]);
            if (!invitee) {
                return respond({
                    success: false,
                    message: "Player not found for that username",
                });
            }
            if (!sender) {
                return respond({
                    success: false,
                    message: "Inviting player not found",
                });
            }

            const inviteeID = String(invitee._id);
            if (inviteeID === toObjectIdString(campaign.dmId)) {
                return respond({
                    success: false,
                    message: "That player is already the DM of this campaign",
                });
            }

            if (isCampaignBanned(campaign, inviteeID)) {
                return respond({
                    success: false,
                    message: "That player is banned from this campaign",
                });
            }

            if (isCampaignMember(campaign, inviteeID)) {
                const existingCampaign = await readCampaignForResponse(campaign._id);
                return respond({
                    success: true,
                    alreadyMember: true,
                    campaign: formatCampaign(existingCampaign),
                    invitedPlayer: {
                        _id: inviteeID,
                        username: invitee.username || username,
                    },
                });
            }

            const pendingInvite = await Messages.findOne({
                kind: "campaign_invite",
                to: invitee._id,
                status: "pending",
                "payload.campaignID": String(campaign._id),
            }).select("_id");

            if (pendingInvite) {
                return respond({
                    success: true,
                    alreadyInvited: true,
                    invitedPlayer: {
                        _id: inviteeID,
                        username: invitee.username || username,
                    },
                    messageID: String(pendingInvite._id),
                });
            }

            const createdInvite = await Messages.create({
                from: sender._id,
                to: [invitee._id],
                kind: "campaign_invite",
                subject: `Campaign Invite: ${campaign.name || "Campaign"}`,
                message: `${sender.username || "DM"} invited you to join "${campaign.name || "a campaign"}".`,
                payload: {
                    campaignID: String(campaign._id),
                    campaignName: campaign.name || "Campaign",
                    campaignJoinCode: campaign.joinCode || "",
                    invitedByID: String(sender._id),
                    invitedByName: sender.username || "",
                },
                status: "pending",
                readBy: [],
            });

            respond({
                success: true,
                inviteSent: true,
                invitedPlayer: {
                    _id: inviteeID,
                    username: invitee.username || username,
                },
                messageID: String(createdInvite._id),
            });
        } catch (error) {
            console.error("[campaign_invitePlayer] failed", error);
            respond({ success: false, message: error.message || "Failed to invite player" });
        }
    });

    socket.on("campaign_saveGame", async (data, callback) => {
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

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can create saves",
                });
            }

            const now = new Date();
            const fallbackName = `Save ${now.toISOString().replace("T", " ").slice(0, 19)}`;
            const name = sanitizeText(data?.name, 120) || fallbackName;
            const description = sanitizeText(data?.description, 1000);
            const snapshot = toPlainObject(data?.snapshot);
            const metadata = toPlainObject(data?.metadata);
            const isAutoSave = Boolean(data?.isAutoSave);
            const makeActive = Boolean(data?.makeActive);

            const gameSave = await GameSave.create({
                campaignId: campaign._id,
                name,
                description,
                savedBy: playerID,
                snapshot,
                metadata,
                isAutoSave,
            });

            campaign.gameSaves.addToSet(gameSave._id);
            if (makeActive || !campaign.activeGameSave) {
                campaign.activeGameSave = gameSave._id;
            }
            await campaign.save();

            respond({
                success: true,
                gameSave: formatGameSave(gameSave),
                campaignID: String(campaign._id),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
            });
        } catch (error) {
            console.error("[campaign_saveGame] failed", error);
            respond({ success: false, message: error.message || "Failed to save campaign state" });
        }
    });

    socket.on("campaign_listGameSaves", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({ success: false, message: "Valid playerID and campaignID are required" });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId players activeGameSave");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view saves",
                });
            }

            const gameSaves = await GameSave.find({ campaignId: campaign._id })
                .sort({ updatedAt: -1 })
                .limit(100);

            respond({
                success: true,
                gameSaves: gameSaves.map((save) => formatGameSave(save)).filter(Boolean),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
                campaignID: String(campaign._id),
            });
        } catch (error) {
            console.error("[campaign_listGameSaves] failed", error);
            respond({ success: false, message: error.message || "Failed to list campaign saves" });
        }
    });

    socket.on("campaign_loadGame", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, gameSaveID } = data || {};

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(gameSaveID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and gameSaveID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID);
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can load saves",
                });
            }

            const gameSave = await GameSave.findOne({
                _id: gameSaveID,
                campaignId: campaign._id,
            });
            if (!gameSave) {
                return respond({ success: false, message: "Game save not found for this campaign" });
            }

            campaign.gameSaves.addToSet(gameSave._id);
            campaign.activeGameSave = gameSave._id;
            await campaign.save();

            respond({
                success: true,
                gameSave: formatGameSave(gameSave),
                snapshot: toPlainObject(gameSave.snapshot),
                campaignID: String(campaign._id),
                gameID: String(campaign._id),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
            });
        } catch (error) {
            console.error("[campaign_loadGame] failed", error);
            respond({ success: false, message: error.message || "Failed to load game save" });
        }
    });
};
