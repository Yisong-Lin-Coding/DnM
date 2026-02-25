const mongoose = require("mongoose");
const Campaign = require("../data/mongooseDataStructure/campaign");
const GameSave = require("../data/mongooseDataStructure/gameSave");
const Player = require("../data/mongooseDataStructure/player");
const Messages = require("../data/mongooseDataStructure/messages");
const Character = require("../data/mongooseDataStructure/character");
const Enemy = require("../data/mongooseDataStructure/enemy");
const CharacterBuilder = require("../worldEngine/Character/characterbuilder");
const rawFloorTypes = require("../data/gameFiles/modifiers/floorTypes");
const {
    normalizeFloorTypeCollection,
    createEngineState,
    updateEngineState,
    applyObjectHPDelta,
} = require("../worldEngine/campaignGameEngine");
const {
    sanitizeCampaignStatePatch,
    extractCampaignStateFromCharacter,
    findCampaignCharacterState,
    upsertCampaignCharacterState,
    toObjectIdString,
} = require("../handlers/campaignCharacterState");

const MIN_ALLOWED_PLAYERS = 2;
const MAX_ALLOWED_PLAYERS = 12;
const DEFAULT_MAX_PLAYERS = 6;
const DEFAULT_CHARACTER_MOVEMENT = 30;
const MAX_AUTO_SAVE_HISTORY = 5;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const GAME_ROOM_PREFIX = "campaign_game_room";
const GAME_PLAYER_ROOM_SUFFIX = "players";
const GAME_DM_ROOM_SUFFIX = "dm";

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

const toPlainObject = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
};

const FLOOR_TYPES = normalizeFloorTypeCollection(rawFloorTypes);
const campaignRuntimeStateByID = new Map();

const getCampaignGameRoom = (campaignID) => `${GAME_ROOM_PREFIX}:${String(campaignID || "")}`;
const getCampaignPlayersRoom = (campaignID) =>
    `${GAME_ROOM_PREFIX}:${GAME_PLAYER_ROOM_SUFFIX}:${String(campaignID || "")}`;
const getCampaignDMRoom = (campaignID) =>
    `${GAME_ROOM_PREFIX}:${GAME_DM_ROOM_SUFFIX}:${String(campaignID || "")}`;

const cloneEngineState = (state) => ({
    campaignID: String(state?.campaignID || ""),
    revision: Number(state?.revision) || 0,
    updatedAt: Number(state?.updatedAt) || Date.now(),
    snapshot: (() => {
        try {
            return JSON.parse(JSON.stringify(toPlainObject(state?.snapshot)));
        } catch {
            return toPlainObject(state?.snapshot);
        }
    })(),
});

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeAngle = (value) => {
    let angle = Number(value) || 0;
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
};

const normalizeTerrainType = (value) => {
    const terrain = String(value || "")
        .trim()
        .toLowerCase();
    if (terrain === "floor" || terrain === "wall" || terrain === "obstacle") {
        return terrain;
    }
    return "obstacle";
};

const isLightBlockingObject = (obj = {}) =>
    normalizeTerrainType(obj?.terrainType) !== "floor";

const buildMapGeometry = (snapshot = {}) => {
    const mapObjects = Array.isArray(snapshot?.mapObjects) ? snapshot.mapObjects : [];
    return mapObjects.filter((obj) => isLightBlockingObject(obj));
};

const readCampaignSetting = (campaign, key) => {
    if (!campaign || !key) return undefined;
    const settings = campaign.settings;
    if (!settings) return undefined;
    if (typeof settings.get === "function") {
        return settings.get(key);
    }
    return settings[key];
};

const normalizeFovMode = (value) => {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    if (normalized === "perplayer" || normalized === "player") return "perPlayer";
    return "party";
};

const getCampaignFovMode = (campaign) =>
    normalizeFovMode(readCampaignSetting(campaign, "fovMode"));

const getAssignedCharacterIDsForPlayer = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return [];
    const assignments = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments
        : [];
    const ids = new Set();
    assignments.forEach((assignment) => {
        if (toObjectIdString(assignment?.playerId) !== normalizedPlayerID) return;
        const characterID = toObjectIdString(assignment?.characterId);
        if (characterID) ids.add(characterID);
    });
    return Array.from(ids);
};

const isPointInFOV = (source = {}, point = {}) => {
    const sourcePos = source?.position || {};
    const sx = toNumber(sourcePos.x, 0);
    const sy = toNumber(sourcePos.y, 0);
    const dx = toNumber(point.x, 0) - sx;
    const dy = toNumber(point.y, 0) - sy;
    const maxDistance = Math.max(1, toNumber(source.visionDistance, 150));
    if (dx * dx + dy * dy > maxDistance * maxDistance) return false;

    const arc = Math.max(0, Math.min(360, toNumber(source.visionArc, 90)));
    if (arc >= 360) return true;

    const angleToPoint = (Math.atan2(dy, dx) * 180) / Math.PI;
    const diff = normalizeAngle(angleToPoint - toNumber(source.rotation, 0));
    return Math.abs(diff) <= arc / 2;
};

const getObjectSamplePoints = (obj = {}) => {
    const type = String(obj?.type || "circle").toLowerCase();
    const x = toNumber(obj?.x, 0);
    const y = toNumber(obj?.y, 0);

    if (type === "rect") {
        const halfW = Math.max(1, toNumber(obj?.width, 50)) / 2;
        const halfH = Math.max(1, toNumber(obj?.height, 40)) / 2;
        return [
            { x, y },
            { x: x - halfW, y: y - halfH },
            { x: x + halfW, y: y - halfH },
            { x: x + halfW, y: y + halfH },
            { x: x - halfW, y: y + halfH },
        ];
    }

    if (type === "triangle") {
        const size = Math.max(1, toNumber(obj?.size, 30));
        return [
            { x, y },
            { x, y: y - size },
            { x: x - size, y: y + size },
            { x: x + size, y: y + size },
        ];
    }

    const radius = Math.max(1, toNumber(obj?.size, 30));
    return [
        { x, y },
        { x: x + radius, y },
        { x: x - radius, y },
        { x, y: y + radius },
        { x, y: y - radius },
    ];
};

