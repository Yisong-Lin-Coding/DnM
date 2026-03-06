// c:\Projects\client\src\pageComponents\gamesidepanel\quests.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Book,
  ScrollText,
  Sword,
  Skull,
  Shield,
  Sparkles,
  Feather,
  Star,
  Clock,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useGame } from "../../data/gameContext";

const QUEST_CATEGORIES = [
  { key: "main", label: "Main Quests", accent: "text-amber-200", ring: "border-amber-400/30" },
  { key: "side", label: "Side Quests", accent: "text-sky-200", ring: "border-sky-400/30" },
  { key: "mini", label: "Mini Quests", accent: "text-emerald-200", ring: "border-emerald-400/30" },
];

const QUEST_ICONS = {
  book: Book,
  scroll: ScrollText,
  sword: Sword,
  skull: Skull,
  shield: Shield,
  sparkles: Sparkles,
  feather: Feather,
  star: Star,
  clock: Clock,
};

const PAGE_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started", weight: 0 },
  { value: "started", label: "Started", weight: 0.25 },
  { value: "half", label: "Half done", weight: 0.5 },
  { value: "almost", label: "Almost finished", weight: 0.75 },
  { value: "done", label: "Done", weight: 1 },
];

const PAGE_STATUS_LABELS = PAGE_STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const PAGE_STATUS_WEIGHTS = PAGE_STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.weight;
  return acc;
}, {});

const toPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const normalizePageStatus = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (raw === "half_done" || raw === "halfway") return "half";
  if (raw === "almost_finished" || raw === "almost_done") return "almost";
  if (raw === "completed" || raw === "complete") return "done";
  if (PAGE_STATUS_LABELS[raw]) return raw;
  return "not_started";
};

const normalizePage = (page, fallbackId) => {
  const safe = toPlainObject(page);
  const id = String(safe.id || fallbackId || "").trim() || fallbackId;
  const text = String(safe.text || safe.label || "").trim();
  const status = normalizePageStatus(
    safe.status ?? (safe.checked ? "done" : "not_started")
  );
  return {
    ...safe,
    id,
    text,
    status,
  };
};

const normalizeChapter = (chapter, fallback) => {
  const safe = toPlainObject(chapter);
  const fallbackId = fallback?.id || "";
  const fallbackName = fallback?.name || "Chapter";
  const id = String(safe.id || fallbackId || "").trim() || fallbackId;
  const name = String(safe.name || fallbackName || "Chapter").trim() || "Chapter";
  const pagesInput = Array.isArray(safe.pages) ? safe.pages : [];
  const pages = pagesInput.map((page, index) =>
    normalizePage(page, `${id}_page_${index + 1}`)
  );
  return {
    ...safe,
    id,
    name,
    collapsed: Boolean(safe.collapsed),
    visibleToParty: safe.visibleToParty !== false,
    pages,
  };
};

const normalizeQuest = (quest, index) => {
  const safe = toPlainObject(quest);
  const id = String(safe.id || `quest_${index + 1}`);
  const chaptersInput = Array.isArray(safe.chapters) ? safe.chapters : [];
  let chapters = chaptersInput;

  if (!chapters.length) {
    const legacyPages = Array.isArray(safe.checklist) ? safe.checklist : [];
    const chapterName =
      String(safe.chapter || "").trim() || `Chapter 1`;
    chapters = [
      {
        id: `${id}_chapter_1`,
        name: chapterName,
        collapsed: false,
        pages: legacyPages,
      },
    ];
  }

  const normalizedChapters = chapters.map((chapter, chapterIndex) =>
    normalizeChapter(chapter, {
      id: chapter?.id || `${id}_chapter_${chapterIndex + 1}`,
      name: chapter?.name || `Chapter ${chapterIndex + 1}`,
    })
  );

  return {
    ...safe,
    id,
    chapters: normalizedChapters,
  };
};

const normalizeQuestState = (value) => {
  const safe = toPlainObject(value);
  const quests = Array.isArray(safe.quests)
    ? safe.quests.map((quest, index) => {
        const safeQuest = toPlainObject(quest);
        return Object.keys(safeQuest).length > 0
          ? normalizeQuest(safeQuest, index)
          : null;
      }).filter(Boolean)
    : [];
  return { ...safe, quests };
};

