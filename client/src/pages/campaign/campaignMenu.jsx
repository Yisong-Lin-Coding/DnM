import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Globe, Lock, Play, RefreshCcw, Save, Upload, Users } from "lucide-react";
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
                            const saves = saveLists[campaignID] || [];
                            const isSaveLoading = Boolean(saveLoading[campaignID]);
                            const activeSaveID = activeSaveMap[campaignID] || campaign.activeGameSave || "";

                            return (
                                <IndexCardFolder.File key={campaignID} className="min-h-[480px]">
                                    <IndexCardFolder.File.Top>
                                        <div className="flex items-start justify-between gap-3">
                                            <IndexCardFolder.File.Title className="mb-0">
                                                {campaign.name}
                                            </IndexCardFolder.File.Title>
                                            <span className="inline-flex items-center rounded-md border border-website-specials-500/60 bg-website-specials-500/10 px-2 py-1 text-[10px] font-bold tracking-wider text-website-specials-400">
                                                {campaign.joinCode || "NO CODE"}
                                            </span>
                                        </div>
                                        <IndexCardFolder.File.Description className="mt-2 text-xs line-clamp-3">
                                            {campaign.description || "No description set."}
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
                                                    ? `Lobby active: ${campaign.activeLobby?.lobbyCode || "N/A"}`
                                                    : "Lobby inactive"}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate">
                                                Active Save:{" "}
                                                {activeSaveID ? activeSaveID.slice(-8).toUpperCase() : "None"}
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {campaign.activeLobby?.isActive ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleJoinLobby(campaignID, campaign.activeLobby?.lobbyCode || "")
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
                                                    onClick={() => handleStartLobby(campaignID)}
                                                    disabled={busyAction === `start:${campaignID}`}
                                                    className="inline-flex items-center gap-2 rounded-md border border-website-highlights-500/50 bg-website-highlights-500/10 px-3 py-2 text-xs font-semibold text-website-neutral-100 hover:bg-website-highlights-500/20 disabled:opacity-50"
                                                >
                                                    <Play className="size-3.5" />
                                                    Start Lobby
                                                </button>
                                            )}

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
                                        </div>
                                    </IndexCardFolder.File.Middle>

                                    <IndexCardFolder.File.Bottom className="items-stretch gap-2">
                                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                            Recent Saves
                                        </div>
                                        {isSaveLoading && (
                                            <div className="text-xs text-slate-500">Loading saves...</div>
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
                                                        onClick={() => handleLoadSave(campaignID, save._id)}
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
                                                            {formatDateLabel(save.updatedAt || save.createdAt)}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                    </IndexCardFolder.File.Bottom>
                                </IndexCardFolder.File>
                            );
                        })}

                    <IndexCardFolder.File to={`/ISK/${safeSessionID}/lobby/create`}>
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
            </Body.Center>

            <Body.Right className="col-start-3" />
            <Body.Footer className="col-span-3" />
        </Body>
    );
}

export default LobbyMenu;
