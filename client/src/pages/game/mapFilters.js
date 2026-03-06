export const MAP_VIEWS = {
    default: {
        id: "default",
        label: "Default View",
        apply: (state) => state,
    },
    objectsOnly: {
        id: "objectsOnly",
        label: "Objects Only",
        apply: (state) => ({
            ...state,
            characters: [],
        }),
    },
    charactersOnly: {
        id: "charactersOnly",
        label: "Characters Only",
        apply: (state) => ({
            ...state,
            visibleMapObjects: [],
            mapObjects: [],
            mapGeometry: [],
        }),
    },
    lightingOnly: {
        id: "lightingOnly",
        label: "Lighting Only",
        apply: (state) => ({
            ...state,
            characters: [],
            visibleMapObjects: [],
            mapObjects: [],
            mapGeometry: [],
        }),
    },
};

export const getActiveMapView = (viewId) => {
    return MAP_VIEWS[viewId] || MAP_VIEWS.default;
};