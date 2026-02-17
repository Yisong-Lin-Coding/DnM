import { Tabs } from "../pageComponents/tabs";
import {
  Backpack,
  Map,
  Feather,
  Sparkles,
  Users,
  NotebookPen,
  ScrollText,
  Settings2,
  Wrench,
} from "lucide-react";
import { useGame } from "../data/gameContext";

import Admin from "./gamesidepanel/admin";
import MapEditor from "./gamesidepanel/mapeditor";

function PlaceholderPanel({ title, subtitle, hint }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto scrollbar-transparent px-4 py-4">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export default function GameSidePanel() {
  const { isDM } = useGame();

  return (
    <Tabs className="h-full min-h-0 grid grid-rows-[auto_1fr] border-l border-slate-700 bg-slate-950 text-slate-100">
      <Tabs.Nav className="bg-slate-900/95 text-slate-100 flex flex-row overflow-x-auto scrollbar-transparent justify-start items-center gap-1 border-b border-slate-700 px-2 py-1 flex-shrink-0">
        <Tabs.Tab label="Inventory" index={0}>
          <Backpack size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Sheet" index={1}>
          <ScrollText size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Spells" index={2}>
          <Sparkles size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Quests" index={3}>
          <Feather size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Map" index={4}>
          <Map size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Journal" index={5}>
          <NotebookPen size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Party" index={6}>
          <Users size={16} />
        </Tabs.Tab>
        <Tabs.Tab label="Settings" index={7}>
          <Settings2 size={16} />
        </Tabs.Tab>
        {isDM && (
          <Tabs.Tab label="Admin" index={8}>
            <Wrench size={16} />
          </Tabs.Tab>
        )}
        {isDM && (
          <Tabs.Tab label="Map Edit" index={9}>
            <Map size={16} />
          </Tabs.Tab>
        )}
      </Tabs.Nav>

      <Tabs.Panels className="h-full min-h-0 overflow-hidden">
        <Tabs.Panel index={0} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Inventory"
            subtitle="Consumables, equipment, and loot from the current run."
            hint="Item management tools will render here"
          />
        </Tabs.Panel>

        <Tabs.Panel index={1} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Character Sheet"
            subtitle="Core stats, passive bonuses, and your active build."
            hint="Character details panel"
          />
        </Tabs.Panel>

        <Tabs.Panel index={2} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Spells"
            subtitle="Prepared spells, cooldowns, and casting resources."
            hint="Spellbook and actions"
          />
        </Tabs.Panel>

        <Tabs.Panel index={3} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Quests"
            subtitle="Objective chains and current campaign progression."
            hint="Quest tracker"
          />
        </Tabs.Panel>

        <Tabs.Panel index={4} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Map"
            subtitle="Quick world summary for the active encounter."
            hint="Context-only map data"
          />
        </Tabs.Panel>

        <Tabs.Panel index={5} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Journal"
            subtitle="Session notes, lore snippets, and reminders."
            hint="Journal timeline"
          />
        </Tabs.Panel>

        <Tabs.Panel index={6} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Party"
            subtitle="Player roster and party role snapshots."
            hint="Party overview"
          />
        </Tabs.Panel>

        <Tabs.Panel index={7} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <PlaceholderPanel
            title="Settings"
            subtitle="Camera, controls, and personal game preferences."
            hint="Session settings"
          />
        </Tabs.Panel>

        {isDM && (
          <Tabs.Panel index={8} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
            <Admin />
          </Tabs.Panel>
        )}

        {isDM && (
          <Tabs.Panel index={9} className="!p-0 h-full min-h-0 overflow-hidden">
            <MapEditor />
          </Tabs.Panel>
        )}
      </Tabs.Panels>
    </Tabs>
  );
}
