import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const GameContext = createContext();

const DEFAULT_BACKGROUND_KEY = "calm1";

const BACKGROUND_OPTIONS = [
    "calm1",
    "calm2",
    "calm3",
    "calm4",
    "cloud1",
    "cloud2",
    "cloud3",
    "cloud4",
    "night1",
    "night2",
    "night3",
    "night4",
    "storm1",
    "sunset1",
    "sunset2",
    "sunset3",
    "sunset4",
];

const DEFAULT_CHARACTERS = [
    {
        id: "char1",
        name: "Hero",
        position: { x: 25, y: 50 },
        size: 50,
        visionDistance: 200,
        rotation: 45,
        visionArc: 90,
        team: "player",
    },
    {
        id: "char2",
        name: "Ally",
        position: { x: 100, y: 100 },
        size: 20,
        visionDistance: 150,
        rotation: 180,
        visionArc: 120,
        team: "player",
    },
    {
        id: "char3",
        name: "Enemy",
        position: { x: 400, y: 300 },
        size: 30,
        visionDistance: 100,
        rotation: 270,
        visionArc: 90,
        team: "enemy",
    },
];

const DEFAULT_MAP_OBJECTS = [
    { id: 1, type: "circle", x: 100, y: 100, z: 0, size: 30, color: "#3B82F6" },
    { id: 2, type: "rect", x: 200, y: 150, z: 1, width: 50, height: 40, color: "#EF4444" },
    { id: 3, type: "triangle", x: 300, y: 200, z: 0, size: 40, color: "#10B981" },
];

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumber = (value, fallback = 1) => Math.max(1, toNumber(value, fallback));

const normalizeObjectType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    if (type === "circle" || type === "rect" || type === "triangle") return type;
    return "circle";
};

const normalizeHexColor = (value, fallback = "#3B82F6") => {
    const raw = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
};

const getMaxObjectId = (objects = []) =>
    objects.reduce((max, obj) => Math.max(max, toNumber(obj?.id, 0)), 0);

const normalizeMapObject = (raw = {}, fallbackId = 1) => {
    const type = normalizeObjectType(raw.type);
    const normalized = {
        id: toNumber(raw.id, fallbackId),
        type,
        x: Math.round(toNumber(raw.x, 0)),
        y: Math.round(toNumber(raw.y, 0)),
        z: Math.round(toNumber(raw.z, 0)),
        color: normalizeHexColor(raw.color),
    };

    if (type === "rect") {
        normalized.width = toPositiveNumber(raw.width, 50);
        normalized.height = toPositiveNumber(raw.height, 40);
    } else {
        normalized.size = toPositiveNumber(raw.size, type === "triangle" ? 40 : 30);
    }

    return normalized;
};

const normalizeCharacter = (raw = {}, fallback = {}) => {
    const source = { ...fallback, ...raw };
    return {
        ...source,
        id: String(source.id || fallback.id || ""),
        name: String(source.name || fallback.name || "Unknown"),
        position: {
            x: toNumber(source?.position?.x, 0),
            y: toNumber(source?.position?.y, 0),
        },
        size: toPositiveNumber(source.size, 30),
        visionDistance: toPositiveNumber(source.visionDistance, 150),
        rotation: toNumber(source.rotation, 0),
        visionArc: toPositiveNumber(source.visionArc, 90),
        team: String(source.team || fallback.team || "player"),
    };
};

