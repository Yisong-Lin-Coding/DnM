// c:\Projects\client\src\pageComponents\gamesidepanel\journal.jsx
import { useState, useMemo, useEffect, useRef, useCallback, useContext } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Users, Bookmark, Plus, Search, ChevronLeft, Trash2, Pencil } from "lucide-react";
import { SocketContext } from "../../socket.io/context";
import { emitWithAck } from "../../pages/campaign/socketEmit";

const generateId = () => Math.random().toString(36).substr(2, 9);

const CURSOR_COLORS = [
  "#38bdf8",
  "#f97316",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#4ade80",
];

const getCursorColor = (value) => {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % CURSOR_COLORS.length;
  }
  return CURSOR_COLORS[hash] || CURSOR_COLORS[0];
};

const getCursorLabel = (value) => {
  const text = String(value || "").trim();
  if (!text) return "USER";
  return text.length > 14 ? `${text.slice(0, 12)}…` : text;
};

const getCaretCoordinates = (textarea, position) => {
  if (!textarea || typeof document === "undefined") {
    return { top: 0, left: 0 };
  }

  const style = window.getComputedStyle(textarea);
  const div = document.createElement("div");
  const properties = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "letterSpacing",
    "wordSpacing",
  ];

  properties.forEach((prop) => {
    div.style[prop] = style[prop];
  });

  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0px";
  div.style.left = "-9999px";

  const safePosition = Math.max(0, Math.min(Number(position) || 0, textarea.value.length));
  div.textContent = textarea.value.substring(0, safePosition);

  const span = document.createElement("span");
  span.textContent = textarea.value.substring(safePosition) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const top = span.offsetTop;
  const left = span.offsetLeft;
  document.body.removeChild(div);

  return { top, left };
};