const resolveFovSources = (characters = [], options = {}) => {
    const sources = [];
    const sourceIdSet = new Set();
    const explicitSourceIds = Array.isArray(options.sourceIds) ? options.sourceIds : null;
    if (explicitSourceIds && explicitSourceIds.length > 0) {
        explicitSourceIds.forEach((entry) => {
            const normalized = String(entry || "").trim();
            if (normalized) sourceIdSet.add(normalized);
        });
        characters.forEach((char) => {
            const charId = String(char?.id ?? "");
            if (sourceIdSet.has(charId)) sources.push(char);
        });
        return { sources, sourceIdSet };
    }

    const explicitSources = Array.isArray(options.sources) ? options.sources : null;
    if (explicitSources && explicitSources.length > 0) {
        explicitSources.forEach((char) => {
            if (!char) return;
            const charId = String(char?.id ?? "");
            if (charId) sourceIdSet.add(charId);
            sources.push(char);
        });
        return { sources, sourceIdSet };
    }

    const normalizedTeam = String(options.viewerTeam || "player").toLowerCase();
    characters.forEach((char) => {
        if (String(char?.team || "player").toLowerCase() !== normalizedTeam) return;
        sources.push(char);
        const charId = String(char?.id ?? "");
        if (charId) sourceIdSet.add(charId);
    });

    return { sources, sourceIdSet };
};

const filterSnapshotForFOV = (snapshot = {}, options = {}) => {
    const safeSnapshot = toPlainObject(snapshot);
    const characters = Array.isArray(safeSnapshot.characters) ? safeSnapshot.characters : [];
    const mapObjects = Array.isArray(safeSnapshot.mapObjects) ? safeSnapshot.mapObjects : [];
    const mapGeometry = buildMapGeometry(safeSnapshot);
    const { sources: fovSources, sourceIdSet } = resolveFovSources(characters, options);
    if (fovSources.length === 0) {
        return {
            ...safeSnapshot,
            mapGeometry,
            characters: [],
            mapObjects: [],
        };
    }

    const isVisiblePoint = (point) => fovSources.some((source) => isPointInFOV(source, point));
    const isVisibleObject = (obj) =>
        getObjectSamplePoints(obj).some((point) => isVisiblePoint(point));

    const filteredMapObjects = mapObjects.filter((obj) => isVisibleObject(obj));
    const filteredCharacters = characters.filter((char) => {
        const charId = String(char?.id ?? "");
        if (sourceIdSet.has(charId)) return true;
        const pos = char?.position || {};
        return isVisiblePoint({ x: toNumber(pos.x, 0), y: toNumber(pos.y, 0) });
    });

    return {
        ...safeSnapshot,
        mapGeometry,
        characters: filteredCharacters,
        mapObjects: filteredMapObjects,
    };
};

const filterSnapshotForPlayer = (snapshot = {}, campaign, playerID) => {
    const mode = getCampaignFovMode(campaign);
    if (mode === "perPlayer") {
        const sourceIds = getAssignedCharacterIDsForPlayer(campaign, playerID);
        return filterSnapshotForFOV(snapshot, { sourceIds, viewerTeam: "player" });
    }
    return filterSnapshotForFOV(snapshot, { viewerTeam: "player" });
};

const buildPlayerPayload = (payload, snapshot) => ({
    ...payload,
    snapshot,
    engineState: {
        ...payload.engineState,
        snapshot,
    },
});

const buildPlayerPayloadForPlayer = (payload, campaign, playerID, options = {}) => {
    const filteredSnapshot = filterSnapshotForPlayer(
        payload?.engineState?.snapshot || {},
        campaign,
        playerID
    );
    let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
    if (typeof options.transform === "function") {
        playerPayload = options.transform(playerPayload, filteredSnapshot, playerID);
    }
    return playerPayload;
};

const emitPlayerStateUpdate = async (socket, campaign, payload, options = {}) => {
    if (!socket || !campaign || !payload?.engineState) return;
    const playersRoom = getCampaignPlayersRoom(campaign._id);
    const fovMode = getCampaignFovMode(campaign);
    const baseSnapshot = payload.engineState.snapshot || {};

    const sendPayload = (clientSocket, playerID) => {
        const filteredSnapshot =
            fovMode === "perPlayer"
                ? filterSnapshotForPlayer(baseSnapshot, campaign, playerID)
                : filterSnapshotForFOV(baseSnapshot, { viewerTeam: "player" });
        let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
        if (typeof options.transform === "function") {
            playerPayload = options.transform(playerPayload, filteredSnapshot, playerID);
        }
        clientSocket.emit("campaign_gameStateUpdated", playerPayload);
    };

    if (fovMode === "perPlayer" && socket.server && typeof socket.server.in === "function") {
        try {
            const sockets = await socket.server.in(playersRoom).fetchSockets();
            if (Array.isArray(sockets) && sockets.length > 0) {
                sockets.forEach((clientSocket) => {
                    if (clientSocket.id === socket.id) return;
                    sendPayload(clientSocket, clientSocket.data?.playerID);
                });
                return;
            }
        } catch (error) {
            // Fall back to party broadcast below.
        }
    }

    const filteredSnapshot = filterSnapshotForFOV(baseSnapshot, { viewerTeam: "player" });
    let playerPayload = buildPlayerPayload(payload, filteredSnapshot);
    if (typeof options.transform === "function") {
        playerPayload = options.transform(playerPayload, filteredSnapshot, null);
    }
    socket.to(playersRoom).emit("campaign_gameStateUpdated", playerPayload);
};

const getCharacterNameFromAssignment = (assignment = {}) => {
    if (assignment?.characterName) return assignment.characterName;
    if (assignment?.character?.name) return assignment.character.name;
    if (assignment?.characterId && typeof assignment.characterId === "object") {
        return assignment.characterId?.name || "";
    }
    return "";
};

const extractHPFromState = (stateEntry = {}) => {
    const hp = toPlainObject(stateEntry?.state?.HP || stateEntry?.HP || {});
    const maxHP = toNumber(hp.max, NaN);
    const currentHP = toNumber(hp.current, NaN);

    return {
        maxHP: Number.isFinite(maxHP) ? Math.max(1, Math.round(maxHP)) : null,
        hp: Number.isFinite(currentHP) ? Math.max(0, Math.round(currentHP)) : null,
    };
};

