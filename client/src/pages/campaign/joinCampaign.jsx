import { useContext, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "./socketEmit";

function JoinLobby() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const { sessionID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const safeSessionID = useMemo(
        () => sessionID || sessionStorage.getItem("session_ID") || "default",
        [sessionID]
    );

    const [joinCode, setJoinCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");

    const handleJoin = async (e) => {
        e.preventDefault();

        if (!playerID) {
            setError("Missing player session. Please log in again.");
            return;
        }

        const formattedCode = joinCode.trim().toUpperCase();
        if (!formattedCode) {
            setError("Campaign code is required.");
            return;
        }

        setSubmitting(true);
        setError("");
        setStatus("");

        const response = await emitWithAck(socket, "campaign_join", {
            playerID,
            joinCode: formattedCode,
        });

        setSubmitting(false);

        if (!response?.success) {
            setError(response?.message || "Failed to join campaign");
            return;
        }

        setStatus(response?.alreadyJoined ? "Already in campaign." : "Joined campaign.");
        navigate(`/ISK/${safeSessionID}/lobby`);
    };

    return (
        <Body className="bg-website-default-900 text-website-default-100">
            <Header className="col-span-3" title="Join Campaign" />
            <Body.Left className="row-span-1 col-start-1" />

            <Body.Center className="row-span-1 col-start-2 min-h-screen p-6">
                <div className="max-w-xl mx-auto text-left">
                    <form
                        onSubmit={handleJoin}
                        className="rounded-2xl border border-website-default-700 bg-website-default-800/70 p-6 space-y-5 shadow-2xl"
                    >
                        <div>
                            <label className="block text-xs tracking-wider uppercase text-website-default-300 mb-2">
                                Campaign Code
                            </label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) =>
                                    setJoinCode(
                                        e.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9]/g, "")
                                            .slice(0, 12)
                                    )
                                }
                                className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
                                placeholder="AB12CD"
                                required
                            />
                        </div>

                        {error && (
                            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        )}
                        {status && (
                            <div className="rounded border border-website-highlights-500/40 bg-website-highlights-500/10 px-3 py-2 text-sm text-website-neutral-100">
                                {status}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-lg border border-website-highlights-500/60 bg-website-highlights-500/15 px-4 py-2 text-sm font-semibold text-website-neutral-100 hover:bg-website-highlights-500/25 disabled:opacity-50"
                            >
                                {submitting ? "Joining..." : "Join Campaign"}
                            </button>
                            <Link
                                to={`/ISK/${safeSessionID}/lobby`}
                                className="rounded-lg border border-website-default-600 bg-website-default-800 px-4 py-2 text-sm font-semibold text-website-default-200 hover:bg-website-default-700"
                            >
                                Cancel
                            </Link>
                        </div>
                    </form>
                </div>
            </Body.Center>

            <Body.Right className="col-start-3" />
            <Body.Footer className="col-span-3" />
        </Body>
    );
}

export default JoinLobby;
