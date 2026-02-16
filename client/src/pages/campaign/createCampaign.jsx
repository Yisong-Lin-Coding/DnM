import { useContext, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "./socketEmit";

function CreateLobby() {
    const socket = useContext(SocketContext);
    const navigate = useNavigate();
    const { sessionID } = useParams();
    const playerID = localStorage.getItem("player_ID");

    const safeSessionID = useMemo(
        () => sessionID || sessionStorage.getItem("session_ID") || "default",
        [sessionID]
    );

    const [form, setForm] = useState({
        name: "",
        description: "",
        setting: "",
        maxPlayers: 6,
        isPrivate: false,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleCreate = async (e) => {
        e.preventDefault();

        if (!playerID) {
            setError("Missing player session. Please log in again.");
            return;
        }

        const campaignName = form.name.trim();
        if (!campaignName) {
            setError("Campaign name is required.");
            return;
        }

        setSubmitting(true);
        setError("");

        const response = await emitWithAck(socket, "campaign_create", {
            playerID,
            name: campaignName,
            description: form.description,
            setting: form.setting,
            maxPlayers: Number(form.maxPlayers),
            isPrivate: Boolean(form.isPrivate),
        });

        setSubmitting(false);

        if (!response?.success) {
            setError(response?.message || "Failed to create campaign");
            return;
        }

        navigate(`/ISK/${safeSessionID}/lobby`);
    };

    return (
        <Body className="bg-website-default-900 text-website-default-100">
            <Header className="col-span-3" title="Create Campaign" />
            <Body.Left className="row-span-1 col-start-1" />

            <Body.Center className="row-span-1 col-start-2 min-h-screen p-6">
                <div className="max-w-2xl mx-auto text-left">
                    <form
                        onSubmit={handleCreate}
                        className="rounded-2xl border border-website-default-700 bg-website-default-800/70 p-6 space-y-5 shadow-2xl"
                    >
                        <div>
                            <label className="block text-xs tracking-wider uppercase text-website-default-300 mb-2">
                                Campaign Name
                            </label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
                                placeholder="Ashfall Chronicles"
                                maxLength={80}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs tracking-wider uppercase text-website-default-300 mb-2">
                                Description
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                className="w-full min-h-28 rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
                                placeholder="Give your players a quick overview of this world."
                                maxLength={1000}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs tracking-wider uppercase text-website-default-300 mb-2">
                                    Setting
                                </label>
                                <input
                                    type="text"
                                    value={form.setting}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, setting: e.target.value }))
                                    }
                                    className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
                                    placeholder="Dark Fantasy"
                                    maxLength={120}
                                />
                            </div>
                            <div>
                                <label className="block text-xs tracking-wider uppercase text-website-default-300 mb-2">
                                    Max Players
                                </label>
                                <select
                                    value={form.maxPlayers}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            maxPlayers: Number(e.target.value),
                                        }))
                                    }
                                    className="w-full rounded-lg border border-website-default-600 bg-website-default-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-website-highlights-500"
                                >
                                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => (
                                        <option key={count} value={count}>
                                            {count} Players
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 text-sm text-website-default-200">
                            <input
                                type="checkbox"
                                checked={form.isPrivate}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, isPrivate: e.target.checked }))
                                }
                                className="size-4 rounded border-website-default-600 bg-website-default-900"
                            />
                            Private Campaign
                        </label>

                        {error && (
                            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-lg border border-website-specials-500/60 bg-website-specials-500/15 px-4 py-2 text-sm font-semibold text-website-neutral-100 hover:bg-website-specials-500/25 disabled:opacity-50"
                            >
                                {submitting ? "Creating..." : "Create Campaign"}
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

export default CreateLobby;
