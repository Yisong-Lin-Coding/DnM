


function classNames(...xs) {
    return xs.filter(Boolean).join(' ');
  }

  function getInitials(name = '') {
    const parts = name.trim().split(/\s+/);
    const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    return initials.toUpperCase() || 'U';
  }

  function formatTimestamp(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    // e.g., "Sep 3"
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function StarIcon({ filled, className }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.5c.2-.5.84-.5 1.04 0l2.02 4.99c.09.22.3.37.54.4l5.39.46c.52.04.73.69.33 1.02l-4.1 3.44c-.18.15-.26.39-.2.62l1.25 5.25c.12.51-.43.92-.88.65l-4.64-2.77a.67.67 0 0 0-.68 0L6.9 20.33c-.45.27-1-.14-.88-.65l1.25-5.25c.06-.23-.02-.47-.2-.62l-4.1-3.44c-.4-.33-.19-.98.33-1.02l5.39-.46c.24-.02.45-.18.54-.4l2.02-4.99Z"
        />
      </svg>
    );
  }

  function PaperclipIcon({ className }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 11.5 12.5 20a5 5 0 1 1-7.07-7.07l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95L10 17.26a2 2 0 0 1-2.83-2.83L15.6 6"
        />
      </svg>
    );
  }

  function UnreadDot({ show }) {
    if (!show) return null;
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400 ring-2 ring-blue-400/25"
        aria-label="Unread"
        title="Unread"
      />
    );
  }

  export default function Mail_Card({
    sender = { name: 'Sender Name', email: 'sender@example.com', avatarUrl: '' },
    subject = 'Subject goes here with a concise summary',
    snippet = 'Preview of the message content appears here to give context at a glance.',
    date = new Date(),
    unread = false,
    flagged = false,
    attachments = 0,
    selected = false,
    loading = false,
    onClick,
    onToggleSelect,
  }) {
    if (loading) {
      return (
        <div
          className={classNames(
            'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3',
            'border-white/10 bg-website-base',
            'animate-pulse'
          )}
          aria-busy="true"
          aria-label="Loading message"
        >
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded border border-white/10 bg-white/5" />
            <div className="h-10 w-10 rounded-full bg-white/10" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-3/5 rounded bg-white/10" />
            <div className="h-3 w-4/5 rounded bg-white/5" />
          </div>
          <div className="h-3 w-12 rounded bg-white/10" />
        </div>
      );
    }

    const initials = getInitials(sender?.name || sender?.email);
    const when = formatTimestamp(date);

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(e);
      }
    };

    const toggleSelect = (e) => {
      // Prevent row onClick when toggling checkbox
      e.stopPropagation();
      onToggleSelect?.(!selected);
    };

    return (
      <div
        role="button"
        tabIndex={0}
        aria-selected={selected}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={classNames(
          'group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3',
          'transition-colors duration-150',
          'border-white/10 bg-website-base',
          'hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40'
        )}
      >
        <div className="flex items-center gap-3">
          {typeof onToggleSelect === 'function' ? (
            <button
              type="button"
              onClick={toggleSelect}
              aria-pressed={selected}
              className={classNames(
                'flex h-5 w-5 items-center justify-center rounded border text-white/80',
                selected
                  ? 'border-blue-400 bg-blue-500/20'
                  : 'border-white/20 bg-transparent hover:bg-white/10'
              )}
              title={selected ? 'Deselect' : 'Select'}
            >
              {selected ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </button>
          ) : (
            <UnreadDot show={unread} />
          )}

          <div className="relative h-10 w-10 shrink-0">
            {sender?.avatarUrl ? (
              <img
                src={sender.avatarUrl}
                alt={`${sender.name || sender.email} avatar`}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                loading="lazy"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/90 ring-1 ring-white/10">
                {initials}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={classNames(
                'truncate',
                unread ? 'font-semibold text-white' : 'font-medium text-white/90'
              )}
              title={subject}
            >
              {subject}
            </span>

            {flagged ? (
              <StarIcon
                filled
                className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(250,204,21,0.35)]"
              />
            ) : null}

            {attachments > 0 ? (
              <span
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70"
                title={`${attachments} attachment${attachments === 1 ? '' : 's'}`}
              >
                <PaperclipIcon className="h-3.5 w-3.5" />
                {attachments}
              </span>
            ) : null}
          </div>

          <div
            className={classNames(
              'mt-0.5 flex items-center gap-2 text-sm',
              unread ? 'text-white/80' : 'text-white/60'
            )}
          >
            <span className="truncate" title={`${sender?.name || ''} <${sender?.email || ''}>`}>
              {sender?.name || sender?.email}
            </span>
            <span aria-hidden="true" className="text-white/30">•</span>
            <span className="truncate" title={snippet}>
              {snippet}
            </span>
          </div>
        </div>

        <div className="ml-2 flex h-full flex-col items-end justify-between">
          <span className="text-xs text-white/60" title={new Date(date).toLocaleString()}>
            {when}
          </span>

          {/* Unread indicator on the right when checkbox is present */}
          {typeof onToggleSelect === 'function' ? <UnreadDot show={unread} /> : null}
        </div>
      </div>
    );
  }
