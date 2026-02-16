import React from 'react';

const ACTION_TYPE_LABELS = {
  action: 'Action',
  bonusAction: 'Bonus Action',
  reaction: 'Reaction',
  movement: 'Movement',
  free: 'Free',
  passive: 'Passive',
  special: 'Special',
};

const toTitleCase = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function ActionsTab({ actions = [] }) {
  const visibleActions = Array.isArray(actions)
    ? actions.filter((action) => action?.enabled !== false)
    : [];

  return (
    <div className="bg-website-default-800/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col min-h-[320px]">
      <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
        <h3 className="text-xs font-black text-red-600 uppercase italic tracking-widest">
          Available Actions
        </h3>
        <span className="bg-red-900/20 text-red-500 text-[10px] font-black px-2 py-0.5 rounded border border-red-900/50">
          {visibleActions.length} READY
        </span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-2">
        {visibleActions.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-500">
            No actions available
          </div>
        )}

        {visibleActions.map((action, index) => {
          const type = ACTION_TYPE_LABELS[action.actionType] || toTitleCase(action.actionType || 'action');
          const source = toTitleCase(action.source || 'custom');
          return (
            <div
              key={action.id || `${action.name}_${index}`}
              className="bg-black/30 border border-white/5 rounded-lg px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-white uppercase tracking-tight">
                  {action.name || 'Unnamed Action'}
                </div>
                <div className="text-[9px] text-red-400 font-black uppercase tracking-wider">
                  {type}
                </div>
              </div>
              <div className="mt-1 text-[10px] text-gray-500 uppercase tracking-wider">
                Source: {source}
              </div>
              {action.description && (
                <p className="mt-1 text-[11px] text-gray-400 leading-snug">
                  {action.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