export const GameProvider = ({ children }) => {
    const [selectedChar, setSelectedChar] = useState(null);
    const [fogEnabled, setFogEnabled] = useState(true);
    const [isDM, setIsDM] = useState(false);
    const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
    const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
    const camera = useRef({ x: 0, y: 0, zoom: 1, bgImage: null });

    const [mapObjects, setMapObjects] = useState(DEFAULT_MAP_OBJECTS);
    const [currentMapId, setCurrentMapId] = useState("default_map");
    const [backgroundKey, setBackgroundKey] = useState(DEFAULT_BACKGROUND_KEY);
    const [mapObjectPlacement, setMapObjectPlacement] = useState(null);

    const nextMapObjectIdRef = useRef(getMaxObjectId(DEFAULT_MAP_OBJECTS) + 1);

    const ensureNextObjectId = useCallback((objects) => {
        const nextId = getMaxObjectId(objects) + 1;
        nextMapObjectIdRef.current = Math.max(nextMapObjectIdRef.current, nextId);
    }, []);

    const createMapObject = useCallback(
        (draft) => {
            const candidateId = toNumber(draft?.id, 0);
            const id = candidateId > 0 ? candidateId : nextMapObjectIdRef.current++;
            const newObject = normalizeMapObject(draft, id);
            setMapObjects((prev) => {
                const updated = [...prev, newObject];
                ensureNextObjectId(updated);
                return updated;
            });
            return newObject;
        },
        [ensureNextObjectId]
    );

    const updateCharacter = useCallback((characterId, updates) => {
        if (!characterId) return;
        setCharacters((prev) =>
            prev.map((char) =>
                char.id === characterId ? normalizeCharacter({ ...char, ...updates }, char) : char
            )
        );
    }, []);

    const moveCharacter = useCallback((characterId, x, y) => {
        updateCharacter(characterId, {
            position: {
                x: toNumber(x, 0),
                y: toNumber(y, 0),
            },
        });
    }, [updateCharacter]);

    const selectCharacter = useCallback((characterId) => {
        setSelectedChar(characterId);
    }, []);

    const toggleFog = useCallback(() => {
        setFogEnabled((prev) => !prev);
    }, []);

    const handleCharacterAction = useCallback(
        (characterId, action) => {
            const char = characters.find((c) => c.id === characterId);
            console.log(`${char?.name} performs ${action}`);
        },
        [characters]
    );

    const addMapObject = useCallback(
        (obj) => {
            createMapObject(obj);
        },
        [createMapObject]
    );

    const updateMapObject = useCallback((id, updates) => {
        const numericId = toNumber(id, -1);
        if (numericId < 0) return;
        setMapObjects((prev) =>
            prev.map((obj) => {
                if (toNumber(obj.id, -1) !== numericId) return obj;
                return normalizeMapObject({ ...obj, ...updates }, obj.id);
            })
        );
    }, []);

    const deleteMapObject = useCallback((id) => {
        const numericId = toNumber(id, -1);
        if (numericId < 0) return;
        setMapObjects((prev) => prev.filter((obj) => toNumber(obj.id, -1) !== numericId));
    }, []);

    const replaceAllMapObjects = useCallback(
        (newObjects) => {
            const safeObjects = Array.isArray(newObjects) ? newObjects : [];
            const normalized = safeObjects.map((obj, index) => normalizeMapObject(obj, index + 1));
            setMapObjects(normalized);
            ensureNextObjectId(normalized);
        },
        [ensureNextObjectId]
    );

    const armMapObjectPlacement = useCallback((config = {}) => {
        const type = normalizeObjectType(config.type);
        setMapObjectPlacement({
            type,
            color: normalizeHexColor(config.color),
            z: Math.round(toNumber(config.z, 0)),
            size: toPositiveNumber(config.size, type === "triangle" ? 40 : 30),
            width: toPositiveNumber(config.width, 50),
            height: toPositiveNumber(config.height, 40),
        });
    }, []);

    const clearMapObjectPlacement = useCallback(() => {
        setMapObjectPlacement(null);
    }, []);

    const placePendingMapObjectAt = useCallback(
        (x, y, overrides = {}) => {
            if (!mapObjectPlacement) return null;
            const safeOverrides =
                overrides && typeof overrides === "object" && !Array.isArray(overrides)
                    ? overrides
                    : {};

            const placed = createMapObject({
                ...mapObjectPlacement,
                ...safeOverrides,
                x: Math.round(toNumber(x, 0)),
                y: Math.round(toNumber(y, 0)),
            });
            setMapObjectPlacement(null);
            return placed;
        },
        [mapObjectPlacement, createMapObject]
    );

    const loadGameSnapshot = useCallback(
        (snapshot = {}) => {
            if (!snapshot || typeof snapshot !== "object") return;

            if (typeof snapshot.backgroundKey === "string" && snapshot.backgroundKey.trim()) {
                const candidate = snapshot.backgroundKey.trim().toLowerCase();
                if (BACKGROUND_OPTIONS.includes(candidate)) {
                    setBackgroundKey(candidate);
                }
            }

            if (Array.isArray(snapshot.mapObjects)) {
                replaceAllMapObjects(snapshot.mapObjects);
            }

            if (Array.isArray(snapshot.characters) && snapshot.characters.length > 0) {
                setCharacters(
                    snapshot.characters.map((character, index) =>
                        normalizeCharacter(character, DEFAULT_CHARACTERS[index] || {})
                    )
                );
            }
        },
        [replaceAllMapObjects]
    );

    const saveMapToDatabase = useCallback(async () => {
        console.log("saveMapToDatabase placeholder", { currentMapId, mapObjects, backgroundKey });
    }, [currentMapId, mapObjects, backgroundKey]);

    const loadMapFromDatabase = useCallback(async (mapId) => {
        console.log("loadMapFromDatabase placeholder", { mapId });
    }, []);

    const screenToWorld = useCallback(
        (screenX, screenY) => {
            if (!camera?.current) return { x: 0, y: 0 };
            const zoom = toNumber(camera.current.zoom, 1) || 1;
            const camX = toNumber(camera.current.x, 0);
            const camY = toNumber(camera.current.y, 0);
            return {
                x: (toNumber(screenX, 0) + camX) / zoom,
                y: (toNumber(screenY, 0) + camY) / zoom,
            };
        },
        [camera]
    );

    const worldToScreen = useCallback(
        (worldX, worldY) => {
            if (!camera?.current) return { x: 0, y: 0 };
            const zoom = toNumber(camera.current.zoom, 1) || 1;
            const camX = toNumber(camera.current.x, 0);
            const camY = toNumber(camera.current.y, 0);
            return {
                x: toNumber(worldX, 0) * zoom - camX,
                y: toNumber(worldY, 0) * zoom - camY,
            };
        },
        [camera]
    );

    const worldMouseCoords = useMemo(() => {
        if (!camera?.current || !lastMouse) return { x: 0, y: 0 };
        if (typeof lastMouse.x !== "number" || typeof lastMouse.y !== "number") {
            return { x: 0, y: 0 };
        }
        return screenToWorld(lastMouse.x, lastMouse.y);
    }, [lastMouse, screenToWorld]);

    const value = {
        selectedChar,
        setSelectedChar,
        fogEnabled,
        setFogEnabled,
        isDM,
        setIsDM,
        characters,
        setCharacters,
        lastMouse,
        setLastMouse,
        camera,
        worldMouseCoords,

        mapObjects,
        setMapObjects,
        currentMapId,
        setCurrentMapId,
        backgroundKey,
        setBackgroundKey,
        backgroundOptions: BACKGROUND_OPTIONS,
        mapObjectPlacement,

        updateCharacter,
        moveCharacter,
        selectCharacter,
        toggleFog,
        handleCharacterAction,
        screenToWorld,
        worldToScreen,

        addMapObject,
        updateMapObject,
        deleteMapObject,
        replaceAllMapObjects,
        armMapObjectPlacement,
        clearMapObjectPlacement,
        placePendingMapObjectAt,
        saveMapToDatabase,
        loadMapFromDatabase,
        loadGameSnapshot,
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error("useGame must be used within a GameProvider");
    }
    return context;
};