const normalizeIconColor = (value) => {
  const raw = String(value || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  return "";
};

const buildTextPatch = (prevText, nextText) => {
  const prev = String(prevText ?? "");
  const next = String(nextText ?? "");
  if (prev === next) return null;
  let start = 0;
  const prevLen = prev.length;
  const nextLen = next.length;
  while (start < prevLen && start < nextLen && prev[start] === next[start]) {
    start += 1;
  }
  let endPrev = prevLen - 1;
  let endNext = nextLen - 1;
  while (endPrev >= start && endNext >= start && prev[endPrev] === next[endNext]) {
    endPrev -= 1;
    endNext -= 1;
  }
  const deleteCount = Math.max(0, endPrev - start + 1);
  const text = endNext >= start ? next.slice(start, endNext + 1) : "";
  return { start, deleteCount, text };
};

const MarkdownView = ({ content, onLinkClick }) => {
  const html = useMemo(() => {
    if (!content) return "";
    // Basic Markdown Parser
    let text = String(content)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\[\[(.*?)\]\]/g, '<button class="text-cyan-400 hover:text-cyan-300 hover:underline bg-transparent border-none p-0 m-0 font-inherit cursor-pointer" data-link-title="$1">$1</button>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-blue-300 mb-2 mt-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-blue-200 mb-2 mt-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-blue-100 mb-3 mt-4 border-b border-slate-600 pb-1">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<b class="text-white">$1</b>')
      .replace(/\*(.*)\*/gim, '<i class="text-slate-300">$1</i>')
      .replace(/`(.*)`/gim, '<code class="bg-slate-800 px-1 rounded text-orange-300 font-mono text-xs">$1</code>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br />');

    // Wrap list items in <ul>
    text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>').replace(/<\/ul><br \/><ul>/g, "");

    return text;
  }, [content]);

  const handleContentClick = (e) => {
    if (e.target.tagName === "BUTTON" && e.target.dataset.linkTitle && onLinkClick) {
      onLinkClick(e.target.dataset.linkTitle);
    }
  };

  return (
    <div
      className="prose prose-invert text-sm max-w-none leading-relaxed text-slate-300"
      onClick={handleContentClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default function JournalPanel({ journalState, onUpdateJournalState, playerID }) {
  const socket = useContext(SocketContext);
  const { gameID } = useParams();
  const playerName = useMemo(() => {
    if (typeof window === "undefined") return "Player";
    return window.localStorage.getItem("player_username") || "Player";
  }, []);

  // Fallback state if props are missing
  const [localState, setLocalState] = useState({ documents: [], groups: [] });
  const state = journalState || localState;
  const updateState = onUpdateJournalState || setLocalState;
  const updateStateSafe = useCallback((updater) => {
    if (typeof updater === "function") {
      updateState((prev) => updater(prev));
      return;
    }
    updateState(updater);
  }, [updateState]);

  const [activeTab, setActiveTab] = useState("diary"); // 'diary' | 'team'
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [editingDocId, setEditingDocId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("stylized"); // 'code' | 'stylized'
  const [dropTargetId, setDropTargetId] = useState(null);
  const MIN_SIDEBAR_WIDTH = 56;
  const MAX_SIDEBAR_WIDTH = 260;
  const DEFAULT_SIDEBAR_WIDTH = 176;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    const saved = window.localStorage.getItem("cc_journalSidebarWidth");
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : DEFAULT_SIDEBAR_WIDTH;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const sidebarDragRef = useRef(null);
  const showGroupLabels = !sidebarCollapsed && sidebarWidth >= 140;
  const effectiveSidebarWidth = sidebarCollapsed ? MIN_SIDEBAR_WIDTH : sidebarWidth;
  const groupButtonLayoutClass = showGroupLabels ? "justify-start" : "justify-center";
  const groupButtonPaddingClass = showGroupLabels ? "pr-10" : "pr-2";
  const pageContainerClass = sidebarCollapsed ? "w-full" : "mx-auto w-full max-w-3xl";

  const textareaRef = useRef(null);
  const [textareaScroll, setTextareaScroll] = useState({ top: 0, left: 0 });
  const [remoteCursors, setRemoteCursors] = useState({});
  const cursorUpdateTimerRef = useRef(null);
  const lastCursorRef = useRef({ docId: null, position: null });
  const lastSentContentRef = useRef({});
  const lastActiveDocIdRef = useRef(null);
  const lastSeenDocContentRef = useRef({});
  const draftContentRef = useRef("");
  const contentSyncTimerRef = useRef(null);
  const pendingContentRef = useRef(null);
  const previewTimerRef = useRef(null);
  const [previewContent, setPreviewContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [groupEditor, setGroupEditor] = useState({
    open: false,
    group: null,
    name: "",
    color: "#e2e8f0",
  });

  // Filter documents based on tab, search, and group
  const filteredDocs = useMemo(() => {
    const docs = Array.isArray(state.documents) ? state.documents : [];
    return docs
      .filter((doc) => {
        // Tab filter
        if (activeTab === "diary") {
          if (doc.type !== "diary" || String(doc.ownerId) !== String(playerID)) return false;
        } else {
          if (doc.type !== "team") return false;
        }

        // Group filter
        if (selectedGroupId !== "all" && doc.groupId !== selectedGroupId) return false;

        // Search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const dateStr = new Date(doc.createdAt).toLocaleDateString().toLowerCase();
          const matches =
            doc.title.toLowerCase().includes(q) ||
            doc.content.toLowerCase().includes(q) ||
            (doc.tags || []).some((t) => t.toLowerCase().includes(q)) ||
            dateStr.includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [state.documents, activeTab, playerID, selectedGroupId, searchQuery]);

  // Get groups relevant to current tab
  const activeGroups = useMemo(() => {
    const groups = Array.isArray(state.groups) ? state.groups : [];
    return groups.filter((g) => g.type === activeTab && (activeTab === "team" || String(g.ownerId) === String(playerID)));
  }, [state.groups, activeTab, playerID]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sidebarCollapsed) {
      window.localStorage.setItem("cc_journalSidebarWidth", String(sidebarWidth));
    }
  }, [sidebarWidth, sidebarCollapsed]);

  const handleSidebarResizeStart = (event) => {
    event.preventDefault();
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
    sidebarDragRef.current = {
      startX: event.clientX,
      startWidth: effectiveSidebarWidth,
    };
    setIsDraggingSidebar(true);
  };

  const handleToggleMargins = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const openGroupEditor = (group) => {
    if (!group) return;
    setGroupEditor({
      open: true,
      group,
      name: group.name || "",
      color: group.iconColor || "#e2e8f0",
    });
  };

  const closeGroupEditor = () => {
    setGroupEditor({
      open: false,
      group: null,
      name: "",
      color: "#e2e8f0",
    });
  };

  const handleGroupEditorSave = () => {
    if (!groupEditor.group) return;
    const nameLabel = String(groupEditor.name || "").trim();
    if (!nameLabel) return;
    const iconColor = normalizeIconColor(groupEditor.color) || groupEditor.group.iconColor || "#e2e8f0";
    const icon = nameLabel.charAt(0).toUpperCase() || groupEditor.group.icon || "G";

    updateStateSafe((prev) => ({
      ...prev,
      groups: (Array.isArray(prev.groups) ? prev.groups : []).map((g) =>
        g.id === groupEditor.group.id
          ? { ...g, name: nameLabel, icon, iconColor }
          : g
      ),
    }));

    sendJournalUpdate({
      action: "group_update",
      groupId: groupEditor.group.id,
      updates: { name: nameLabel, icon, iconColor },
    });
    closeGroupEditor();
  };

  useEffect(() => {
    if (!socket || !gameID) return undefined;

    const handleCursorUpdate = (payload = {}) => {
      if (String(payload?.campaignID || "") !== String(gameID)) return;
      if (String(payload?.playerID || "") === String(playerID)) return;
      if (!payload?.docId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [payload.playerID]: {
          ...payload,
          receivedAt: Date.now(),
        },
      }));
    };

    socket.on("campaign_journalCursor", handleCursorUpdate);
    return () => {
      socket.off("campaign_journalCursor", handleCursorUpdate);
    };
  }, [socket, gameID, playerID]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors((prev) => {
        const now = Date.now();
        const next = {};
        Object.entries(prev).forEach(([key, cursor]) => {
          if (now - Number(cursor?.receivedAt || 0) < 10000) {
            next[key] = cursor;
          }
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isDraggingSidebar) return undefined;
    const handleMove = (event) => {
      if (!sidebarDragRef.current) return;
      const { startX, startWidth } = sidebarDragRef.current;
      const delta = event.clientX - startX;
      const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + delta));
      setSidebarWidth(nextWidth);
    };
    const handleUp = () => {
      sidebarDragRef.current = null;
      setIsDraggingSidebar(false);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingSidebar, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH]);

  const pendingDocUpdateRef = useRef(null);
  const docUpdateTimerRef = useRef(null);

  const sendJournalUpdate = useCallback((payload) => {
    if (!socket || !gameID || !playerID) return;
    emitWithAck(socket, "campaign_journalUpdate", {
      playerID,
      campaignID: gameID,
      ...payload,
    });
  }, [socket, gameID, playerID]);

  const sendDocUpdate = useCallback((docId, updates = {}) => {
    if (!docId) return;
    const nextUpdates = { ...updates };
    let nextContent = null;

    if (typeof nextUpdates.content === "string") {
      nextContent = nextUpdates.content;
      const baseline = lastSentContentRef.current[docId];
      if (typeof baseline === "string") {
        const patch = buildTextPatch(baseline, nextContent);
        if (patch) {
          delete nextUpdates.content;
          nextUpdates.contentPatch = patch;
        } else {
          delete nextUpdates.content;
        }
      }
    }

    if (Object.keys(nextUpdates).length === 0) return;
    sendJournalUpdate({ action: "doc_update", docId, updates: nextUpdates });

    if (nextContent != null) {
      lastSentContentRef.current[docId] = nextContent;
    }
  }, [sendJournalUpdate]);

  const queueDocUpdate = useCallback((docId, updates, options = {}) => {
    if (!docId) return;
    const immediate = Boolean(options.immediate);

    if (immediate) {
      sendDocUpdate(docId, updates);
      return;
    }

    if (!pendingDocUpdateRef.current || pendingDocUpdateRef.current.docId !== docId) {
      pendingDocUpdateRef.current = { docId, updates: { ...updates } };
    } else {
      pendingDocUpdateRef.current.updates = {
        ...pendingDocUpdateRef.current.updates,
        ...updates,
      };
    }

    if (docUpdateTimerRef.current) {
      clearTimeout(docUpdateTimerRef.current);
    }

    docUpdateTimerRef.current = setTimeout(() => {
      docUpdateTimerRef.current = null;
      const pending = pendingDocUpdateRef.current;
      pendingDocUpdateRef.current = null;
      if (pending) {
        sendDocUpdate(pending.docId, pending.updates);
      }
    }, 90);
  }, [sendDocUpdate]);

  useEffect(() => {
    return () => {
      if (docUpdateTimerRef.current) {
        clearTimeout(docUpdateTimerRef.current);
      }
      if (pendingDocUpdateRef.current) {
        sendDocUpdate(
          pendingDocUpdateRef.current.docId,
          pendingDocUpdateRef.current.updates
        );
        pendingDocUpdateRef.current = null;
      }
    };
  }, [sendDocUpdate]);

  const sendCursorUpdate = useCallback((docId, position) => {
    if (!socket || !gameID || !playerID || !docId) return;
    const cachedName =
      typeof window !== "undefined" ? window.localStorage.getItem("player_username") : "";
    const name = cachedName || playerName || "Player";
    const emitter = socket.volatile || socket;
    emitter.emit("campaign_journalCursor", {
      playerID,
      playerName: name,
      campaignID: gameID,
      docId,
      position,
    });
  }, [socket, gameID, playerID, playerName]);

  const queueCursorUpdate = useCallback((docId, position) => {
    if (!docId) return;
    const safePosition = Math.max(0, Math.round(Number(position) || 0));
    if (
      lastCursorRef.current.docId === docId &&
      lastCursorRef.current.position === safePosition
    ) {
      return;
    }
    lastCursorRef.current = { docId, position: safePosition };
    if (cursorUpdateTimerRef.current) {
      clearTimeout(cursorUpdateTimerRef.current);
    }
    cursorUpdateTimerRef.current = setTimeout(() => {
      cursorUpdateTimerRef.current = null;
      sendCursorUpdate(docId, safePosition);
    }, 80);
  }, [sendCursorUpdate]);

  useEffect(() => {
    return () => {
      if (cursorUpdateTimerRef.current) {
        clearTimeout(cursorUpdateTimerRef.current);
      }
    };
  }, []);

  const flushPendingContent = useCallback(() => {
    const pending = pendingContentRef.current;
    if (!pending) return;
    pendingContentRef.current = null;
    if (contentSyncTimerRef.current) {
      clearTimeout(contentSyncTimerRef.current);
      contentSyncTimerRef.current = null;
    }
    updateStateSafe((prev) => {
      const docs = Array.isArray(prev.documents) ? prev.documents : [];
      const nextDocs = docs.map((doc) =>
        doc.id === pending.docId
          ? { ...doc, content: pending.content, updatedAt: Date.now() }
          : doc
      );
      return { ...prev, documents: nextDocs };
    });
    queueDocUpdate(pending.docId, { content: pending.content }, { immediate: true });
  }, [queueDocUpdate, updateStateSafe]);

  const queueContentSync = useCallback((docId, content) => {
    if (!docId) return;
    pendingContentRef.current = { docId, content };
    if (contentSyncTimerRef.current) {
      clearTimeout(contentSyncTimerRef.current);
    }
    contentSyncTimerRef.current = setTimeout(() => {
      flushPendingContent();
    }, 350);
  }, [flushPendingContent]);

  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  useEffect(() => {
    if (!editingDocId) return;
    const docs = Array.isArray(state.documents) ? state.documents : [];
    if (!docs.some((doc) => doc.id === editingDocId)) {
      setEditingDocId(null);
    }
  }, [state.documents, editingDocId]);

  useEffect(() => {
    if (!editingDocId) {
      lastActiveDocIdRef.current = null;
      setDraftContent("");
      setPreviewContent("");
    }
  }, [editingDocId]);

  useEffect(() => {
    flushPendingContent();
  }, [editingDocId, flushPendingContent]);

  useEffect(() => {
    return () => {
      if (contentSyncTimerRef.current) {
        clearTimeout(contentSyncTimerRef.current);
        contentSyncTimerRef.current = null;
      }
      flushPendingContent();
    };
  }, [flushPendingContent]);

  const handleCreateDoc = () => {
    if (!playerID) return;
    const docs = Array.isArray(state.documents) ? state.documents : [];

    // Generate unique title
    let title = "Unnamed Document";
    let counter = 1;
    const existingTitles = new Set(docs.map((d) => d.title));
    while (existingTitles.has(title)) {
      title = `Unnamed Document(${counter})`;
      counter++;
    }

    const newDoc = {
      id: generateId(),
      type: activeTab,
      ownerId: playerID,
      title,
      content: "",
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      groupId: selectedGroupId === "all" ? null : selectedGroupId,
    };

    updateStateSafe((prev) => ({
      ...prev,
      documents: [newDoc, ...(Array.isArray(prev.documents) ? prev.documents : [])],
    }));
    setEditingDocId(newDoc.id);
    setViewMode("code");
    setDraftContent(newDoc.content || "");
    lastSentContentRef.current[newDoc.id] = newDoc.content || "";
    sendJournalUpdate({ action: "doc_create", doc: newDoc });
  };

  const handleUpdateDoc = (id, updates, options = {}) => {
    if (!id) return;
    const sync = options.sync !== false;
    updateStateSafe((prev) => {
      const docs = Array.isArray(prev.documents) ? prev.documents : [];
      const nextDocs = docs.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d));
      return { ...prev, documents: nextDocs };
    });
    if (sync) {
      queueDocUpdate(id, updates, { immediate: options.immediate });
    }
  };

  const activeDoc = useMemo(() => {
    return (state.documents || []).find((d) => d.id === editingDocId);
  }, [state.documents, editingDocId]);

  useEffect(() => {
    if (!activeDoc) return;
    const docId = activeDoc.id;
    const currentContent = activeDoc.content || "";
    const lastSeen = lastSeenDocContentRef.current[docId];

    if (docId !== lastActiveDocIdRef.current) {
      lastActiveDocIdRef.current = docId;
      lastSentContentRef.current[docId] = currentContent;
      setDraftContent(currentContent);
    } else if (draftContentRef.current === lastSeen) {
      setDraftContent(currentContent);
    }

    lastSeenDocContentRef.current[docId] = currentContent;
  }, [activeDoc?.id, activeDoc?.content]);

  useEffect(() => {
    if (!activeDoc || viewMode !== "stylized") return;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewContent(draftContent || "");
  }, [activeDoc?.id, viewMode]);

  useEffect(() => {
    if (!activeDoc || viewMode !== "stylized") return;
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewContent(draftContent || "");
      previewTimerRef.current = null;
    }, 120);
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [draftContent, viewMode, activeDoc?.id]);

  useEffect(() => {
    if (!activeDoc || activeDoc.type !== "team" || viewMode !== "code") return;
    if (!textareaRef.current) return;
    queueCursorUpdate(activeDoc.id, textareaRef.current.selectionStart ?? 0);
  }, [activeDoc, viewMode, queueCursorUpdate]);

  const renderRemoteCursors = () => {
    if (!activeDoc || activeDoc.type !== "team" || viewMode !== "code") return null;
    const textarea = textareaRef.current;
    if (!textarea) return null;
    const value = textarea.value || "";
    return Object.values(remoteCursors)
      .filter((cursor) => String(cursor?.docId || "") === String(activeDoc.id))
      .map((cursor) => {
        const position = Math.max(0, Math.min(Number(cursor.position) || 0, value.length));
        const coords = getCaretCoordinates(textarea, position);
        const top = coords.top - textareaScroll.top;
        const left = coords.left - textareaScroll.left;
        const color = getCursorColor(cursor.playerID || cursor.playerName);
        const label = getCursorLabel(cursor.playerName || cursor.playerID);
        return (
          <div
            key={`${cursor.playerID}-${cursor.docId}`}
            className="pointer-events-none absolute"
            style={{
              top: Math.max(2, top + 2),
              left: Math.max(2, left + 2),
              zIndex: 20,
            }}
          >
            <div
              className="h-5 w-[2px]"
              style={{ backgroundColor: color }}
            />
            <div
              className="mt-1 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-950"
              style={{ backgroundColor: color }}
            >
              {label}
            </div>
          </div>
        );
      });
  };

  const handleEditorCursor = useCallback((event) => {
    if (!activeDoc || activeDoc.type !== "team") return;
    const target = event?.target;
    if (!target) return;
    queueCursorUpdate(activeDoc.id, target.selectionStart ?? 0);
  }, [activeDoc, queueCursorUpdate]);

  const handleEditorChange = useCallback((event) => {
    if (!activeDoc) return;
    const nextValue = event.target.value;
    setDraftContent(nextValue);
    queueContentSync(activeDoc.id, nextValue);
    handleEditorCursor(event);
  }, [activeDoc, handleEditorCursor, queueContentSync]);

  const handleEditorScroll = useCallback((event) => {
    setTextareaScroll({
      top: event.target.scrollTop,
      left: event.target.scrollLeft,
    });
  }, []);

  const handleLinkClick = (title) => {
    const docs = Array.isArray(state.documents) ? state.documents : [];
    // Search all documents to allow cross-linking (e.g., diary to team)
    const targetDoc = docs.find((d) => d.title.toLowerCase() === title.toLowerCase());
    if (targetDoc) {
      // Ensure the linked doc is accessible to the current user
      if (targetDoc.type === "team" || (targetDoc.type === "diary" && String(targetDoc.ownerId) === String(playerID))) {
        // If switching from diary to team or vice-versa, update the active tab
        if (targetDoc.type !== activeTab) {
          setActiveTab(targetDoc.type);
        }
        setEditingDocId(targetDoc.id);
      } else {
        // eslint-disable-next-line no-alert
        alert(`You do not have permission to view the document "${title}".`);
      }
    } else {
      // eslint-disable-next-line no-alert
      alert(`Journal document named "${title}" not found.`);
    }
  };

  const handleDeleteDoc = (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    if (pendingContentRef.current?.docId === id) {
      pendingContentRef.current = null;
      if (contentSyncTimerRef.current) {
        clearTimeout(contentSyncTimerRef.current);
        contentSyncTimerRef.current = null;
      }
    }
    updateStateSafe((prev) => ({
      ...prev,
      documents: (Array.isArray(prev.documents) ? prev.documents : []).filter((d) => d.id !== id),
    }));
    if (editingDocId === id) setEditingDocId(null);
    sendJournalUpdate({ action: "doc_delete", docId: id });
  };

  const handleCreateGroup = () => {
    const name = prompt("Enter group name:");
    if (!name) return;
    if (!playerID) return;
    const label = String(name).trim();
    const icon = label.charAt(0).toUpperCase() || "G";
    const iconColor = normalizeIconColor(prompt("Icon color (hex, e.g. #38bdf8):", "#e2e8f0")) || "#e2e8f0";
    const newGroup = {
      id: generateId(),
      name: label,
      icon,
      iconColor,
      type: activeTab,
      ownerId: playerID,
    };
    updateStateSafe((prev) => ({
      ...prev,
      groups: [...(Array.isArray(prev.groups) ? prev.groups : []), newGroup],
    }));
    setSelectedGroupId(newGroup.id);
    sendJournalUpdate({ action: "group_create", group: newGroup });
  };

  const handleEditGroup = (group) => {
    openGroupEditor(group);
  };

  const handleDragStart = (e, docId) => {
    e.dataTransfer.setData("application/journal-doc-id", docId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, groupId) => {
    e.preventDefault();
    if (dropTargetId !== groupId) {
      setDropTargetId(groupId);
    }
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = (e, groupId) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData("application/journal-doc-id");
    if (docId) {
      handleUpdateDoc(docId, { groupId: groupId === "all" ? null : groupId }, { immediate: true });
    }
    setDropTargetId(null);
  };

  return (
    <div className="h-full min-h-0 bg-slate-950 text-slate-100 relative">
      <div className="h-full min-h-0 p-4">
        <div className="h-full min-h-0 rounded-xl border border-slate-700/80 bg-slate-900/80 overflow-hidden flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          {/* Header Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-700/70 bg-slate-900/90 px-3 py-2">
            <button
              onClick={() => { setActiveTab("diary"); setSelectedGroupId("all"); setEditingDocId(null); }}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeTab === "diary"
                  ? "bg-slate-800 text-slate-100 border border-slate-600 shadow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <BookOpen size={14} /> Diary
            </button>
            <button
              onClick={() => { setActiveTab("team"); setSelectedGroupId("all"); setEditingDocId(null); }}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                activeTab === "team"
                  ? "bg-slate-800 text-slate-100 border border-slate-600 shadow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Users size={14} /> Team Journal
            </button>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-[11px] uppercase tracking-widest text-slate-500">
                {filteredDocs.length} {filteredDocs.length === 1 ? "document" : "documents"}
              </div>
              <button
                onClick={handleToggleMargins}
                className="text-[10px] uppercase tracking-widest text-slate-400 border border-slate-700 rounded-full px-3 py-1 hover:text-slate-200 hover:border-slate-500 transition"
                title="Toggle zero margins"
              >
                {sidebarCollapsed ? "Show Labels" : "Zero Margins"}
              </button>
            </div>
          </div>

          <div className="flex-1 flex min-h-0 relative overflow-visible">
            {/* Sidebar Groups */}
            <div
              className="relative z-20 flex-shrink-0 border-r border-slate-700/70 bg-slate-950/70 py-4 pl-2 pr-1 overflow-y-auto overflow-x-visible scrollbar-transparent"
              style={{ width: effectiveSidebarWidth }}
            >
              <div className="flex flex-col items-start gap-2 overflow-visible">
                <div
                  className="relative group"
                  onDragOver={(e) => handleDragOver(e, "all")}
                  onDrop={(e) => handleDrop(e, "all")}
                  onDragLeave={handleDragLeave}
                >
                  <button
                    onClick={() => setSelectedGroupId("all")}
                    className={`relative flex items-center ${groupButtonLayoutClass} h-11 w-full px-2 ${groupButtonPaddingClass} overflow-hidden rounded-r-2xl rounded-l-md border transition-[background-color,box-shadow] duration-200 ${
                      selectedGroupId === "all"
                        ? "bg-slate-800 text-slate-100 border-slate-600 shadow"
                        : "bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800/80"
                    } ${dropTargetId === "all" ? "ring-2 ring-cyan-400/80" : ""}`}
                    title="All Documents"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950/70 border border-slate-700 text-slate-200">
                      <Bookmark size={14} />
                    </span>
                    <span className={`ml-3 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap transition-opacity duration-200 ${
                      showGroupLabels ? "opacity-100" : "opacity-0"
                    }`}>
                      All Docs
                    </span>
                  </button>
                </div>

                {activeGroups.map((group) => {
                  const groupGlyph = group.icon || group.name?.charAt(0)?.toUpperCase() || "G";
                  return (
                    <div
                      key={group.id}
                      className="relative group"
                      onDragOver={(e) => handleDragOver(e, group.id)}
                      onDrop={(e) => handleDrop(e, group.id)}
                      onDragLeave={handleDragLeave}
                    >
                      <button
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`relative flex items-center ${groupButtonLayoutClass} h-11 w-full px-2 ${groupButtonPaddingClass} overflow-hidden rounded-r-2xl rounded-l-md border transition-[background-color,box-shadow] duration-200 ${
                          selectedGroupId === group.id
                            ? "bg-slate-800 text-slate-100 border-slate-600 shadow"
                            : "bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-800/80"
                        } ${dropTargetId === group.id ? "ring-2 ring-cyan-400/80" : ""}`}
                        title={group.name}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950/70 border border-slate-700 text-[13px] font-semibold text-slate-200">
                          <span style={{ color: group.iconColor || "#e2e8f0" }}>{groupGlyph}</span>
                        </span>
                        <span className={`ml-3 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap transition-opacity duration-200 ${
                          showGroupLabels ? "opacity-100" : "opacity-0"
                        }`}>
                          {group.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group);
                        }}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md border border-slate-700 bg-slate-900/80 text-slate-400 transition-opacity duration-150 hover:text-slate-200 ${
                          showGroupLabels ? "opacity-0 group-hover:opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                        title="Edit group"
                      >
                        <Pencil size={13} className="mx-auto" />
                      </button>
                    </div>
                  );
                })}

                <div className="h-px w-10 bg-slate-700/60 my-1 ml-1"></div>

                <button
                  onClick={handleCreateGroup}
                  className={`group relative flex items-center ${groupButtonLayoutClass} h-11 w-full px-2 ${groupButtonPaddingClass} overflow-hidden rounded-r-2xl rounded-l-md border border-dashed border-slate-700 text-slate-400 hover:text-emerald-200 hover:bg-slate-800/70 transition-[background-color] duration-200`}
                  title="Create Group"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950/70 border border-slate-700 text-slate-300">
                    <Plus size={14} />
                  </span>
                  <span className={`ml-3 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap transition-opacity duration-200 ${
                    showGroupLabels ? "opacity-100" : "opacity-0"
                  }`}>
                    New Group
                  </span>
                </button>
              </div>
            </div>

            <div
              className="w-2 cursor-col-resize bg-slate-900/70 hover:bg-slate-800 transition-colors"
              onMouseDown={handleSidebarResizeStart}
            />

            {/* Main Content Area */}
            <div className="relative z-0 flex-1 flex flex-col min-w-0 bg-slate-900/40">
              {!editingDocId ? (
                // Document List View
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-3 border-b border-slate-700/70 bg-slate-900/70">
                    <div className={pageContainerClass}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 bg-slate-950/60 border border-slate-700/70 rounded-lg px-2 py-1.5">
                          <Search size={14} className="text-slate-500" />
                          <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={handleCreateDoc}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
                        >
                          <Plus size={14} /> New
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className={`${pageContainerClass} p-3 space-y-2`}>
                    {filteredDocs.length === 0 ? (
                      <div className="text-center text-slate-500 mt-10 text-sm">
                        No documents found.
                      </div>
                    ) : (
                      filteredDocs.map((doc) => (
                        <div
                          key={doc.id}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, doc.id)}
                          onClick={() => setEditingDocId(doc.id)}
                          className="group rounded-lg border border-slate-700/70 bg-slate-900/60 hover:border-slate-500/80 hover:bg-slate-900/80 p-3 cursor-pointer transition"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-slate-200 truncate pr-2">{doc.title}</h4>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {new Date(doc.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2 mb-2 min-h-[32px]">
                            {doc.content ? doc.content : <span className="italic text-slate-600">Empty document...</span>}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {doc.tags && doc.tags.map((tag, i) => (
                              <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                    </div>
                  </div>
                </div>
              ) : activeDoc ? (
                // Document Editor View
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Editor Header */}
                  <div className="p-3 border-b border-slate-700/70 bg-slate-900/70 space-y-3">
                    <div className={`${pageContainerClass} space-y-3`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingDocId(null)}
                          className="flex items-center justify-center h-8 w-8 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/70 transition"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <input
                          type="text"
                          value={activeDoc?.title || ""}
                          onChange={(e) => activeDoc && handleUpdateDoc(activeDoc.id, { title: e.target.value })}
                          className="flex-1 bg-transparent text-lg font-semibold text-white focus:outline-none border-b border-transparent focus:border-slate-600 px-1"
                          placeholder="Document Title"
                        />
                        <div className="flex items-center bg-slate-950/70 border border-slate-700 rounded-full p-0.5">
                          <button
                            onClick={() => setViewMode("code")}
                            className={`px-2.5 py-1 text-[11px] rounded-full ${
                              viewMode === "code" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Code
                          </button>
                          <button
                            onClick={() => setViewMode("stylized")}
                            className={`px-2.5 py-1 text-[11px] rounded-full ${
                              viewMode === "stylized" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            View
                          </button>
                        </div>
                        <button
                          onClick={() => handleDeleteDoc(activeDoc.id)}
                          className="flex items-center justify-center h-8 w-8 rounded-full border border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-500/60 transition"
                          title="Delete Document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">Tags</span>
                        <input
                          type="text"
                          value={(activeDoc?.tags || []).join(", ")}
                          onChange={(e) => activeDoc && handleUpdateDoc(activeDoc.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                          className="flex-1 min-w-[180px] bg-slate-950/60 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-slate-500"
                          placeholder="tag1, tag2..."
                        />
                        <select
                          value={activeDoc?.groupId || "all"}
                          onChange={(e) => activeDoc && handleUpdateDoc(activeDoc.id, { groupId: e.target.value === "all" ? null : e.target.value })}
                          className="bg-slate-950/60 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none min-w-[140px]"
                        >
                          <option value="all">No Group</option>
                          {activeGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.icon ? `${g.icon} ` : ""}{g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="flex-1 overflow-hidden relative">
                    {viewMode === "code" ? (
                      <div className={`${pageContainerClass} h-full relative`}>
                        <textarea
                          ref={textareaRef}
                          value={draftContent}
                          onChange={handleEditorChange}
                          onSelect={handleEditorCursor}
                          onKeyUp={handleEditorCursor}
                          onMouseUp={handleEditorCursor}
                          onFocus={handleEditorCursor}
                          onScroll={handleEditorScroll}
                          className="w-full h-full bg-slate-950/70 p-4 text-sm font-mono text-slate-200 focus:outline-none resize-none"
                          placeholder="Write your notes here... (Markdown supported)"
                        />
                        <div className="pointer-events-none absolute inset-0">
                          {renderRemoteCursors()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full overflow-y-auto">
                        <div className={`${pageContainerClass} h-full bg-slate-950/60 p-6`}>
                          <MarkdownView content={previewContent || ""} onLinkClick={handleLinkClick} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-700/70 text-[10px] text-slate-500">
                    <div className={`${pageContainerClass} flex justify-between`}>
                      <span>Created: {new Date(activeDoc?.createdAt || Date.now()).toLocaleString()}</span>
                      <span>Edited: {new Date(activeDoc?.updatedAt || Date.now()).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  Document not found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {groupEditor.open && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-[360px] rounded-xl border border-slate-700/80 bg-slate-900 p-4 shadow-xl">
            <div className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Group Settings</div>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block text-slate-400 text-xs uppercase tracking-widest">
                Name
                <input
                  type="text"
                  value={groupEditor.name}
                  onChange={(e) => setGroupEditor((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                  placeholder="Group name"
                />
              </label>
              <label className="block text-slate-400 text-xs uppercase tracking-widest">
                Icon Color
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeIconColor(groupEditor.color) || "#e2e8f0"}
                    onChange={(e) => setGroupEditor((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-10 w-12 rounded border border-slate-700 bg-slate-950/70"
                  />
                  <input
                    type="text"
                    value={groupEditor.color}
                    onChange={(e) => setGroupEditor((prev) => ({ ...prev, color: e.target.value }))}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100 focus:outline-none focus:border-slate-500"
                    placeholder="#38bdf8"
                  />
                </div>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeGroupEditor}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-widest text-slate-400 hover:text-slate-200 hover:border-slate-500 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGroupEditorSave}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs uppercase tracking-widest text-white hover:bg-blue-500 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