const ensureCampaignCharactersInSnapshot = async (campaign, runtimeState) => {
    if (!campaign || !runtimeState?.snapshot) return false;
    const assignments = Array.isArray(campaign.characterAssignments)
        ? campaign.characterAssignments
        : [];
    if (assignments.length === 0) return false;

    if (!Array.isArray(runtimeState.snapshot.characters)) {
        runtimeState.snapshot.characters = [];
    }

    const existingById = new Map();
    runtimeState.snapshot.characters.forEach((token, index) => {
        const tokenId = String(token?.id ?? "");
        if (!tokenId || existingById.has(tokenId)) return;
        existingById.set(tokenId, { token, index });
    });

    const missingNameIds = [];
    assignments.forEach((assignment) => {
        const characterId = toObjectIdString(assignment?.characterId);
        if (!characterId) return;
        const name = getCharacterNameFromAssignment(assignment);
        if (!name && mongoose.isValidObjectId(characterId)) {
            missingNameIds.push(characterId);
        }
    });

    const nameLookup = new Map();
    if (missingNameIds.length > 0) {
        const uniqueIds = Array.from(new Set(missingNameIds));
        const docs = await Character.find({ _id: { $in: uniqueIds } }).select("_id name");
        docs.forEach((doc) => {
            const id = toObjectIdString(doc?._id);
            if (id && doc?.name) {
                nameLookup.set(id, doc.name);
            }
        });
    }

    let changed = false;

    assignments.forEach((assignment) => {
        const characterId = toObjectIdString(assignment?.characterId);
        if (!characterId) return;

        const assignmentName =
            getCharacterNameFromAssignment(assignment) ||
            nameLookup.get(characterId) ||
            "Character";

        const stateEntry = findCampaignCharacterState(campaign, characterId);
        const { hp, maxHP } = extractHPFromState(stateEntry);

        const existing = existingById.get(characterId);
        if (existing) {
            const token = existing.token;
            let tokenChanged = false;

            if (assignmentName && token?.name !== assignmentName) {
                token.name = assignmentName;
                tokenChanged = true;
            }
            const currentTeam = String(token?.team || "").toLowerCase();
            if (!currentTeam || currentTeam === "neutral") {
                token.team = "player";
                tokenChanged = true;
            }
            if (!token?.kind) {
                token.kind = "character";
                tokenChanged = true;
            }
            if (maxHP != null && token?.maxHP !== maxHP) {
                token.maxHP = maxHP;
                tokenChanged = true;
            }
            if (hp != null && token?.hp !== hp) {
                token.hp = hp;
                tokenChanged = true;
            }
            if (!Number.isFinite(Number(token?.movement))) {
                token.movement = DEFAULT_CHARACTER_MOVEMENT;
                tokenChanged = true;
            }

            if (tokenChanged) changed = true;
            return;
        }

        const token = {
            id: characterId,
            name: assignmentName,
            position: { x: 0, y: 0 },
            size: 30,
            visionDistance: 150,
            rotation: 0,
            visionArc: 90,
            movement: DEFAULT_CHARACTER_MOVEMENT,
            team: "player",
            kind: "character",
        };
        if (maxHP != null) token.maxHP = maxHP;
        if (hp != null) token.hp = hp;

        runtimeState.snapshot.characters.push(token);
        changed = true;
    });

    if (changed) {
        runtimeState.revision = Number(runtimeState.revision) + 1;
        runtimeState.updatedAt = Date.now();
    }

    return changed;
};

const getOrCreateRuntimeState = (campaignID, snapshot = {}) => {
    const key = String(campaignID || "");
    if (!key) return createEngineState("", snapshot);

    if (!campaignRuntimeStateByID.has(key)) {
        campaignRuntimeStateByID.set(key, createEngineState(key, snapshot));
    }

    return campaignRuntimeStateByID.get(key);
};

const replaceRuntimeState = (campaignID, snapshot = {}) => {
    const key = String(campaignID || "");
    const nextState = createEngineState(key, snapshot);
    campaignRuntimeStateByID.set(key, nextState);
    return nextState;
};

const isCampaignMember = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;

    if (toObjectIdString(campaign.dmId) === normalizedPlayerID) return true;
    return (campaign.players || []).some(
        (memberID) => toObjectIdString(memberID) === normalizedPlayerID
    );
};

const isCampaignDM = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return toObjectIdString(campaign.dmId) === normalizedPlayerID;
};

