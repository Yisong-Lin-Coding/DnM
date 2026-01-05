import { Star, Paperclip, Check } from 'lucide-react';

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

  return isToday 
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function UnreadDot({ show }) {
  if (!show) return null;
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-website-specials-500 shadow-[0_0_8px_rgba(233,69,96,0.6)]"
      aria-label="Unread"
    />
  );
}

export default function Mail_Card({
  sender = { name: 'Sender Name', email: 'sender@example.com', avatarUrl: '' },
  subject = 'Subject summary',
  snippet = 'Message content preview...',
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
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-website-default-800 bg-website-default-900/50 p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded border border-website-default-700 bg-website-default-800" />
          <div className="h-10 w-10 rounded-full bg-website-default-800" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/5 rounded bg-website-default-800" />
          <div className="h-3 w-4/5 rounded bg-website-default-800/50" />
        </div>
        <div className="h-3 w-12 rounded bg-website-default-800" />
      </div>
    );
  }

  const initials = getInitials(sender?.name || sender?.email);
  const when = formatTimestamp(date);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={classNames(
        'group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 transition-all duration-200 focus:outline-none',
        selected 
          ? 'border-website-specials-500 bg-website-default-800 ring-1 ring-website-specials-500/20' 
          : 'border-website-default-800 bg-website-default-900 hover:bg-website-default-800 hover:border-website-default-700'
      )}
    >
      <div className="flex items-center gap-3">
        {typeof onToggleSelect === 'function' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect(!selected); }}
            className={classNames(
              'flex h-5 w-5 items-center justify-center rounded border transition-colors',
              selected
                ? 'border-website-specials-500 bg-website-specials-500 text-white'
                : 'border-website-default-600 bg-transparent hover:border-website-specials-500'
            )}
          >
            {selected && <Check size={14} strokeWidth={3} />}
          </button>
        )}

        <div className="relative h-10 w-10 shrink-0">
          {sender?.avatarUrl ? (
            <img
              src={sender.avatarUrl}
              alt="avatar"
              className="h-10 w-10 rounded-full object-cover border border-website-default-700"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-website-highlights-900 text-website-highlights-200 text-xs font-bold border border-website-highlights-700">
              {initials}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={classNames(
            'truncate text-sm tracking-wide',
            unread ? 'font-bold text-website-neutral-50' : 'font-medium text-website-neutral-300'
          )}>
            {subject}
          </span>
          {flagged && <Star size={14} className="fill-website-specials-500 text-website-specials-500" />}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className={unread ? 'text-website-highlights-300' : 'text-website-neutral-500'}>
            {sender?.name || sender?.email}
          </span>
          <span className="text-website-neutral-700">•</span>
          <span className="truncate text-website-neutral-500" title={snippet}>
            {snippet}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between h-full py-0.5">
        <span className="text-[10px] font-medium uppercase tracking-tighter text-website-neutral-500">
          {when}
        </span>
        <div className="flex items-center gap-2">
          {attachments > 0 && <Paperclip size={12} className="text-website-neutral-600" />}
          <UnreadDot show={unread} />
        </div>
      </div>
    </div>
  );
}