const makeId = (prefix) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const buildQuest = (overrides = {}) => ({
  id: makeId("quest"),
  category: "main",
  series: "",
  volume: "",
  title: "Untitled Quest",
  description: "",
  icon: "scroll",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  remainingTime: "",
  showToParty: true,
  chapters: [
    {
      id: makeId("chapter"),
      name: "Chapter 1",
      collapsed: false,
      pages: [],
    },
  ],
  ...overrides,
});

const formatTimestamp = (value) => {
  const ts = Number(value);
  if (!Number.isFinite(ts)) return "Unknown";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
};

const groupBy = (items, keyFn) => {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

const getSeriesLabel = (quest) => String(quest?.series || "").trim() || "Unsorted Series";

const getProgressTone = (progress = 0) => {
  if (progress >= 0.99) {
    return {
      bar: "from-emerald-300 via-emerald-400 to-emerald-500",
      glow: "shadow-[0_0_10px_rgba(16,185,129,0.35)]",
      badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
      dot: "bg-emerald-400",
    };
  }
  if (progress >= 0.75) {
    return {
      bar: "from-lime-300 via-lime-400 to-lime-500",
      glow: "shadow-[0_0_10px_rgba(132,204,22,0.35)]",
      badge: "border-lime-400/40 bg-lime-500/10 text-lime-200",
      dot: "bg-lime-400",
    };
  }
  if (progress >= 0.5) {
    return {
      bar: "from-amber-300 via-amber-400 to-amber-500",
      glow: "shadow-[0_0_10px_rgba(251,191,36,0.35)]",
      badge: "border-amber-400/40 bg-amber-500/10 text-amber-200",
      dot: "bg-amber-400",
    };
  }
  if (progress >= 0.25) {
    return {
      bar: "from-orange-300 via-orange-400 to-orange-500",
      glow: "shadow-[0_0_10px_rgba(251,146,60,0.35)]",
      badge: "border-orange-400/40 bg-orange-500/10 text-orange-200",
      dot: "bg-orange-400",
    };
  }
  return {
    bar: "from-rose-300 via-rose-400 to-rose-500",
    glow: "shadow-[0_0_10px_rgba(244,63,94,0.35)]",
    badge: "border-rose-400/40 bg-rose-500/10 text-rose-200",
    dot: "bg-rose-400",
  };
};

const getPageStatusTone = (status = "not_started") => {
  const normalized = normalizePageStatus(status);
  if (normalized === "done") return "border-emerald-400/60 bg-emerald-500 text-emerald-950";
  if (normalized === "almost") return "border-lime-400/60 bg-lime-500 text-lime-950";
  if (normalized === "half") return "border-amber-400/60 bg-amber-500 text-amber-950";
  if (normalized === "started") return "border-orange-400/60 bg-orange-500 text-orange-950";
  return "border-rose-400/60 bg-rose-500 text-rose-950";
};

const ProgressBar = ({ progress = 0, tone }) => (
  <div className="h-2 w-full rounded-full bg-slate-800/70">
    <div
      className={`h-2 rounded-full bg-gradient-to-r ${tone?.bar || "from-amber-300 via-amber-400 to-amber-500"} ${
        tone?.glow || "shadow-[0_0_10px_rgba(251,191,36,0.35)]"
      }`}
      style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }}
    />
  </div>
);

const QuestIcon = ({ iconKey, className }) => {
  const Icon = QUEST_ICONS[iconKey] || ScrollText;
  return <Icon className={className} />;
};

