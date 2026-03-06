import { useMemo } from "react";
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
import InventoryPanel from "./gamesidepanel/inventory";
import CharacterSheetPanel from "./gamesidepanel/characterSheet";
import SpellsPanel from "./gamesidepanel/spells";
import QuestsPanel from "./gamesidepanel/quests";
import MapInfoPanel from "./gamesidepanel/mapInfo";
import JournalPanel from "./gamesidepanel/journal";
import PartyPanel from "./gamesidepanel/party";
import SettingsPanel from "./gamesidepanel/settings";

export default function GameSidePanel({
  ownedCharacterIds = [],
  visionRayCount = 256,
  onVisionRayCountChange = () => {},
  onForceVisionRerender = () => {},
  visionDebug = null,
  journalState,
  onUpdateJournalState,
  questState,
  onUpdateQuestState,
  playerID,
  campaignID,
}) {
  const { isDM, characters, selectedChar } = useGame();

  const activeCharacter = useMemo(() => {
    // 1. If DM, show the selected character (if any)
    if (isDM) {
      return characters.find(c => String(c.id) === String(selectedChar)) || null;
    }

    // 2. If Player, show selected IF they own it
    if (selectedChar && ownedCharacterIds.some(id => String(id) === String(selectedChar))) {
      return characters.find(c => String(c.id) === String(selectedChar));
    }

    // 3. Otherwise default to their first owned character
    const firstOwnedId = ownedCharacterIds[0];
    return characters.find(c => String(c.id) === String(firstOwnedId)) || null;
  }, [isDM, selectedChar, ownedCharacterIds, characters]);

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
          <InventoryPanel character={activeCharacter} />
        </Tabs.Panel>

        <Tabs.Panel index={1} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <CharacterSheetPanel character={activeCharacter} />
        </Tabs.Panel>

        <Tabs.Panel index={2} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <SpellsPanel character={activeCharacter} />
        </Tabs.Panel>

        <Tabs.Panel index={3} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <QuestsPanel
            character={activeCharacter}
            questState={questState}
            onUpdateQuestState={onUpdateQuestState}
          />
        </Tabs.Panel>

        <Tabs.Panel index={4} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <MapInfoPanel character={activeCharacter} />
        </Tabs.Panel>

        <Tabs.Panel index={5} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <JournalPanel
            journalState={journalState}
            onUpdateJournalState={onUpdateJournalState}
            playerID={playerID}
          />
        </Tabs.Panel>

        <Tabs.Panel index={6} className="!p-0 h-full min-h-0 overflow-hidden">
          <PartyPanel 
            activeCharacterId={activeCharacter?.id}
            playerID={playerID}
            campaignID={campaignID}
          />
        </Tabs.Panel>

        <Tabs.Panel index={7} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
          <SettingsPanel character={activeCharacter} />
        </Tabs.Panel>

        {isDM && (
          <Tabs.Panel index={8} className="!p-0 h-full min-h-0 overflow-y-auto scrollbar-transparent">
            <Admin
              visionRayCount={visionRayCount}
              onVisionRayCountChange={onVisionRayCountChange}
              onForceVisionRerender={onForceVisionRerender}
              visionDebug={visionDebug}
            />
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
