import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Globe, Lock, Play, RefreshCcw, Save, Settings, Upload, Users } from "lucide-react";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import IndexCardFolder from "../../pageComponents/indexCard";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "./socketEmit";

function formatDateLabel(dateValue) {
    const date = new Date(dateValue || "");
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString();
}

function toID(value) {
    return String(value || "");
}

function buildCampaignRoster(campaign) {
    const dmID = toID(campaign?.dmId);
    const byID = new Map();

    if (dmID) {
        byID.set(dmID, {
            _id: dmID,
            username: campaign?.dmName || "DM",
        });
    }

    const players = Array.isArray(campaign?.players) ? campaign.players : [];
    players.forEach((player) => {
        const playerID = toID(player?._id || player);
        if (!playerID) return;

        const existing = byID.get(playerID);
        byID.set(playerID, {
            _id: playerID,
            username: player?.username || existing?.username || "Player",
        });
    });

    return Array.from(byID.values()).sort((a, b) => {
        if (a._id === dmID) return -1;
        if (b._id === dmID) return 1;
        return (a.username || "").localeCompare(b.username || "");
    });
}

function LobbyMenu() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const { sessionID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const safeSessionID = useMemo(
        () => sessionID || sessionStorage.getItem("session_ID") || "default",
        [sessionID]
    );

    const [campaigns, setCampaigns] = useState([]);
    const [saveLists, setSaveLists] = useState({});
    const [saveLoading, setSaveLoading] = useState({});
    const [activeSaveMap, setActiveSaveMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [busyAction, setBusyAction] = useState("");
    const [settingsCampaignID, setSettingsCampaignID] = useState("");
    const [descriptionModalCampaignID, setDescriptionModalCampaignID] = useState("");
    const [inviteUsernameByCampaign, setInviteUsernameByCampaign] = useState({});

    const loadCampaigns = useCallback(async () => {
        if (!socket || !playerID) {
            setLoading(false);
            setCampaigns([]);
            setError("Missing player session. Please log in again.");
            return false;
        }

        setLoading(true);
        const response = await emitWithAck(socket, "campaign_list", { playerID });
        if (!response?.success) {
            setCampaigns([]);
            setLoading(false);
            setError(response?.message || "Failed to load campaigns");
            return false;
        }

        setCampaigns(Array.isArray(response.campaigns) ? response.campaigns : []);
        setLoading(false);
        setError("");
        return true;
    }, [socket, playerID]);

    const refreshSaveList = useCallback(
        async (campaignID, { silent = false } = {}) => {
            if (!socket || !playerID || !campaignID) return false;

            if (!silent) setError("");
            setSaveLoading((prev) => ({ ...prev, [campaignID]: true }));

            const response = await emitWithAck(socket, "campaign_listGameSaves", {
                playerID,
                campaignID,
            });

            setSaveLoading((prev) => ({ ...prev, [campaignID]: false }));

            if (!response?.success) {
                if (!silent) {
                    setError(response?.message || "Failed to load game saves");
                }
                return false;
            }

            setSaveLists((prev) => ({
                ...prev,
                [campaignID]: Array.isArray(response.gameSaves) ? response.gameSaves : [],
            }));
            setActiveSaveMap((prev) => ({
                ...prev,
                [campaignID]: response.activeGameSave || "",
            }));
            return true;
        },
        [socket, playerID]
    );

    useEffect(() => {
        loadCampaigns();
    }, [loadCampaigns]);

    useEffect(() => {
        setSettingsCampaignID((prev) =>
            campaigns.some((campaign) => campaign?._id === prev) ? prev : ""
        );
        setDescriptionModalCampaignID((prev) =>
            campaigns.some((campaign) => campaign?._id === prev) ? prev : ""
        );
    }, [campaigns]);

    const isCampaignDM = useCallback(
        (campaign) => toID(campaign?.dmId) === toID(playerID),
        [playerID]
    );

    const upsertCampaignFromResponse = useCallback((updatedCampaign) => {
        if (!updatedCampaign?._id) return false;

        let found = false;
        setCampaigns((prev) =>
            prev.map((existingCampaign) => {
                if (existingCampaign._id !== updatedCampaign._id) return existingCampaign;
                found = true;
                return updatedCampaign;
            })
        );
        return found;
    }, []);

    const goToGame = useCallback(
        (gameID) => {
            navigate(`/ISK/${safeSessionID}/game/${gameID}`);
        },
        [navigate, safeSessionID]
    );

    const handleStartLobby = useCallback(
        async (campaignID) => {
            if (!campaignID || !playerID) return;

            setBusyAction(`start:${campaignID}`);
            setError("");
            const response = await emitWithAck(socket, "campaign_startLobby", {
                playerID,
                campaignID,
            });
            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to start lobby");
                return;
            }

            setStatus("Lobby started successfully.");
            await loadCampaigns();
            goToGame(response.gameID || campaignID);
        },
        [socket, playerID, goToGame, loadCampaigns]
    );

    const handleJoinLobby = useCallback(
        async (campaignID, lobbyCode = "") => {
            if (!campaignID || !playerID) return;

            setBusyAction(`join:${campaignID}`);
            setError("");
            const response = await emitWithAck(socket, "campaign_joinLobby", {
                playerID,
                campaignID,
                lobbyCode,
            });
            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to join lobby");
                return;
            }

            setStatus("Joined lobby.");
            goToGame(response.gameID || campaignID);
        },
        [socket, playerID, goToGame]
    );

    const handleQuickSave = useCallback(
        async (campaign) => {
            if (!campaign?._id || !playerID) return;

            setBusyAction(`save:${campaign._id}`);
            setError("");
            const response = await emitWithAck(socket, "campaign_saveGame", {
                playerID,
                campaignID: campaign._id,
                name: `${campaign.name} Snapshot`,
                description: "Saved from campaign lobby menu",
                snapshot: {
                    source: "campaign_menu",
                    campaignID: campaign._id,
                    savedAt: new Date().toISOString(),
                },
                metadata: {
                    source: "lobby_menu",
                },
                makeActive: true,
                isAutoSave: false,
            });
            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to save game");
                return;
            }

            setStatus("Game save created.");
            await Promise.all([loadCampaigns(), refreshSaveList(campaign._id, { silent: true })]);
        },
        [socket, playerID, loadCampaigns, refreshSaveList]
    );

    const handleLoadSave = useCallback(
        async (campaignID, gameSaveID) => {
            if (!campaignID || !gameSaveID || !playerID) return;

            setBusyAction(`load:${campaignID}:${gameSaveID}`);
            setError("");
            const response = await emitWithAck(socket, "campaign_loadGame", {
                playerID,
                campaignID,
                gameSaveID,
            });
            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to load save");
                return;
            }

            setStatus(`Loaded save ${response?.gameSave?.name || ""}`.trim());
            setActiveSaveMap((prev) => ({
                ...prev,
                [campaignID]: response.activeGameSave || gameSaveID,
            }));
            await loadCampaigns();
        },
        [socket, playerID, loadCampaigns]
    );

    const handleLobbyMemberToggle = useCallback(
        async (campaign, memberID, shouldBeInLobby) => {
            const campaignID = campaign?._id;
            if (!socket || !campaignID || !playerID || !memberID) return;

            if (!campaign.activeLobby?.isActive) {
                setError("Start the lobby before changing lobby players.");
                return;
            }

            const currentMembers = new Set(
                (Array.isArray(campaign.activeLobby?.members) ? campaign.activeLobby.members : []).map(
                    (id) => toID(id)
                )
            );

            if (shouldBeInLobby) {
                currentMembers.add(toID(memberID));
            } else {
                currentMembers.delete(toID(memberID));
            }

            const dmID = toID(campaign.dmId);
            if (dmID) currentMembers.add(dmID);

            const actionKey = `settings:${campaignID}:${memberID}`;
            setBusyAction(actionKey);
            setError("");

            const response = await emitWithAck(socket, "campaign_setLobbyMembers", {
                playerID,
                campaignID,
                memberIDs: Array.from(currentMembers),
            });

            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to update lobby players");
                return;
            }

            setStatus("Lobby players updated.");
            if (upsertCampaignFromResponse(response.campaign)) {
                return;
            }

            await loadCampaigns();
        },
        [socket, playerID, loadCampaigns, upsertCampaignFromResponse]
    );

    const handleManagePlayer = useCallback(
        async (campaign, targetPlayerID, action, providedTargetName = "") => {
            const campaignID = campaign?._id;
            if (!socket || !playerID || !campaignID || !targetPlayerID || !action) return;

            const targetMember = (Array.isArray(campaign.players) ? campaign.players : []).find(
                (member) => toID(member?._id || member) === toID(targetPlayerID)
            );
            const targetName =
                providedTargetName ||
                targetMember?.username ||
                `Player ${toID(targetPlayerID).slice(-4).toUpperCase()}`;

            const actionLabel =
                action === "ban" ? "ban" : action === "unban" ? "unban" : "kick";
            const confirmed = window.confirm(
                `Are you sure you want to ${actionLabel} ${targetName}?`
            );
            if (!confirmed) return;

            const actionKey = `manage:${campaignID}:${targetPlayerID}:${action}`;
            setBusyAction(actionKey);
            setError("");

            const response = await emitWithAck(socket, "campaign_managePlayer", {
                playerID,
                campaignID,
                targetPlayerID,
                action,
            });

            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || `Failed to ${actionLabel} player`);
                return;
            }

            if (action === "ban") {
                setStatus(`${targetName} has been banned.`);
            } else if (action === "unban") {
                setStatus(`${targetName} has been unbanned.`);
            } else {
                setStatus(`${targetName} has been removed.`);
            }
            if (upsertCampaignFromResponse(response.campaign)) {
                return;
            }
            await loadCampaigns();
        },
        [socket, playerID, loadCampaigns, upsertCampaignFromResponse]
    );

    const handleInvitePlayer = useCallback(
        async (campaign) => {
            const campaignID = campaign?._id;
            const rawUsername = inviteUsernameByCampaign[campaignID] || "";
            const username = rawUsername.trim();
            if (!socket || !playerID || !campaignID) return;
            if (!username) {
                setError("Enter a username to invite.");
                return;
            }

            const actionKey = `invite:${campaignID}`;
            setBusyAction(actionKey);
            setError("");

            const response = await emitWithAck(socket, "campaign_invitePlayer", {
                playerID,
                campaignID,
                username,
            });

            setBusyAction("");

            if (!response?.success) {
                setError(response?.message || "Failed to invite player");
                return;
            }

            setInviteUsernameByCampaign((prev) => ({ ...prev, [campaignID]: "" }));
            const invitedName = response?.invitedPlayer?.username || username;
            setStatus(
                response?.alreadyMember
                    ? `${invitedName} is already in this campaign.`
                    : `Invited ${invitedName}.`
            );
            if (upsertCampaignFromResponse(response.campaign)) {
                return;
            }
            await loadCampaigns();
        },
        [socket, playerID, inviteUsernameByCampaign, loadCampaigns, upsertCampaignFromResponse]
    );

    const descriptionModalCampaign = useMemo(
        () => campaigns.find((campaign) => campaign?._id === descriptionModalCampaignID) || null,
        [campaigns, descriptionModalCampaignID]
    );

    return (
        <Body className="bg-website-default-900 text-website-default-100">
            <Header className="col-span-3" title="Campaign Lobby" />
            <Body.Left className="row-span-1 col-start-1" />

            <Body.Center className="row-span-1 col-start-2 min-h-screen pb-8">
                <div className="px-6 pt-6 pb-2 space-y-3 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            to={`/ISK/${safeSessionID}/lobby/create`}
                            className="px-4 py-2 rounded-lg border border-website-specials-500 bg-website-default-800 hover:bg-website-default-700 transition-colors text-sm font-semibold"
                        >
                            Create Campaign
                        </Link>
                        <Link
                            to={`/ISK/${safeSessionID}/lobby/join`}
                            className="px-4 py-2 rounded-lg border border-website-highlights-500 bg-website-default-800 hover:bg-website-default-700 transition-colors text-sm font-semibold"
                        >
                            Join Campaign
                        </Link>
                        <button
                            type="button"
                            onClick={loadCampaigns}
                            className="px-4 py-2 rounded-lg border border-website-default-600 bg-website-default-800 hover:bg-website-default-700 transition-colors text-sm font-semibold inline-flex items-center gap-2"
                        >
                            <RefreshCcw className="size-4" />
                            Refresh
                        </button>
                    </div>

                    {error && (
                        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                    {status && (
                        <div className="rounded border border-website-highlights-500/50 bg-website-highlights-500/10 px-3 py-2 text-sm text-website-neutral-100">
                            {status}
                        </div>
                    )}
                </div>

                <IndexCardFolder>
                    {!loading &&
                        campaigns.map((campaign) => {
                            const campaignID = campaign._id;
                            const isDM = isCampaignDM(campaign);
                            const roster = buildCampaignRoster(campaign);
                            const nonDmPlayers = roster.filter(
                                (member) => toID(member._id) !== toID(campaign.dmId)
                            );
                            const bannedPlayers = Array.isArray(campaign.bannedPlayers)
                                ? campaign.bannedPlayers
                                : [];
                            const saves = saveLists[campaignID] || [];
                            const isSaveLoading = Boolean(saveLoading[campaignID]);
                            const activeSaveID = activeSaveMap[campaignID] || campaign.activeGameSave || "";
                            const isSettingsOpen = settingsCampaignID === campaignID;
                            const lobbyMembers = new Set(
                                (Array.isArray(campaign.activeLobby?.members)
                                    ? campaign.activeLobby.members
                                    : []
                                ).map((memberID) => toID(memberID))
                            );
                            const isSettingsBusy = busyAction.startsWith(`settings:${campaignID}:`);
                            const isManageBusy = busyAction.startsWith(`manage:${campaignID}:`);
                            const isInviteBusy = busyAction === `invite:${campaignID}`;
                            const playerCanEnterLobby =
                                isDM || lobbyMembers.size === 0 || lobbyMembers.has(toID(playerID));

                            return (
                                <IndexCardFolder.File
                                    key={campaignID}
                                    onClick={
                                        !isDM
                                            ? () => setDescriptionModalCampaignID(campaignID)
                                            : undefined
                                    }
                                    className="!aspect-auto min-h-[520px] !grid-rows-[auto_auto_1fr] hover:!scale-100 hover:!translate-y-0"
                                >
                                    <IndexCardFolder.File.Top>
                                        <div className="flex items-start justify-between gap-3">
                                            <IndexCardFolder.File.Title className="mb-0">
                                                {campaign.name}
                                            </IndexCardFolder.File.Title>
                                            {isDM ? (
                                                <span className="inline-flex items-center rounded-md border border-website-specials-500/60 bg-website-specials-500/10 px-2 py-1 text-[10px] font-bold tracking-wider text-website-specials-400">
                                                    {campaign.joinCode || "NO CODE"}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-md border border-website-default-600/70 bg-website-default-700/40 px-2 py-1 text-[10px] font-semibold tracking-wider text-website-default-300">
                                                    {campaign.dmName ? `DM: ${campaign.dmName}` : "PLAYER"}
                                                </span>
                                            )}
                                        </div>
                                        <IndexCardFolder.File.Description
                                            className={`mt-2 text-xs ${isDM ? "line-clamp-3" : ""}`}
                                        >
                                            {isDM
                                                ? campaign.description || "No description set."
                                                : "Click this card to view lobby description."}
                                        </IndexCardFolder.File.Description>
                                    </IndexCardFolder.File.Top>

                                    <IndexCardFolder.File.Middle className="text-left">
                                        <div className="space-y-2 text-xs text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Users className="size-3.5 text-website-highlights-400" />
                                                <span>
                                                    {campaign.memberCount}/{campaign.maxPlayers} members
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {campaign.isPrivate ? (
                                                    <Lock className="size-3.5 text-website-specials-400" />
                                                ) : (
                                                    <Globe className="size-3.5 text-website-highlights-400" />
                                                )}
                                                <span>{campaign.isPrivate ? "Private" : "Public"}</span>
                                            </div>
                                            <div className="text-slate-400">
                                                Setting: {campaign.setting || "Unspecified"}
                                            </div>
                                            <div
                                                className={`text-xs font-semibold ${
                                                    campaign.activeLobby?.isActive
                                                        ? "text-emerald-400"
                                                        : "text-slate-400"
                                                }`}
                                            >
                                                {campaign.activeLobby?.isActive
                                                    ? isDM
                                                        ? `Lobby active: ${
                                                              campaign.activeLobby?.lobbyCode || "N/A"
                                                          }`
                                                        : "Lobby active"
                                                    : "Lobby inactive"}
                                            </div>
                                            {isDM && (
                                                <div className="text-[11px] text-slate-500 truncate">
                                                    Active Save:{" "}
                                                    {activeSaveID
                                                        ? activeSaveID.slice(-8).toUpperCase()
                                                        : "None"}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {campaign.activeLobby?.isActive ? (
                                                <>
                                                    {playerCanEnterLobby ? (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleJoinLobby(
                                                                    campaignID,
                                                                    campaign.activeLobby?.lobbyCode || ""
                                                                )
                                                            }
                                                            disabled={busyAction === `join:${campaignID}`}
                                                            className="inline-flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                                                        >
                                                            <Play className="size-3.5" />
                                                            Enter Lobby
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-100"
                                                        >
                                                            Lobby locked by DM
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {isDM ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartLobby(campaignID)}
                                                            disabled={busyAction === `start:${campaignID}`}
                                                            className="inline-flex items-center gap-2 rounded-md border border-website-highlights-500/50 bg-website-highlights-500/10 px-3 py-2 text-xs font-semibold text-website-neutral-100 hover:bg-website-highlights-500/20 disabled:opacity-50"
                                                        >
                                                            <Play className="size-3.5" />
                                                            Start Lobby
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-400 disabled:opacity-100"
                                                        >
                                                            Waiting for DM
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {isDM && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickSave(campaign)}
                                                        disabled={busyAction === `save:${campaignID}`}
                                                        className="inline-flex items-center gap-2 rounded-md border border-website-specials-500/50 bg-website-specials-500/10 px-3 py-2 text-xs font-semibold text-website-specials-300 hover:bg-website-specials-500/20 disabled:opacity-50"
                                                    >
                                                        <Save className="size-3.5" />
                                                        Quick Save
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => refreshSaveList(campaignID)}
                                                        className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700/40"
                                                    >
                                                        <RefreshCcw className="size-3.5" />
                                                        Refresh Saves
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSettingsCampaignID((prev) =>
                                                                prev === campaignID ? "" : campaignID
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-md border border-slate-500/60 bg-slate-700/30 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700/50"
                                                    >
                                                        <Settings className="size-3.5" />
                                                        Lobby Settings
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {isDM && isSettingsOpen && (
                                            <div className="mt-4 space-y-4 rounded-md border border-slate-700 bg-slate-900/60 p-3">
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                        Lobby Access
                                                    </div>
                                                    {!campaign.activeLobby?.isActive && (
                                                        <div className="mt-1 text-xs text-amber-300">
                                                            Start the lobby first, then choose who can enter.
                                                        </div>
                                                    )}
                                                    {campaign.activeLobby?.isActive &&
                                                        roster.map((member) => {
                                                            const memberID = toID(member._id);
                                                            const memberIsDM = memberID === toID(campaign.dmId);
                                                            const checked = memberIsDM || lobbyMembers.has(memberID);
                                                            const label =
                                                                member.username ||
                                                                `Player ${memberID.slice(-4).toUpperCase()}`;

                                                            return (
                                                                <label
                                                                    key={memberID}
                                                                    className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-200"
                                                                >
                                                                    <span className="truncate">
                                                                        {label}
                                                                        {memberIsDM ? " (DM)" : ""}
                                                                    </span>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        disabled={memberIsDM || isSettingsBusy}
                                                                        onChange={(event) =>
                                                                            handleLobbyMemberToggle(
                                                                                campaign,
                                                                                memberID,
                                                                                event.target.checked
                                                                            )
                                                                        }
                                                                        className="size-4 rounded border-slate-600 bg-slate-800"
                                                                    />
                                                                </label>
                                                            );
                                                        })}
                                                </div>

                                                <div className="border-t border-slate-700/80 pt-3">
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                        Campaign Players
                                                    </div>
                                                    {nonDmPlayers.length === 0 && (
                                                        <div className="mt-2 text-xs text-slate-400">
                                                            No players to manage yet.
                                                        </div>
                                                    )}
                                                    {nonDmPlayers.map((member) => {
                                                        const memberID = toID(member._id);
                                                        const label =
                                                            member.username ||
                                                            `Player ${memberID.slice(-4).toUpperCase()}`;

                                                        return (
                                                            <div
                                                                key={memberID}
                                                                className="mt-2 flex items-center justify-between gap-2 rounded border border-slate-700/80 bg-slate-800/40 px-2 py-2"
                                                            >
                                                                <span className="truncate text-xs text-slate-200">
                                                                    {label}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleManagePlayer(
                                                                                campaign,
                                                                                memberID,
                                                                                "kick",
                                                                                label
                                                                            )
                                                                        }
                                                                        disabled={isManageBusy}
                                                                        className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                                                                    >
                                                                        Kick
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleManagePlayer(
                                                                                campaign,
                                                                                memberID,
                                                                                "ban",
                                                                                label
                                                                            )
                                                                        }
                                                                        disabled={isManageBusy}
                                                                        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                                                                    >
                                                                        Ban
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="border-t border-slate-700/80 pt-3">
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                        Banned Players
                                                    </div>
                                                    {bannedPlayers.length === 0 && (
                                                        <div className="mt-2 text-xs text-slate-400">
                                                            No banned players.
                                                        </div>
                                                    )}
                                                    {bannedPlayers.map((member) => {
                                                        const memberID = toID(member?._id || member);
                                                        const label =
                                                            member?.username ||
                                                            `Player ${memberID.slice(-4).toUpperCase()}`;

                                                        return (
                                                            <div
                                                                key={memberID}
                                                                className="mt-2 flex items-center justify-between gap-2 rounded border border-slate-700/80 bg-slate-800/40 px-2 py-2"
                                                            >
                                                                <span className="truncate text-xs text-slate-200">
                                                                    {label}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleManagePlayer(
                                                                            campaign,
                                                                            memberID,
                                                                            "unban",
                                                                            label
                                                                        )
                                                                    }
                                                                    disabled={isManageBusy}
                                                                    className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                                                                >
                                                                    Unban
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="border-t border-slate-700/80 pt-3">
                                                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                        Send Invite
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={inviteUsernameByCampaign[campaignID] || ""}
                                                            onChange={(event) =>
                                                                setInviteUsernameByCampaign((prev) => ({
                                                                    ...prev,
                                                                    [campaignID]: event.target.value,
                                                                }))
                                                            }
                                                            placeholder="Exact username"
                                                            className="w-full rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-website-highlights-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleInvitePlayer(campaign)}
                                                            disabled={isInviteBusy}
                                                            className="rounded border border-website-highlights-500/50 bg-website-highlights-500/10 px-2 py-1 text-[11px] font-semibold text-website-neutral-100 hover:bg-website-highlights-500/20 disabled:opacity-60"
                                                        >
                                                            Invite
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </IndexCardFolder.File.Middle>

                                    <IndexCardFolder.File.Bottom className="items-stretch gap-2">
                                        {isDM ? (
                                            <>
                                                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                    Recent Saves
                                                </div>
                                                {isSaveLoading && (
                                                    <div className="text-xs text-slate-500">
                                                        Loading saves...
                                                    </div>
                                                )}
                                                {!isSaveLoading && saves.length === 0 && (
                                                    <div className="text-xs text-slate-500">No saves yet.</div>
                                                )}
                                                {!isSaveLoading &&
                                                    saves.slice(0, 3).map((save) => {
                                                        const isActive = activeSaveID === save._id;
                                                        const loadKey = `load:${campaignID}:${save._id}`;
                                                        return (
                                                            <button
                                                                key={save._id}
                                                                type="button"
                                                                onClick={() =>
                                                                    handleLoadSave(campaignID, save._id)
                                                                }
                                                                disabled={busyAction === loadKey}
                                                                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                                                    isActive
                                                                        ? "border-website-highlights-500/70 bg-website-highlights-500/15"
                                                                        : "border-slate-700 bg-slate-800/40 hover:bg-slate-700/40"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-semibold text-website-neutral-100 truncate">
                                                                        {save.name}
                                                                    </span>
                                                                    {isActive && (
                                                                        <span className="text-[10px] uppercase tracking-wider text-website-highlights-300">
                                                                            Active
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                                                                    <Upload className="size-3" />
                                                                    {formatDateLabel(
                                                                        save.updatedAt || save.createdAt
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                                    Lobby Description
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Click this card to open the lobby description popup.
                                                </div>
                                            </>
                                        )}
                                    </IndexCardFolder.File.Bottom>
                                </IndexCardFolder.File>
                            );
                        })}

                    <IndexCardFolder.File
                        to={`/ISK/${safeSessionID}/lobby/create`}
                        className="!aspect-auto min-h-[520px] !grid-rows-[auto_auto_1fr] hover:!scale-100 hover:!translate-y-0"
                    >
                        <IndexCardFolder.File.Bottom className="justify-center">
                            <div className="text-3xl text-website-specials-400">+</div>
                            <IndexCardFolder.File.Detail className="mt-3 text-center text-sm">
                                Create New Campaign
                            </IndexCardFolder.File.Detail>
                        </IndexCardFolder.File.Bottom>
                    </IndexCardFolder.File>
                </IndexCardFolder>

                {loading && (
                    <div className="px-6 text-left text-sm text-slate-400 pb-6">Loading campaigns...</div>
                )}

                {descriptionModalCampaign && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
                        onClick={() => setDescriptionModalCampaignID("")}
                    >
                        <div
                            className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 p-5 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold">
                                        {descriptionModalCampaign.name || "Campaign"}
                                    </h2>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {descriptionModalCampaign.dmName
                                            ? `DM: ${descriptionModalCampaign.dmName}`
                                            : "DM not set"}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDescriptionModalCampaignID("")}
                                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                                >
                                    Close
                                </button>
                            </div>

                            <div className="mt-4 rounded border border-slate-700 bg-slate-800/60 px-3 py-3 text-sm text-slate-200 whitespace-pre-wrap">
                                {descriptionModalCampaign.description || "No description set."}
                            </div>
                            <div className="mt-3 text-xs text-slate-400">
                                Setting: {descriptionModalCampaign.setting || "Unspecified"}
                            </div>
                        </div>
                    </div>
                )}
            </Body.Center>

            <Body.Right className="col-start-3" />
            <Body.Footer className="col-span-3" />
        </Body>
    );
}

export default LobbyMenu;
