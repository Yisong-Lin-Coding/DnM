import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Inbox, RefreshCcw, Search } from "lucide-react";
import Mail_Card from "./mail_card";
import { SocketContext } from "../socket.io/context";
import { emitWithAck } from "../pages/campaign/socketEmit";

export default function Header_Mail() {
  const socket = useContext(SocketContext);
  const playerID = localStorage.getItem("player_ID");

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedMessageID, setSelectedMessageID] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const loadMailbox = useCallback(async ({ silent = false } = {}) => {
    if (!socket || !playerID) {
      setLoading(false);
      setMessages([]);
      setError("Missing player session.");
      return false;
    }

    if (!silent) setLoading(true);
    const response = await emitWithAck(socket, "mail_call", { playerID });
    setLoading(false);

    if (!response?.success) {
      setMessages([]);
      setError(response?.message || "Failed to load mailbox");
      return false;
    }

    setMessages(Array.isArray(response.messages) ? response.messages : []);
    setError("");
    window.dispatchEvent(new CustomEvent("mailbox:updated"));
    return true;
  }, [socket, playerID]);

  useEffect(() => {
    loadMailbox();
  }, [loadMailbox]);

  const unreadCount = useMemo(
    () => messages.filter((message) => message?.unread).length,
    [messages]
  );

  const inviteCount = useMemo(
    () =>
      messages.filter(
        (message) => message?.kind === "campaign_invite" && message?.status === "pending"
      ).length,
    [messages]
  );

  const filteredMessages = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return messages.filter((message) => {
      if (activeTab === "unread" && !message?.unread) return false;
      if (activeTab === "invites") {
        if (message?.kind !== "campaign_invite") return false;
      }

      if (!query) return true;

      const sender = String(message?.from?.username || "").toLowerCase();
      const subject = String(message?.subject || "").toLowerCase();
      const body = String(message?.message || "").toLowerCase();
      return sender.includes(query) || subject.includes(query) || body.includes(query);
    });
  }, [messages, activeTab, searchText]);

  const markMessageRead = useCallback(
    async (messageID) => {
      if (!messageID || !playerID) return;
      const response = await emitWithAck(socket, "mail_markRead", {
        playerID,
        messageID,
      });
      if (!response?.success) return;

      setMessages((prev) =>
        prev.map((message) =>
          message._id === messageID ? { ...message, unread: false } : message
        )
      );
    },
    [socket, playerID]
  );

  const openMessage = useCallback(
    (message) => {
      if (!message?._id) return;
      setSelectedMessageID(message._id);
      if (message.unread) {
        markMessageRead(message._id);
      }
    },
    [markMessageRead]
  );

  const handleInviteAction = useCallback(
    async (messageID, action) => {
      if (!messageID || !playerID) return;
      setBusyAction(`${action}:${messageID}`);
      setError("");
      setStatus("");

      const response = await emitWithAck(socket, "mail_respondInvite", {
        playerID,
        messageID,
        action,
      });
      setBusyAction("");

      if (!response?.success) {
        setError(response?.message || "Failed to update invite");
        return;
      }

      if (action === "accept") {
        setStatus(`Joined ${response?.campaignName || "campaign"}.`);
      } else {
        setStatus("Invite declined.");
      }

      await loadMailbox({ silent: true });
      window.dispatchEvent(new CustomEvent("mailbox:updated"));
    },
    [socket, playerID, loadMailbox]
  );

  return (
    <div className="flex flex-col h-[500px] w-full font-body bg-website-default-900">
      <div className="p-4 border-b border-website-default-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-website-specials-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-website-neutral-50">
              Messenger
            </h2>
          </div>
          <button
            type="button"
            onClick={() => loadMailbox()}
            title="Refresh Inbox"
            className="p-2 rounded-full bg-website-default-800 hover:bg-website-default-700 text-website-neutral-100 transition-colors"
          >
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-website-neutral-600"
            size={14}
          />
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search messages..."
            className="w-full bg-website-default-800 border border-website-default-700 rounded-lg py-1.5 pl-9 pr-3 text-xs text-website-neutral-200 placeholder:text-website-neutral-600 focus:outline-none focus:border-website-highlights-500 transition-colors"
          />
        </div>

        <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={activeTab === "all" ? "text-website-specials-500" : "text-website-neutral-500 hover:text-website-neutral-300"}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={activeTab === "unread" ? "text-website-specials-500" : "text-website-neutral-500 hover:text-website-neutral-300"}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            className={activeTab === "invites" ? "text-website-specials-500" : "text-website-neutral-500 hover:text-website-neutral-300"}
          >
            Invites ({inviteCount})
          </button>
        </div>
      </div>

      {(error || status) && (
        <div className="px-3 pt-2 space-y-2">
          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
              {error}
            </div>
          )}
          {status && (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
              {status}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-transparent p-2 space-y-2">
        {loading && (
          <>
            <Mail_Card loading />
            <Mail_Card loading />
            <Mail_Card loading />
          </>
        )}

        {!loading && filteredMessages.length > 0 && filteredMessages.map((message) => {
          const messageID = message._id;
          const isInvite = message.kind === "campaign_invite";
          const invitePending = isInvite && message.status === "pending";
          const actionKeyAccept = `accept:${messageID}`;
          const actionKeyDecline = `decline:${messageID}`;
          const isBusy = busyAction === actionKeyAccept || busyAction === actionKeyDecline;

          return (
            <div key={messageID} className="space-y-1">
              <Mail_Card
                unread={Boolean(message.unread)}
                sender={{ name: message?.from?.username || "System" }}
                subject={message?.subject || "Untitled Message"}
                snippet={message?.snippet || message?.message || ""}
                date={message?.time}
                selected={selectedMessageID === messageID}
                onClick={() => openMessage(message)}
              />

              {selectedMessageID === messageID && (
                <div className="rounded border border-website-default-700 bg-website-default-800/40 px-2 py-2 text-xs text-website-neutral-200 whitespace-pre-wrap">
                  {message?.message || "No message content."}
                  {isInvite && (
                    <div className="mt-2 text-[11px] text-website-neutral-400">
                      Campaign: {message?.payload?.campaignName || "Unknown"}
                    </div>
                  )}
                </div>
              )}

              {isInvite && (
                <div className="flex items-center justify-between gap-2 rounded border border-website-default-800 bg-website-default-900/60 px-2 py-2">
                  <span className="text-[11px] text-website-neutral-400">
                    Invite status: {message.status}
                  </span>
                  {invitePending && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInviteAction(messageID, "decline")}
                        disabled={isBusy}
                        className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInviteAction(messageID, "accept")}
                        disabled={isBusy}
                        className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        Accept
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!loading && filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-website-neutral-600 space-y-2 opacity-60">
            <Inbox size={42} strokeWidth={1} />
            <p className="text-xs uppercase tracking-widest">No messages found</p>
          </div>
        )}
      </div>
    </div>
  );
}
