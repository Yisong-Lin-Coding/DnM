const mongoose = require("mongoose");
const Campaign = require("../data/mongooseDataStructure/campaign");
const Character = require("../data/mongooseDataStructure/character");
const CharacterBuilder = require("../worldEngine/Character/characterbuilder");
const {
    toObjectIdString,
    findCampaignCharacterState,
    upsertCampaignCharacterState,
    extractCampaignStateFromCharacter,
    mergeCharacterWithCampaignState,
} = require("../handlers/campaignCharacterState");

const safeCallback = (callback) => (typeof callback === "function" ? callback : () => {});

const isCampaignMember = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    if (toObjectIdString(campaign.dmId) === normalizedPlayerID) return true;
    return Array.isArray(campaign.players)
        ? campaign.players.some((memberID) => toObjectIdString(memberID) === normalizedPlayerID)
        : false;
};

const isCampaignDM = (campaign, playerID) =>
    toObjectIdString(campaign?.dmId) === String(playerID || "");

const isCharacterInCampaign = (campaign, characterID) => {
    const targetCharacterID = toObjectIdString(characterID);
    if (!targetCharacterID || !campaign) return false;

    const hasAssignment = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments.some(
              (assignment) =>
                  toObjectIdString(assignment?.characterId) === targetCharacterID
          )
        : false;
    if (hasAssignment) return true;

    return Boolean(findCampaignCharacterState(campaign, targetCharacterID));
};

const parseRequestedCampaignID = (contextKey, campaignID) => {
    if (campaignID && mongoose.isValidObjectId(campaignID)) return String(campaignID);

    const key = String(contextKey || "").trim();
    if (!key.toLowerCase().startsWith("campaign:")) return "";

    const parsed = key.slice("campaign:".length).trim();
    return mongoose.isValidObjectId(parsed) ? parsed : "";
};

module.exports = (socket) => {
    socket.on("character_getViewContexts", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(characterID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and characterID are required",
                });
            }

            const character = await Character.findById(characterID).select("_id name playerId");
            if (!character) {
                return respond({ success: false, message: "Character not found" });
            }

            const ownerPlayerID = toObjectIdString(character.playerId);
            const canViewBase = ownerPlayerID === String(playerID);

            const campaignDocs = await Campaign.find({
                $and: [
                    { $or: [{ dmId: playerID }, { players: playerID }] },
                    {
                        $or: [
                            { characterAssignments: { $elemMatch: { characterId: character._id } } },
                            { characterStates: { $elemMatch: { characterId: character._id } } },
                        ],
                    },
                ],
            })
                .select("_id name dmId players characterAssignments characterStates")
                .sort({ name: 1, createdAt: 1 })
                .lean();

            const campaignContexts = campaignDocs
                .filter((campaign) => isCharacterInCampaign(campaign, character._id))
                .map((campaign) => ({
                    key: `campaign:${String(campaign._id)}`,
                    type: "campaign",
                    campaignID: String(campaign._id),
                    campaignName: campaign.name || "Campaign",
                    campaignRole: isCampaignDM(campaign, playerID) ? "dm" : "member",
                }));

            if (!canViewBase && campaignContexts.length === 0) {
                return respond({
                    success: false,
                    message: "You do not have permission to view this character",
                });
            }

            const contexts = [];
            if (canViewBase) {
                contexts.push({
                    key: "base",
                    type: "base",
                    campaignID: "",
                    campaignName: "Base Character",
                    campaignRole: "owner",
                });
            }
            contexts.push(...campaignContexts);

            const defaultContextKey = canViewBase
                ? "base"
                : contexts[0]?.key || "";

            respond({
                success: true,
                contexts,
                defaultContextKey,
                canViewBase,
                canEditBase: canViewBase,
                characterSummary: {
                    _id: String(character._id),
                    name: character.name || "Unnamed Character",
                    ownerPlayerID,
                },
            });
        } catch (error) {
            console.error("[character_getViewContexts] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load character view contexts",
            });
        }
    });

    socket.on("character_getViewData", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, characterID, contextKey = "", campaignID = "" } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(characterID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and characterID are required",
                });
            }

            const baseCharacter = await Character.findById(characterID);
            if (!baseCharacter) {
                return respond({ success: false, message: "Character not found" });
            }

            const ownerPlayerID = toObjectIdString(baseCharacter.playerId);
            const canViewBase = ownerPlayerID === String(playerID);
            const canEditBase = canViewBase;
            const requestedCampaignID = parseRequestedCampaignID(contextKey, campaignID);

            let resolvedCharacterData = null;
            let resolvedContext = null;
            let canSaveCampaignState = false;

            if (requestedCampaignID) {
                const campaign = await Campaign.findById(requestedCampaignID).select(
                    "_id name dmId players characterAssignments characterStates"
                );
                if (!campaign) {
                    return respond({ success: false, message: "Campaign not found" });
                }

                if (!isCampaignMember(campaign, playerID)) {
                    return respond({
                        success: false,
                        message: "You are not a member of this campaign",
                    });
                }

                if (!isCharacterInCampaign(campaign, baseCharacter._id)) {
                    return respond({
                        success: false,
                        message: "Character is not part of this campaign",
                    });
                }

                let stateEntry = findCampaignCharacterState(campaign, baseCharacter._id);
                if (!stateEntry) {
                    upsertCampaignCharacterState(campaign, {
                        characterID: baseCharacter._id,
                        playerID: ownerPlayerID || null,
                        statePatch: extractCampaignStateFromCharacter(baseCharacter),
                        replace: true,
                    });
                    campaign.markModified("characterStates");
                    await campaign.save();
                    stateEntry = findCampaignCharacterState(campaign, baseCharacter._id);
                }

                resolvedCharacterData = mergeCharacterWithCampaignState(
                    baseCharacter,
                    stateEntry?.state || {}
                );
                resolvedContext = {
                    key: `campaign:${String(campaign._id)}`,
                    type: "campaign",
                    campaignID: String(campaign._id),
                    campaignName: campaign.name || "Campaign",
                };
                canSaveCampaignState =
                    isCampaignDM(campaign, playerID) || ownerPlayerID === String(playerID);
            } else {
                if (!canViewBase) {
                    return respond({
                        success: false,
                        message: "Only the character owner can view base character data",
                    });
                }

                resolvedCharacterData = baseCharacter.toObject();
                resolvedContext = {
                    key: "base",
                    type: "base",
                    campaignID: "",
                    campaignName: "Base Character",
                };
                canSaveCampaignState = false;
            }

            if (!resolvedCharacterData) {
                return respond({
                    success: false,
                    message: "Failed to resolve character data for this context",
                });
            }

            const builder = new CharacterBuilder(socket);
            builder.loadCharacterData(resolvedCharacterData);
            const builtCharacter = await builder.build(resolvedCharacterData);

            respond({
                success: true,
                context: resolvedContext,
                rawCharacter: resolvedCharacterData,
                builtCharacter,
                canViewBase,
                canEditBase,
                canSaveCampaignState,
                ownerPlayerID,
            });
        } catch (error) {
            console.error("[character_getViewData] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load character data",
            });
        }
    });
};
