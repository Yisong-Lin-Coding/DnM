// c:\Projects\client\src\pages\game\gameActions.js
export const ACTION_TAB_ORDER = [
    "main",
    "movement",
    "bonus",
    "reaction",
    "free",
    "passive",
    "special",
];

export const ACTION_TAB_LABELS = {
    main: "Action",
    movement: "Movement",
    bonus: "Bonus Action",
    reaction: "Reaction",
    free: "Free Action",
    passive: "Passive",
    special: "Special",
};

export const CONTEXT_ACTION_ROOTS = [
    {
        key: "action",
        label: "Action",
        tabs: ["main", "reaction", "free", "passive", "special"],
    },
    { key: "bonus", label: "Bonus Action", tabs: ["bonus"] },
    { key: "movement", label: "Movement", tabs: ["movement"] },
];

export function groupActionsByTab(actions = []) {
    const groups = new Map();
    actions.forEach((action) => {
        if (!action) return;
        const tab = String(action.tab || action.actionType || "main").toLowerCase();
        if (!groups.has(tab)) {
            groups.set(tab, []);
        }
        groups.get(tab).push(action);
    });

    const ordered = [];
    ACTION_TAB_ORDER.forEach((tab) => {
        if (!groups.has(tab)) return;
        ordered.push({
            key: tab,
            label: ACTION_TAB_LABELS[tab] || tab,
            actions: groups.get(tab).sort((a, b) =>
                String(a?.name || "").localeCompare(String(b?.name || ""))
            ),
        });
        groups.delete(tab);
    });

    Array.from(groups.keys())
        .sort()
        .forEach((tab) => {
            ordered.push({
                key: tab,
                label: ACTION_TAB_LABELS[tab] || tab,
                actions: (groups.get(tab) || []).sort((a, b) =>
                    String(a?.name || "").localeCompare(String(b?.name || ""))
                ),
            });
        });

    return ordered;
}

export function toDisplayLabel(value = "") {
    return String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildContextActionRoot(actionTree, rootConfig) {
    const children = [];
    const tabs = Array.isArray(rootConfig?.tabs) ? rootConfig.tabs : [];
    const [primaryTab, ...extraTabs] = tabs;
    const primaryNode = primaryTab ? actionTree?.[primaryTab] : null;

    if (primaryNode?.children?.length) {
        children.push(...primaryNode.children);
    } else if (primaryNode?.action) {
        children.push({
            key: primaryNode.key || primaryTab,
            label: primaryNode.label || toDisplayLabel(primaryTab),
            path: primaryNode.path || primaryTab,
            action: primaryNode.action,
            children: [],
        });
    }

    extraTabs.forEach((tabKey) => {
        const tabNode = actionTree?.[tabKey];
        if (!tabNode) return;
        const tabChildren = Array.isArray(tabNode.children) ? tabNode.children : [];
        const hasAction = Boolean(tabNode.action) && tabChildren.length === 0;
        if (tabChildren.length === 0 && !hasAction) return;
        children.push({
            key: tabNode.key || tabKey,
            label: ACTION_TAB_LABELS[tabKey] || tabNode.label || toDisplayLabel(tabKey),
            path: tabNode.path || tabKey,
            action: hasAction ? tabNode.action : undefined,
            children: tabChildren,
        });
    });

    return {
        key: rootConfig.key,
        label: rootConfig.label,
        path: rootConfig.key,
        children,
    };
}

export function buildContextActionMenu(actionTree) {
    if (!actionTree || typeof actionTree !== "object") return null;
    const root = { key: "root", label: "Actions", children: [] };
    CONTEXT_ACTION_ROOTS.forEach((rootConfig) => {
        root.children.push(buildContextActionRoot(actionTree, rootConfig));
    });
    return root;
}

export function getContextActionItems(node, options = {}) {
    const includeEmpty = options.includeEmpty === true;
    const children = Array.isArray(node?.children) ? node.children : [];

    return children
        .map((child) => {
            if (!child || typeof child !== "object") return null;
            const childChildren = Array.isArray(child.children) ? child.children : [];
            const hasChildren = childChildren.length > 0;
            const hasAction = Boolean(child.action) && !hasChildren;

            if (hasChildren) {
                return {
                    type: "folder",
                    label: child.label || toDisplayLabel(child.key || ""),
                    node: child,
                    disabled: false,
                };
            }

            if (hasAction) {
                return {
                    type: "action",
                    label:
                        child.action?.name ||
                        child.label ||
                        toDisplayLabel(child.key || ""),
                    action: child.action,
                };
            }

            if (includeEmpty) {
                return {
                    type: "folder",
                    label: child.label || toDisplayLabel(child.key || ""),
                    node: child,
                    disabled: true,
                };
            }

            return null;
        })
        .filter(Boolean);
}
