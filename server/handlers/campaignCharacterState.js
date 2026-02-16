const CAMPAIGN_CHARACTER_STATE_FIELDS = [
    "level",
    "experience",
    "HP",
    "MP",
    "STA",
    "water",
    "food",
    "stats",
    "skills",
    "inv",
    "effects",
    "actions",
];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const isPlainObject = (value) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toObjectIdString = (value) => {
    if (!value) return "";
    if (typeof value === "object" && value._id) return String(value._id);
    return String(value);
};

const cloneValue = (value) => {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
};

const sanitizeCampaignStatePatch = (rawPatch) => {
    const patch = isPlainObject(rawPatch) ? rawPatch : {};
    const sanitized = {};

    CAMPAIGN_CHARACTER_STATE_FIELDS.forEach((field) => {
        if (!hasOwn(patch, field)) return;
        sanitized[field] = cloneValue(patch[field]);
    });

    return sanitized;
};

const extractCampaignStateFromCharacter = (characterDocOrObject) => {
    const source = characterDocOrObject?.toObject
        ? characterDocOrObject.toObject()
        : characterDocOrObject;
    return sanitizeCampaignStatePatch(source);
};

const findCampaignCharacterState = (campaignDocOrObject, characterID) => {
    const targetCharacterID = toObjectIdString(characterID);
    if (!targetCharacterID) return null;

    const entries = Array.isArray(campaignDocOrObject?.characterStates)
        ? campaignDocOrObject.characterStates
        : [];

    return (
        entries.find(
            (entry) => toObjectIdString(entry?.characterId) === targetCharacterID
        ) || null
    );
};

const upsertCampaignCharacterState = (
    campaignDocOrObject,
    { characterID, playerID, statePatch = {}, replace = false } = {}
) => {
    const targetCharacterID = toObjectIdString(characterID);
    if (!targetCharacterID || !campaignDocOrObject) return null;

    if (!Array.isArray(campaignDocOrObject.characterStates)) {
        campaignDocOrObject.characterStates = [];
    }

    const cleanedPatch = sanitizeCampaignStatePatch(statePatch);
    const now = new Date();
    const existingIndex = campaignDocOrObject.characterStates.findIndex(
        (entry) => toObjectIdString(entry?.characterId) === targetCharacterID
    );

    if (existingIndex >= 0) {
        const existingEntry = campaignDocOrObject.characterStates[existingIndex];
        const nextState = replace
            ? cleanedPatch
            : {
                  ...(isPlainObject(existingEntry?.state) ? existingEntry.state : {}),
                  ...cleanedPatch,
              };

        campaignDocOrObject.characterStates[existingIndex] = {
            ...existingEntry,
            playerId: playerID || existingEntry?.playerId || null,
            state: nextState,
            updatedAt: now,
            createdAt: existingEntry?.createdAt || now,
        };

        return campaignDocOrObject.characterStates[existingIndex];
    }

    const createdEntry = {
        characterId: characterID,
        playerId: playerID || null,
        state: cleanedPatch,
        createdAt: now,
        updatedAt: now,
    };
    campaignDocOrObject.characterStates.push(createdEntry);
    return createdEntry;
};

const mergeCharacterWithCampaignState = (characterDocOrObject, stateEntryOrState) => {
    const baseCharacter = characterDocOrObject?.toObject
        ? characterDocOrObject.toObject()
        : cloneValue(characterDocOrObject);
    if (!isPlainObject(baseCharacter)) return null;

    const candidateState = isPlainObject(stateEntryOrState?.state)
        ? stateEntryOrState.state
        : stateEntryOrState;
    const state = isPlainObject(candidateState) ? candidateState : {};
    const merged = { ...baseCharacter };

    CAMPAIGN_CHARACTER_STATE_FIELDS.forEach((field) => {
        if (!hasOwn(state, field)) return;
        merged[field] = cloneValue(state[field]);
    });

    return merged;
};

module.exports = {
    CAMPAIGN_CHARACTER_STATE_FIELDS,
    toObjectIdString,
    sanitizeCampaignStatePatch,
    extractCampaignStateFromCharacter,
    findCampaignCharacterState,
    upsertCampaignCharacterState,
    mergeCharacterWithCampaignState,
};