const isCampaignBanned = (campaign, playerID) => {
    const normalizedPlayerID = String(playerID || "");
    if (!normalizedPlayerID || !campaign) return false;
    return (campaign.bannedPlayers || []).some(
        (bannedID) => toObjectIdString(bannedID) === normalizedPlayerID
    );
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
    const campaignStatesByCharacterID = new Map();
    if (Array.isArray(campaign.characterStates)) {
        campaign.characterStates.forEach((stateEntry) => {
            const characterID = toObjectIdString(stateEntry?.characterId);
            if (!characterID || campaignStatesByCharacterID.has(characterID)) return;
            campaignStatesByCharacterID.set(characterID, toPlainObject(stateEntry?.state));
        });
    }

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
            const campaignState = campaignStatesByCharacterID.get(characterID);
            const campaignStateLevel = Number(campaignState?.level);

            characterAssignments.set(playerID, {
                playerId: playerID,
                playerName: playerRef?.username || "",
                characterId: characterID,
                characterName: characterRef?.name || "",
                characterLevel: Number.isFinite(campaignStateLevel)
                    ? campaignStateLevel
                    : Number(characterRef?.level) || null,
                hasCampaignState: Boolean(campaignState),
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
        fovMode: getCampaignFovMode(campaign),
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

const formatEnemy = (enemyDoc) => {
    const enemy = enemyDoc?.toObject ? enemyDoc.toObject() : enemyDoc;
    if (!enemy) return null;

    return {
        _id: String(enemy._id),
        campaignId: toObjectIdString(enemy.campaignId),
        name: enemy.name || "Enemy",
        kind: enemy.kind || "enemy",
        level: Number(enemy.level) || 1,
        HP: enemy.HP || { current: 0, max: 0, temp: 0 },
        MP: enemy.MP || { current: 0, max: 0, temp: 0 },
        STA: enemy.STA || { current: 0, max: 0, temp: 0 },
        size: Number(enemy.size) || 30,
        visionDistance: Number(enemy.visionDistance) || 150,
        visionArc: Number(enemy.visionArc) || 90,
        rotation: Number(enemy.rotation) || 0,
        notes: enemy.notes || "",
        createdAt: enemy.createdAt || null,
        updatedAt: enemy.updatedAt || null,
    };
};

const normalizeEnemyInput = (raw = {}) => {
    const name = sanitizeText(raw.name, 120) || "Enemy";
    const level = clamp(Math.round(toNumber(raw.level, 1)), 1, 60);
    const maxHP = clamp(Math.round(toNumber(raw.maxHP ?? raw.HP?.max, 10)), 1, 100000);
    const currentHP = clamp(Math.round(toNumber(raw.hp ?? raw.HP?.current, maxHP)), 0, maxHP);
    const tempHP = clamp(Math.round(toNumber(raw.HP?.temp, 0)), 0, maxHP);

    return {
        name,
        kind: sanitizeText(raw.kind || "enemy", 40) || "enemy",
        level,
        HP: {
            current: currentHP,
            max: maxHP,
            temp: tempHP,
        },
        MP: {
            current: clamp(Math.round(toNumber(raw.MP?.current, 0)), 0, 100000),
            max: clamp(Math.round(toNumber(raw.MP?.max, 0)), 0, 100000),
            temp: clamp(Math.round(toNumber(raw.MP?.temp, 0)), 0, 100000),
        },
        STA: {
            current: clamp(Math.round(toNumber(raw.STA?.current, 0)), 0, 100000),
            max: clamp(Math.round(toNumber(raw.STA?.max, 0)), 0, 100000),
            temp: clamp(Math.round(toNumber(raw.STA?.temp, 0)), 0, 100000),
        },
        size: clamp(Math.round(toNumber(raw.size, 30)), 8, 300),
        visionDistance: clamp(Math.round(toNumber(raw.visionDistance, 150)), 10, 5000),
        visionArc: clamp(Math.round(toNumber(raw.visionArc, 90)), 10, 360),
        rotation: toNumber(raw.rotation, 0),
        notes: sanitizeText(raw.notes, 1000),
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

            const isDM = isCampaignDM(campaign, playerID);
            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            socket.data.playerID = String(playerID);
            socket.data.campaignID = String(campaign._id);
            socket.data.isDM = isDM;
            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            const engineState = cloneEngineState(runtimeState);
            let filteredSnapshot = toPlainObject(engineState.snapshot);
            if (!isDM) {
                filteredSnapshot = filterSnapshotForPlayer(engineState.snapshot, campaign, playerID);
                engineState.snapshot = filteredSnapshot;
            }

            respond({
                success: true,
                campaign: formatCampaign(campaign),
                permissions: {
                    isDM,
                    canEditWorld: isDM,
                },
                activeGameSave,
                floorTypes: FLOOR_TYPES,
                engineState,
                snapshot: filteredSnapshot,
            });
        } catch (error) {
            console.error("[campaign_getGameContext] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load game context",
            });
        }
    });

    socket.on("campaign_gameRequestState", async (data, callback) => {
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
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can access game state",
                });
            }

            let snapshot = {};
            if (campaign.activeGameSave && mongoose.isValidObjectId(campaign.activeGameSave)) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            socket.join(getCampaignGameRoom(campaign._id));
            const isDM = isCampaignDM(campaign, playerID);
            socket.data.playerID = String(playerID);
            socket.data.campaignID = String(campaign._id);
            socket.data.isDM = isDM;
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            const engineState = cloneEngineState(runtimeState);
            if (!isDM) {
                engineState.snapshot = filterSnapshotForPlayer(engineState.snapshot, campaign, playerID);
            }

            respond({
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            });
        } catch (error) {
            console.error("[campaign_gameRequestState] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load runtime game state",
            });
        }
    });

    socket.on("campaign_gameSyncWorld", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, statePatch } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can sync world state",
                });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            updateEngineState(runtimeState, statePatch);

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
            };
            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            respond(payload);
        } catch (error) {
            console.error("[campaign_gameSyncWorld] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to sync world state",
            });
        }
    });

    socket.on("campaign_gameDamageObject", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, objectID, amount } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can modify objects",
                });
            }
            const isDM = isCampaignDM(campaign, playerID);

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            const damageAmount = Math.round(Number(amount) || 0);
            if (!Number.isFinite(damageAmount) || damageAmount === 0) {
                return respond({
                    success: false,
                    message: "Damage amount must be a non-zero number",
                });
            }

            const result = applyObjectHPDelta(runtimeState, objectID, damageAmount);
            if (!result?.success) {
                return respond({
                    success: false,
                    message: result?.message || "Failed to apply object HP update",
                });
            }

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                object: result.object || null,
            };
            const transformPayload = (playerPayload, filteredSnapshot) => {
                const objectIsVisible = (filteredSnapshot.mapObjects || []).some(
                    (obj) => String(obj?.id ?? "") === String(result.object?.id ?? "")
                );
                return {
                    ...playerPayload,
                    object: objectIsVisible ? result.object || null : null,
                };
            };
            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }
            await emitPlayerStateUpdate(socket, campaign, payload, { transform: transformPayload });
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);
            respond(
                isDM
                    ? payload
                    : buildPlayerPayloadForPlayer(payload, campaign, playerID, {
                          transform: transformPayload,
                      })
            );
        } catch (error) {
            console.error("[campaign_gameDamageObject] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to modify object HP",
            });
        }
    });

    socket.on("campaign_moveCharacter", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};
        const positionPatch = toPlainObject(data?.position);

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID) {
                return respond({
                    success: false,
                    message: "characterID is required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments characterStates settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can move characters",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM && !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "characterID must be a valid character id",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => toObjectIdString(entry?.characterId) === normalizedCharacterID
                  ) || null
                : null;
            const stateEntry = assignment
                ? findCampaignCharacterState(campaign, normalizedCharacterID)
                : null;
            const { hp, maxHP } = extractHPFromState(stateEntry);

            if (!isDM) {
                const ownerID = toObjectIdString(assignment?.playerId);
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can move this character",
                    });
                }
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            let characterToken = runtimeState.snapshot.characters.find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );

            if (!characterToken) {
                let name = "Character";
                if (mongoose.isValidObjectId(normalizedCharacterID)) {
                    const characterDoc = await Character.findById(normalizedCharacterID).select(
                        "_id name"
                    );
                    if (characterDoc?.name) {
                        name = characterDoc.name;
                    }
                } else if (data?.name) {
                    name = sanitizeText(data.name, 120) || name;
                }

                const resolvedTeam = assignment ? "player" : String(data?.team || "neutral");
                characterToken = {
                    id: normalizedCharacterID,
                    name,
                    position: { x: 0, y: 0 },
                    size: 30,
                    visionDistance: 150,
                    rotation: 0,
                    visionArc: 90,
                    movement: DEFAULT_CHARACTER_MOVEMENT,
                    team: isDM ? resolvedTeam : "player",
                };
                if (maxHP != null) characterToken.maxHP = maxHP;
                if (hp != null) characterToken.hp = hp;
                runtimeState.snapshot.characters.push(characterToken);
            }

            if (!Number.isFinite(Number(characterToken?.movement))) {
                characterToken.movement = DEFAULT_CHARACTER_MOVEMENT;
            }

            const nextX = Math.round(toNumber(positionPatch?.x ?? data?.x, 0));
            const nextY = Math.round(toNumber(positionPatch?.y ?? data?.y, 0));
            characterToken.position = { x: nextX, y: nextY };

            if (data?.rotation != null) {
                characterToken.rotation = toNumber(data.rotation, characterToken.rotation || 0);
            }

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: normalizedCharacterID,
            };

            socket.join(getCampaignGameRoom(campaign._id));
            if (isDM) {
                socket.join(getCampaignDMRoom(campaign._id));
            } else {
                socket.join(getCampaignPlayersRoom(campaign._id));
            }

            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(
                isDM ? payload : buildPlayerPayloadForPlayer(payload, campaign, playerID)
            );
        } catch (error) {
            console.error("[campaign_moveCharacter] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to move character",
            });
        }
    });

    socket.on("campaign_setFovMode", async (data, callback) => {
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
                "_id dmId settings activeGameSave characterAssignments"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can change FOV mode",
                });
            }

            const nextMode = normalizeFovMode(data?.fovMode || data?.mode);
            if (campaign.settings && typeof campaign.settings.set === "function") {
                campaign.settings.set("fovMode", nextMode);
            } else {
                const nextSettings =
                    campaign.settings && typeof campaign.settings === "object"
                        ? { ...campaign.settings }
                        : {};
                nextSettings.fovMode = nextMode;
                campaign.settings = nextSettings;
            }

            await campaign.save();

            const runtimeKey = String(campaign._id || "");
            let runtimeState = null;
            if (campaignRuntimeStateByID.has(runtimeKey)) {
                runtimeState = getOrCreateRuntimeState(campaign._id, {});
            } else if (campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                const snapshot = saveDoc ? toPlainObject(saveDoc.snapshot) : {};
                if (saveDoc) {
                    runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
                }
            }

            if (runtimeState) {
                const payload = {
                    success: true,
                    campaignID: String(campaign._id),
                    floorTypes: FLOOR_TYPES,
                    engineState: cloneEngineState(runtimeState),
                    fovMode: nextMode,
                };
                socket.join(getCampaignGameRoom(campaign._id));
                socket.join(getCampaignDMRoom(campaign._id));
                await emitPlayerStateUpdate(socket, campaign, payload);
            }

            respond({
                success: true,
                campaignID: String(campaign._id),
                fovMode: nextMode,
            });
        } catch (error) {
            console.error("[campaign_setFovMode] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to update FOV mode",
            });
        }
    });

    socket.on("campaign_getCharacterActions", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID || !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Valid characterID is required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can view character actions",
                });
            }

            if (!isCharacterInCampaign(campaign, normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned to this campaign",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM) {
                const assignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (entry) =>
                              toObjectIdString(entry?.characterId) === normalizedCharacterID
                      ) || null
                    : null;
                const ownerID = toObjectIdString(assignment?.playerId);
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can view actions",
                    });
                }
            }

            const builder = new CharacterBuilder(socket);
            const character = await builder.buildFromId(normalizedCharacterID);
            if (!character) {
                return respond({
                    success: false,
                    message: "Failed to build character actions",
                });
            }

            respond({
                success: true,
                characterID: normalizedCharacterID,
                actions: Array.isArray(character.actions) ? character.actions : [],
                actionTree: character.getActionTree(),
            });
        } catch (error) {
            console.error("[campaign_getCharacterActions] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to load character actions",
            });
        }
    });

    socket.on("campaign_executeCharacterAction", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const normalizedCharacterID = String(characterID || "").trim();
            if (!normalizedCharacterID || !mongoose.isValidObjectId(normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Valid characterID is required",
                });
            }

            const actionRef = String(
                data?.actionPath || data?.actionId || data?.action || ""
            ).trim();
            if (!actionRef) {
                return respond({ success: false, message: "Action path is required" });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments characterStates settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can perform actions",
                });
            }

            if (!isCharacterInCampaign(campaign, normalizedCharacterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned to this campaign",
                });
            }

            const isDM = isCampaignDM(campaign, playerID);
            if (!isDM) {
                const assignment = Array.isArray(campaign.characterAssignments)
                    ? campaign.characterAssignments.find(
                          (entry) =>
                              toObjectIdString(entry?.characterId) === normalizedCharacterID
                      ) || null
                    : null;
                const ownerID = toObjectIdString(assignment?.playerId);
                if (!ownerID || ownerID !== String(playerID)) {
                    return respond({
                        success: false,
                        message: "Only the character owner or DM can perform this action",
                    });
                }
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            const characterToken = runtimeState.snapshot.characters.find(
                (char) => String(char?.id ?? "") === normalizedCharacterID
            );
            if (!characterToken) {
                return respond({
                    success: false,
                    message: "Character is not placed on the map yet",
                });
            }

            const builder = new CharacterBuilder(socket);
            const characterInstance = await builder.buildFromId(normalizedCharacterID);
            if (!characterInstance) {
                return respond({
                    success: false,
                    message: "Failed to load character data",
                });
            }
            if (characterToken?.position) {
                characterInstance.position = {
                    x: toNumber(characterToken.position?.x, 0),
                    y: toNumber(characterToken.position?.y, 0),
                    z: toNumber(characterToken.position?.z, 0),
                };
            }
            if (characterToken?.STA && typeof characterToken.STA === "object") {
                const tokenSTA = characterToken.STA;
                if (characterInstance._baseSTA) {
                    if (Number.isFinite(Number(tokenSTA.current))) {
                        characterInstance._baseSTA.current = Number(tokenSTA.current);
                    }
                    if (Number.isFinite(Number(tokenSTA.max))) {
                        characterInstance._baseSTA.max = Number(tokenSTA.max);
                    }
                    if (Number.isFinite(Number(tokenSTA.temp))) {
                        characterInstance._baseSTA.temp = Number(tokenSTA.temp);
                    }
                }
            }
            if (Number.isFinite(Number(characterToken?.movement))) {
                characterInstance.movement = Number(characterToken.movement);
            }

            const params = toPlainObject(data?.params);
            let actionResult;
            try {
                actionResult = characterInstance.executeAction(actionRef, params);
            } catch (error) {
                return respond({
                    success: false,
                    message: error.message || "Failed to execute action",
                });
            }

            let didUpdateSnapshot = false;

            if (actionResult?.STA && typeof actionResult.STA === "object") {
                const incomingSTA = actionResult.STA;
                const nextSTA =
                    characterToken.STA && typeof characterToken.STA === "object"
                        ? { ...characterToken.STA }
                        : {};
                let staChanged = false;

                if (Number.isFinite(Number(incomingSTA.max))) {
                    const value = Number(incomingSTA.max);
                    if (nextSTA.max !== value) {
                        nextSTA.max = value;
                        staChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingSTA.current))) {
                    const value = Number(incomingSTA.current);
                    if (nextSTA.current !== value) {
                        nextSTA.current = value;
                        staChanged = true;
                    }
                }
                if (Number.isFinite(Number(incomingSTA.temp))) {
                    const value = Number(incomingSTA.temp);
                    if (nextSTA.temp !== value) {
                        nextSTA.temp = value;
                        staChanged = true;
                    }
                }

                if (staChanged) {
                    characterToken.STA = nextSTA;
                    didUpdateSnapshot = true;
                }
            }

            if (!Number.isFinite(Number(characterToken?.movement))) {
                const movementValue = Number(characterInstance.movement);
                if (Number.isFinite(movementValue)) {
                    characterToken.movement = movementValue;
                    didUpdateSnapshot = true;
                }
            }

            if (
                actionResult?.position &&
                Number.isFinite(Number(actionResult.position?.x)) &&
                Number.isFinite(Number(actionResult.position?.y))
            ) {
                characterToken.position = {
                    x: Math.round(Number(actionResult.position.x)),
                    y: Math.round(Number(actionResult.position.y)),
                    z: Number.isFinite(Number(actionResult.position?.z))
                        ? Number(actionResult.position.z)
                        : toNumber(characterToken.position?.z, 0),
                };
                didUpdateSnapshot = true;
            }

            if (didUpdateSnapshot) {
                runtimeState.revision = Number(runtimeState.revision) + 1;
                runtimeState.updatedAt = Date.now();
            }

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                characterID: normalizedCharacterID,
                actionResult: actionResult || null,
            };

            if (didUpdateSnapshot) {
                socket.join(getCampaignGameRoom(campaign._id));
                if (isDM) {
                    socket.join(getCampaignDMRoom(campaign._id));
                } else {
                    socket.join(getCampaignPlayersRoom(campaign._id));
                }
                await emitPlayerStateUpdate(socket, campaign, payload);
                socket
                    .to(getCampaignDMRoom(campaign._id))
                    .emit("campaign_gameStateUpdated", payload);
            }

            respond(
                isDM ? payload : buildPlayerPayloadForPlayer(payload, campaign, playerID)
            );
        } catch (error) {
            console.error("[campaign_executeCharacterAction] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to execute character action",
            });
        }
    });

    socket.on("campaign_listEnemies", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can list enemies",
                });
            }

            const enemies = await Enemy.find({ campaignId: campaign._id }).sort({
                updatedAt: -1,
                _id: -1,
            });

            respond({
                success: true,
                enemies: enemies.map((enemy) => formatEnemy(enemy)).filter(Boolean),
            });
        } catch (error) {
            console.error("[campaign_listEnemies] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to list enemies",
            });
        }
    });

    socket.on("campaign_createEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};

        try {
            if (!mongoose.isValidObjectId(playerID) || !mongoose.isValidObjectId(campaignID)) {
                return respond({
                    success: false,
                    message: "Valid playerID and campaignID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can create enemies",
                });
            }

            const enemyInput = normalizeEnemyInput(data?.enemy || data || {});
            const created = await Enemy.create({
                campaignId: campaign._id,
                createdBy: playerID,
                ...enemyInput,
            });

            respond({
                success: true,
                enemy: formatEnemy(created),
            });
        } catch (error) {
            console.error("[campaign_createEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to create enemy",
            });
        }
    });

    socket.on("campaign_deleteEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const enemyID = String(data?.enemyID || "").trim();

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(enemyID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and enemyID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select("_id dmId");
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can delete enemies",
                });
            }

            const deleted = await Enemy.findOneAndDelete({
                _id: enemyID,
                campaignId: campaign._id,
            });

            if (!deleted) {
                return respond({ success: false, message: "Enemy not found" });
            }

            respond({
                success: true,
                enemyID: String(enemyID),
            });
        } catch (error) {
            console.error("[campaign_deleteEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to delete enemy",
            });
        }
    });

    socket.on("campaign_spawnEnemy", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID } = data || {};
        const enemyID = String(data?.enemyID || "").trim();
        const position = toPlainObject(data?.position);

        try {
            if (
                !mongoose.isValidObjectId(playerID) ||
                !mongoose.isValidObjectId(campaignID) ||
                !mongoose.isValidObjectId(enemyID)
            ) {
                return respond({
                    success: false,
                    message: "Valid playerID, campaignID, and enemyID are required",
                });
            }

            const campaign = await Campaign.findById(campaignID).select(
                "_id dmId players activeGameSave characterAssignments settings"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignDM(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only the DM can spawn enemies",
                });
            }

            const enemy = await Enemy.findOne({ _id: enemyID, campaignId: campaign._id });
            if (!enemy) {
                return respond({ success: false, message: "Enemy not found" });
            }

            let snapshot = {};
            if (!campaignRuntimeStateByID.has(String(campaign._id)) && campaign.activeGameSave) {
                const saveDoc = await GameSave.findOne({
                    _id: campaign.activeGameSave,
                    campaignId: campaign._id,
                }).select("snapshot");
                if (saveDoc) {
                    snapshot = toPlainObject(saveDoc.snapshot);
                }
            }

            const runtimeState = getOrCreateRuntimeState(campaign._id, snapshot);
            if (!Array.isArray(runtimeState.snapshot.characters)) {
                runtimeState.snapshot.characters = [];
            }

            const tokenId = `enemy_${String(enemy._id)}`;
            let token = runtimeState.snapshot.characters.find(
                (entry) => String(entry?.id ?? "") === tokenId
            );

            const nextX = Math.round(toNumber(position?.x ?? data?.x, 0));
            const nextY = Math.round(toNumber(position?.y ?? data?.y, 0));

            if (!token) {
                token = {
                    id: tokenId,
                    name: enemy.name || "Enemy",
                    position: { x: nextX, y: nextY },
                    size: Number(enemy.size) || 30,
                    visionDistance: Number(enemy.visionDistance) || 150,
                    visionArc: Number(enemy.visionArc) || 90,
                    rotation: Number(enemy.rotation) || 0,
                    team: "enemy",
                    kind: "enemy",
                    enemyId: String(enemy._id),
                    hp: Number(enemy?.HP?.current) || 0,
                    maxHP: Number(enemy?.HP?.max) || 0,
                };
                runtimeState.snapshot.characters.push(token);
            } else {
                token.name = enemy.name || token.name;
                token.position = { x: nextX, y: nextY };
                token.size = Number(enemy.size) || token.size;
                token.visionDistance = Number(enemy.visionDistance) || token.visionDistance;
                token.visionArc = Number(enemy.visionArc) || token.visionArc;
                token.rotation = Number(enemy.rotation) || token.rotation;
                token.team = "enemy";
                token.kind = "enemy";
                token.enemyId = String(enemy._id);
                token.hp = Number(enemy?.HP?.current) || token.hp || 0;
                token.maxHP = Number(enemy?.HP?.max) || token.maxHP || 0;
            }

            runtimeState.revision = Number(runtimeState.revision) + 1;
            runtimeState.updatedAt = Date.now();

            const engineState = cloneEngineState(runtimeState);
            const payload = {
                success: true,
                campaignID: String(campaign._id),
                floorTypes: FLOOR_TYPES,
                engineState,
                enemyID: String(enemy._id),
            };

            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_spawnEnemy] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to spawn enemy",
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
                allCharactersByPlayer = (formattedCampaign?.characterAssignments || [])
                    .filter(
                        (assignment) =>
                            Boolean(assignment?.playerId) && Boolean(assignment?.characterId)
                    )
                    .map((assignment) => {
                        const memberID = toObjectIdString(assignment.playerId);
                        const selectedCharacterID = toObjectIdString(assignment.characterId);

                        return {
                            playerId: memberID,
                            playerName: assignment?.playerName || "",
                            assignedCharacterId: selectedCharacterID,
                            characters: [
                                {
                                    _id: selectedCharacterID,
                                    name: assignment?.characterName || "Assigned Character",
                                    level: Number(assignment?.characterLevel) || 1,
                                    playerId: memberID,
                                    isSelected: true,
                                },
                            ],
                        };
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
                "_id dmId players activeLobby characterAssignments characterStates"
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

            const character = await Character.findById(characterID).select(
                "_id name level playerId experience HP MP STA water food stats skills inv effects actions"
            );
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

            const existingState = findCampaignCharacterState(campaign, character._id);
            if (!existingState) {
                const seededState = extractCampaignStateFromCharacter(character);
                upsertCampaignCharacterState(campaign, {
                    characterID: character._id,
                    playerID,
                    statePatch: seededState,
                    replace: true,
                });
                campaign.markModified("characterStates");
            } else if (toObjectIdString(existingState.playerId) !== String(playerID)) {
                upsertCampaignCharacterState(campaign, {
                    characterID: character._id,
                    playerID,
                    statePatch: {},
                    replace: false,
                });
                campaign.markModified("characterStates");
            }

            const nextAssignments = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.filter(
                      (assignment) => String(assignment?.playerId) !== String(playerID)
                  )
                : [];
            nextAssignments.push({
                playerId: playerID,
                characterId: characterID,
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

    socket.on("campaign_saveCharacterState", async (data, callback) => {
        const respond = safeCallback(callback);
        const { playerID, campaignID, characterID } = data || {};
        const statePatch = toPlainObject(data?.statePatch);

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
                "_id dmId players characterAssignments characterStates"
            );
            if (!campaign) {
                return respond({ success: false, message: "Campaign not found" });
            }

            if (!isCampaignMember(campaign, playerID)) {
                return respond({
                    success: false,
                    message: "Only campaign members can update campaign character state",
                });
            }

            if (!isCharacterInCampaign(campaign, characterID)) {
                return respond({
                    success: false,
                    message: "Character is not assigned in this campaign",
                });
            }

            const assignment = Array.isArray(campaign.characterAssignments)
                ? campaign.characterAssignments.find(
                      (entry) => toObjectIdString(entry?.characterId) === String(characterID)
                  ) || null
                : null;
            const stateEntry = findCampaignCharacterState(campaign, characterID);
            const ownerID =
                toObjectIdString(assignment?.playerId) ||
                toObjectIdString(stateEntry?.playerId);

            if (!isCampaignDM(campaign, playerID) && ownerID && ownerID !== String(playerID)) {
                return respond({
                    success: false,
                    message: "Only the character owner or DM can update this campaign state",
                });
            }

            const cleanedPatch = sanitizeCampaignStatePatch(statePatch);
            if (Object.keys(cleanedPatch).length === 0) {
                return respond({
                    success: false,
                    message: "No supported state fields were provided",
                });
            }

            const stateExists = Boolean(stateEntry);
            let nextStatePatch = cleanedPatch;
            if (!stateExists) {
                const baseCharacter = await Character.findById(characterID).select(
                    "_id name level playerId experience HP MP STA water food stats skills inv effects actions"
                );
                const seededState = baseCharacter
                    ? extractCampaignStateFromCharacter(baseCharacter)
                    : {};
                nextStatePatch = {
                    ...seededState,
                    ...cleanedPatch,
                };
            }

            upsertCampaignCharacterState(campaign, {
                characterID,
                playerID: ownerID || playerID,
                statePatch: nextStatePatch,
                replace: !stateExists,
            });
            campaign.markModified("characterStates");

            await campaign.save();

            const updatedState = findCampaignCharacterState(campaign, characterID);
            const campaignForClient = await readCampaignForResponse(campaign._id);
            respond({
                success: true,
                campaign: formatCampaign(campaignForClient),
                characterID: String(characterID),
                campaignState: toPlainObject(updatedState?.state),
            });
        } catch (error) {
            console.error("[campaign_saveCharacterState] failed", error);
            respond({
                success: false,
                message: error.message || "Failed to save campaign character state",
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
                "_id dmId players activeLobby characterAssignments characterStates"
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

            const removedCharacterIDs = (campaign.characterAssignments || [])
                .filter((assignment) => String(assignment?.playerId) === String(playerID))
                .map((assignment) => toObjectIdString(assignment?.characterId))
                .filter(Boolean);

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
            if (Array.isArray(campaign.characterStates)) {
                campaign.characterStates = campaign.characterStates.filter((stateEntry) => {
                    const statePlayerID = toObjectIdString(stateEntry?.playerId);
                    const stateCharacterID = toObjectIdString(stateEntry?.characterId);
                    if (statePlayerID && statePlayerID === String(playerID)) return false;
                    return !removedCharacterIDs.includes(stateCharacterID);
                });
            }

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
                "_id dmId players bannedPlayers activeLobby characterAssignments characterStates"
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

            const removedCharacterIDs = (campaign.characterAssignments || [])
                .filter((assignment) => String(assignment?.playerId) === String(targetPlayerID))
                .map((assignment) => toObjectIdString(assignment?.characterId))
                .filter(Boolean);

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
            if (Array.isArray(campaign.characterStates)) {
                campaign.characterStates = campaign.characterStates.filter((stateEntry) => {
                    const statePlayerID = toObjectIdString(stateEntry?.playerId);
                    const stateCharacterID = toObjectIdString(stateEntry?.characterId);
                    if (statePlayerID && statePlayerID === String(targetPlayerID)) return false;
                    return !removedCharacterIDs.includes(stateCharacterID);
                });
            }

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
            const snapshotInput = toPlainObject(data?.snapshot);
            const runtimeState =
                campaignRuntimeStateByID.get(String(campaign._id)) || createEngineState(campaign._id, {});
            const snapshot =
                Object.keys(snapshotInput).length > 0
                    ? snapshotInput
                    : toPlainObject(runtimeState?.snapshot);
            const metadata = toPlainObject(data?.metadata);
            const isAutoSave = Boolean(data?.isAutoSave);
            const makeActive = Boolean(data?.makeActive) || isAutoSave;

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

            let prunedAutoSaveIDs = [];
            if (isAutoSave) {
                const autoSaves = await GameSave.find({
                    campaignId: campaign._id,
                    isAutoSave: true,
                })
                    .sort({ updatedAt: -1, _id: -1 })
                    .select("_id");

                const overflowAutoSaves = autoSaves.slice(MAX_AUTO_SAVE_HISTORY);
                if (overflowAutoSaves.length > 0) {
                    const pruneIDSet = new Set(
                        overflowAutoSaves.map((saveDoc) => toObjectIdString(saveDoc?._id)).filter(Boolean)
                    );
                    prunedAutoSaveIDs = Array.from(pruneIDSet.values());

                    campaign.gameSaves = (Array.isArray(campaign.gameSaves) ? campaign.gameSaves : []).filter(
                        (saveRef) => !pruneIDSet.has(toObjectIdString(saveRef))
                    );

                    const activeSaveID = toObjectIdString(campaign.activeGameSave);
                    if (activeSaveID && pruneIDSet.has(activeSaveID)) {
                        campaign.activeGameSave = gameSave._id;
                    }

                    await GameSave.deleteMany({
                        _id: { $in: overflowAutoSaves.map((saveDoc) => saveDoc._id) },
                    });
                }
            }

            await campaign.save();
            const nextRuntimeState = replaceRuntimeState(campaign._id, snapshot);

            respond({
                success: true,
                gameSave: formatGameSave(gameSave),
                campaignID: String(campaign._id),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
                prunedAutoSaveIDs,
                floorTypes: FLOOR_TYPES,
                engineState: cloneEngineState(nextRuntimeState),
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

            const [manualSaves, autoSaves] = await Promise.all([
                GameSave.find({
                    campaignId: campaign._id,
                    isAutoSave: false,
                }).sort({ updatedAt: -1, _id: -1 }),
                GameSave.find({
                    campaignId: campaign._id,
                    isAutoSave: true,
                })
                    .sort({ updatedAt: -1, _id: -1 })
                    .limit(MAX_AUTO_SAVE_HISTORY),
            ]);

            const formattedManualSaves = manualSaves.map((save) => formatGameSave(save)).filter(Boolean);
            const formattedAutoSaves = autoSaves.map((save) => formatGameSave(save)).filter(Boolean);
            const gameSaves = [...formattedManualSaves, ...formattedAutoSaves].sort((a, b) => {
                const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
                return bTime - aTime;
            });

            respond({
                success: true,
                gameSaves,
                manualSaves: formattedManualSaves,
                autoSaves: formattedAutoSaves,
                autoSaveLimit: MAX_AUTO_SAVE_HISTORY,
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
            const runtimeState = replaceRuntimeState(campaign._id, toPlainObject(gameSave.snapshot));

            const payload = {
                success: true,
                gameSave: formatGameSave(gameSave),
                snapshot: toPlainObject(runtimeState.snapshot),
                floorTypes: FLOOR_TYPES,
                engineState: cloneEngineState(runtimeState),
                campaignID: String(campaign._id),
                gameID: String(campaign._id),
                activeGameSave: toObjectIdString(campaign.activeGameSave),
            };
            socket.join(getCampaignGameRoom(campaign._id));
            socket.join(getCampaignDMRoom(campaign._id));
            await emitPlayerStateUpdate(socket, campaign, payload);
            socket.to(getCampaignDMRoom(campaign._id)).emit("campaign_gameStateUpdated", payload);

            respond(payload);
        } catch (error) {
            console.error("[campaign_loadGame] failed", error);
            respond({ success: false, message: error.message || "Failed to load game save" });
        }
    });
};