export default function QuestsPanel({ character, questState, onUpdateQuestState }) {
  const { isDM } = useGame();
  const [openQuestIds, setOpenQuestIds] = useState(() => new Set());
  const [draftQuestState, setDraftQuestState] = useState(() =>
    normalizeQuestState(questState)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [seriesEdits, setSeriesEdits] = useState({});

  useEffect(() => {
    if (!isDM) return;
    if (hasUnsavedChanges) return;
    setDraftQuestState(normalizeQuestState(questState));
  }, [questState, isDM, hasUnsavedChanges]);

  const workingQuestState = useMemo(
    () => (isDM ? normalizeQuestState(draftQuestState) : normalizeQuestState(questState)),
    [isDM, draftQuestState, questState]
  );
  const quests = workingQuestState.quests || [];

  const visibleQuests = useMemo(
    () => (isDM ? quests : quests.filter((quest) => quest?.showToParty !== false)),
    [quests, isDM]
  );

  const pushQuestState = useCallback(
    (updater) => {
      if (!isDM) return;
      setDraftQuestState((prev) => {
        const next = updater(normalizeQuestState(prev));
        return normalizeQuestState(next);
      });
      setHasUnsavedChanges(true);
    },
    [isDM]
  );

  const handleConfirmEdits = useCallback(() => {
    if (!isDM || !hasUnsavedChanges) return;
    if (typeof onUpdateQuestState !== "function") return;
    const committed = normalizeQuestState(draftQuestState);
    onUpdateQuestState(committed);
    setHasUnsavedChanges(false);
  }, [isDM, hasUnsavedChanges, onUpdateQuestState, draftQuestState]);

  const handleDiscardEdits = useCallback(() => {
    if (!isDM) return;
    setDraftQuestState(normalizeQuestState(questState));
    setHasUnsavedChanges(false);
  }, [isDM, questState]);

  const toggleQuestOpen = useCallback((questId) => {
    setOpenQuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(questId)) {
        next.delete(questId);
      } else {
        next.add(questId);
      }
      return next;
    });
  }, []);

  const updateSeriesName = useCallback(
    (oldName, nextName) => {
      if (!isDM) return;
      const trimmed = String(nextName || "").trim();
      pushQuestState((prev) => ({
        ...prev,
        quests: (prev.quests || []).map((quest) =>
          getSeriesLabel(quest) === oldName
            ? { ...quest, series: trimmed }
            : quest
        ),
        updatedAt: Date.now(),
      }));
    },
    [isDM, pushQuestState]
  );

  const handleAddQuest = useCallback(
    (overrides = {}) => {
      if (!isDM) return;
      const newQuest = buildQuest(overrides);
      pushQuestState((prev) => ({
        ...prev,
        quests: [...(prev.quests || []), newQuest],
        updatedAt: Date.now(),
      }));
      setOpenQuestIds((prev) => new Set(prev).add(newQuest.id));
    },
    [isDM, pushQuestState]
  );

  const handleDeleteQuest = useCallback(
    (questId) => {
      if (!isDM) return;
      pushQuestState((prev) => ({
        ...prev,
        quests: (prev.quests || []).filter((quest) => quest?.id !== questId),
        updatedAt: Date.now(),
      }));
      setOpenQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(questId);
        return next;
      });
    },
    [isDM, pushQuestState]
  );

  const updateQuest = useCallback(
    (questId, updates = {}) => {
      if (!isDM) return;
      pushQuestState((prev) => ({
        ...prev,
        quests: (prev.quests || []).map((quest) =>
          quest?.id === questId
            ? { ...quest, ...updates, updatedAt: Date.now() }
            : quest
        ),
        updatedAt: Date.now(),
      }));
    },
    [isDM, pushQuestState]
  );

  const updateQuestChapters = useCallback(
    (questId, updater) => {
      const quest = quests.find((entry) => entry?.id === questId);
      if (!quest) return;
      const chapters = Array.isArray(quest.chapters) ? quest.chapters : [];
      const nextChapters = updater(chapters);
      updateQuest(questId, { chapters: nextChapters });
    },
    [quests, updateQuest]
  );

  const addChapter = useCallback(
    (questId) => {
      updateQuestChapters(questId, (chapters) => [
        ...chapters,
        {
          id: makeId("chapter"),
          name: `Chapter ${chapters.length + 1}`,
          collapsed: false,
          visibleToParty: true,
          pages: [],
        },
      ]);
    },
    [updateQuestChapters]
  );

  const updateChapter = useCallback(
    (questId, chapterId, updates = {}) => {
      updateQuestChapters(questId, (chapters) =>
        chapters.map((chapter) =>
          chapter?.id === chapterId ? { ...chapter, ...updates } : chapter
        )
      );
    },
    [updateQuestChapters]
  );

  const removeChapter = useCallback(
    (questId, chapterId) => {
      updateQuestChapters(questId, (chapters) =>
        chapters.filter((chapter) => chapter?.id !== chapterId)
      );
    },
    [updateQuestChapters]
  );

  const addPage = useCallback(
    (questId, chapterId) => {
      updateQuestChapters(questId, (chapters) =>
        chapters.map((chapter) =>
          chapter?.id === chapterId
            ? {
                ...chapter,
                pages: [
                  ...(Array.isArray(chapter.pages) ? chapter.pages : []),
                  {
                    id: makeId("page"),
                    text: "New page detail",
                    status: "not_started",
                  },
                ],
              }
            : chapter
        )
      );
    },
    [updateQuestChapters]
  );

  const updatePage = useCallback(
    (questId, chapterId, pageId, updates = {}) => {
      updateQuestChapters(questId, (chapters) =>
        chapters.map((chapter) =>
          chapter?.id === chapterId
            ? {
                ...chapter,
                pages: (Array.isArray(chapter.pages) ? chapter.pages : []).map(
                  (page) => (page?.id === pageId ? { ...page, ...updates } : page)
                ),
              }
            : chapter
        )
      );
    },
    [updateQuestChapters]
  );

  const removePage = useCallback(
    (questId, chapterId, pageId) => {
      updateQuestChapters(questId, (chapters) =>
        chapters.map((chapter) =>
          chapter?.id === chapterId
            ? {
                ...chapter,
                pages: (Array.isArray(chapter.pages) ? chapter.pages : []).filter(
                  (page) => page?.id !== pageId
                ),
              }
            : chapter
        )
      );
    },
    [updateQuestChapters]
  );

  const renderQuestCard = (quest) => {
    const chapters = Array.isArray(quest.chapters) ? quest.chapters : [];
    const allPages = chapters.flatMap((chapter) =>
      Array.isArray(chapter.pages) ? chapter.pages : []
    );
    const completedPages = allPages.filter(
      (page) => normalizePageStatus(page?.status) === "done"
    ).length;
    const totalPages = allPages.length;
    const weightedProgress = totalPages
      ? allPages.reduce(
          (sum, page) =>
            sum + (PAGE_STATUS_WEIGHTS[normalizePageStatus(page?.status)] || 0),
          0
        ) / totalPages
      : 0;
    const isExpanded = openQuestIds.has(quest.id);
    const visibleChapters = isDM
      ? chapters
      : chapters.filter((chapter) => chapter?.visibleToParty !== false);

    const progressTone = getProgressTone(weightedProgress);

    return (
      <div
        key={quest.id}
        className="rounded-xl border border-amber-200/20 bg-slate-950/40 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-amber-200/20 bg-amber-500/10 p-2">
            <QuestIcon iconKey={quest.icon} className="h-5 w-5 text-amber-200" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleQuestOpen(quest.id)}
                    className="rounded-md border border-amber-200/20 bg-slate-900/60 p-1 text-amber-200 hover:bg-slate-800"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                      Volume {quest.volume || "Unlabeled"}
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      {quest.title || "Untitled Quest"}
                    </div>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Volume - Created {formatTimestamp(quest.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${progressTone.badge}`}
                >
                  <span className={`h-2 w-2 rounded-full ${progressTone.dot}`} />
                  Progress
                </span>
                {isDM && (
                  <button
                    type="button"
                    onClick={() => handleDeleteQuest(quest.id)}
                    className="rounded-md border border-red-400/30 bg-red-500/10 p-1 text-red-200 hover:bg-red-500/20"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {isExpanded && quest.description && (
              <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">
                {quest.description}
              </p>
            )}

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Progress: {completedPages}
                  {isDM ? ` / ${totalPages}` : ""} pages
                </span>
                <span>
                  Remaining:{" "}
                  <span className="text-amber-200">
                    {quest.remainingTime || "Unknown"}
                  </span>
                </span>
              </div>
              <ProgressBar progress={weightedProgress} tone={progressTone} />
            </div>
          </div>
        </div>

        {isExpanded && <div className="mt-4 space-y-3">
          {visibleChapters.length === 0 ? (
            <div className="text-xs text-slate-500 italic">
              {isDM ? "No chapters added yet." : "No chapters visible yet."}
            </div>
          ) : (
            visibleChapters.map((chapter) => {
              const chapterPages = Array.isArray(chapter.pages) ? chapter.pages : [];
              const visiblePages = chapterPages;
              const isCollapsed = isDM ? Boolean(chapter.collapsed) : false;

              return (
                <div
                  key={chapter.id}
                  className="border-t border-slate-800/60 pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isDM && (
                        <button
                          type="button"
                          onClick={() =>
                            updateChapter(quest.id, chapter.id, {
                              collapsed: !chapter.collapsed,
                            })
                          }
                          className="rounded-md border border-slate-700/60 bg-slate-900/60 p-1 text-slate-200 hover:bg-slate-800"
                        >
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {isDM ? (
                        <input
                          type="text"
                          value={chapter.name || ""}
                          onChange={(e) =>
                            updateChapter(quest.id, chapter.id, { name: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 outline-none"
                        />
                      ) : (
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          Chapter: {chapter.name || "Chapter"}
                        </div>
                      )}
                    </div>
                    {isDM && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateChapter(quest.id, chapter.id, {
                              visibleToParty: chapter.visibleToParty === false,
                            })
                          }
                          className="rounded-md border border-slate-700/60 bg-slate-900/60 p-1 text-slate-200 hover:bg-slate-800"
                        >
                          {chapter.visibleToParty === false ? (
                            <EyeOff size={12} />
                          ) : (
                            <Eye size={12} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChapter(quest.id, chapter.id)}
                          className="rounded-md border border-red-400/30 bg-red-500/10 p-1 text-red-200 hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="mt-2 space-y-2">
                      {visiblePages.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">
                          {isDM ? "No pages added yet." : "No pages available yet."}
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-800/60">
                          {visiblePages.map((page) => (
                            <div
                              key={page.id}
                              className="flex items-center gap-2 py-1"
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors ${getPageStatusTone(
                                  page.status
                                )}`}
                              >
                                {normalizePageStatus(page.status) === "done" && (
                                  <Check size={10} />
                                )}
                              </span>
                              {isDM && (
                                <select
                                  value={normalizePageStatus(page.status)}
                                  onChange={(e) =>
                                    updatePage(quest.id, chapter.id, page.id, {
                                      status: e.target.value,
                                    })
                                  }
                                  className="rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-100 outline-none"
                                >
                                  {PAGE_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {isDM ? (
                                <input
                                  type="text"
                                  value={page.text || ""}
                                  onChange={(e) =>
                                    updatePage(quest.id, chapter.id, page.id, {
                                      text: e.target.value,
                                    })
                                  }
                                  className="w-full bg-transparent text-xs text-slate-200 outline-none"
                                />
                              ) : (
                                <span className="text-xs text-slate-200">
                                  {page.text}
                                </span>
                              )}
                              {isDM && (
                                <button
                                  type="button"
                                  onClick={() => removePage(quest.id, chapter.id, page.id)}
                                  className="rounded-md border border-slate-700/60 p-1 text-slate-400 hover:bg-slate-800"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isDM && (
                        <button
                          type="button"
                          onClick={() => addPage(quest.id, chapter.id)}
                          className="inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-400/20"
                        >
                          <Plus size={12} /> Add page
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isDM && (
            <button
              type="button"
              onClick={() => addChapter(quest.id)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              <Plus size={12} /> Add chapter
            </button>
          )}
        </div>}

        {isExpanded && isDM && (
          <div className="mt-4 grid gap-3 rounded-lg border border-slate-800/70 bg-slate-950/50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">
                Title
                <input
                  type="text"
                  value={quest.title || ""}
                  onChange={(e) => updateQuest(quest.id, { title: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Remaining Time (In-Game)
                <input
                  type="text"
                  value={quest.remainingTime || ""}
                  onChange={(e) =>
                    updateQuest(quest.id, { remainingTime: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </label>
            </div>

            <label className="text-[11px] text-slate-400">
              Description
              <textarea
                value={quest.description || ""}
                onChange={(e) => updateQuest(quest.id, { description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">
                Series
                <input
                  type="text"
                  value={quest.series || ""}
                  onChange={(e) => updateQuest(quest.id, { series: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                Volume
                <input
                  type="text"
                  value={quest.volume || ""}
                  onChange={(e) => updateQuest(quest.id, { volume: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-slate-400">
                Category
                <select
                  value={quest.category || "main"}
                  onChange={(e) => updateQuest(quest.id, { category: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 outline-none"
                >
                  {QUEST_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] text-slate-400">
                Visibility
                <button
                  type="button"
                  onClick={() =>
                    updateQuest(quest.id, { showToParty: !quest.showToParty })
                  }
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
                >
                  {quest.showToParty ? <Eye size={12} /> : <EyeOff size={12} />}
                  {quest.showToParty ? "Visible to Party" : "Hidden from Party"}
                </button>
              </label>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Quest Icon</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(QUEST_ICONS).map(([key, Icon]) => {
                  const active = key === quest.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateQuest(quest.id, { icon: key })}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        active
                          ? "border-amber-300/60 bg-amber-400/20 text-amber-100"
                          : "border-slate-700/60 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isDM && visibleQuests.length === 0) {
    return (
      <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-500 italic text-center">
          No public quests for {character?.name || "this character"} yet.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
      <div className="space-y-5">
        {isDM && (
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-100">
                Unsaved edits
              </span>
            )}
            <button
              type="button"
              onClick={handleDiscardEdits}
              disabled={!hasUnsavedChanges}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                hasUnsavedChanges
                  ? "border-slate-600/60 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
                  : "border-slate-800/60 bg-slate-950/40 text-slate-500"
              }`}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleConfirmEdits}
              disabled={!hasUnsavedChanges}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                hasUnsavedChanges
                  ? "border-amber-300/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                  : "border-amber-300/20 bg-amber-400/5 text-amber-300/40"
              }`}
            >
              Confirm edits
            </button>
            <button
              type="button"
              onClick={() => handleAddQuest({})}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-400/20"
            >
              <Plus size={14} />
              New Quest
            </button>
          </div>
        )}

        {visibleQuests.length === 0 && isDM && (
          <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4 text-xs text-slate-500 italic">
            No series yet. Add a volume to start a new series.
          </div>
        )}

        {Array.from(groupBy(visibleQuests, getSeriesLabel).entries()).map(
          ([seriesName, seriesQuests]) => (
            <div
              key={seriesName}
              className="rounded-2xl border border-amber-200/20 bg-slate-950/40 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                {isDM ? (
                  <label className="text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                    Series
                    <input
                      type="text"
                      value={
                        seriesEdits[seriesName] !== undefined
                          ? seriesEdits[seriesName]
                          : seriesName
                      }
                      onChange={(e) =>
                        setSeriesEdits((prev) => ({
                          ...prev,
                          [seriesName]: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        const nextValue = e.target.value;
                        if (nextValue !== seriesName) {
                          updateSeriesName(seriesName, nextValue);
                        }
                        setSeriesEdits((prev) => {
                          const next = { ...prev };
                          delete next[seriesName];
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          setSeriesEdits((prev) => {
                            const next = { ...prev };
                            delete next[seriesName];
                            return next;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-amber-300/30 bg-slate-900/60 px-2 py-1 text-xs text-amber-100 outline-none"
                    />
                  </label>
                ) : (
                  <div className="text-sm font-semibold text-amber-200">
                    Series: {seriesName}
                  </div>
                )}
                {isDM && (
                  <button
                    type="button"
                    onClick={() => handleAddQuest({ series: seriesName })}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <Plus size={12} />
                    New Volume
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {seriesQuests.map(renderQuestCard)}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
