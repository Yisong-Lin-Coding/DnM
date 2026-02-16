import { Tabs } from "../pageComponents/tabs";
import { Backpack, Map, Feather, Sparkles, Users, NotebookPen, ScrollText, Settings2, Wrench } from "lucide-react";
import { useGame } from "../data/gameContext";

import Admin from "./gamesidepanel/admin";
import MapEditor from "./gamesidepanel/mapeditor";

export default function GameSidePanel() {
  const { isDM } = useGame();

  return (
    <Tabs className="h-full grid grid-rows-[auto_1fr] border-l border-website-specials-500 bg-website-default-700 text-website-default-100">
      {/* Navigation - Fixed height, scrolls horizontally if needed */}
      <Tabs.Nav className="bg-website-default-700 text-website-default-100 flex flex-row overflow-x-auto justify-start items-center gap-2 border-b border-website-specials-500 flex-shrink-0">
        <Tabs.Tab label="Inventory" index={0}>
          <Backpack />
        </Tabs.Tab>
        <Tabs.Tab label="Character Sheet" index={1}>
          <ScrollText />
        </Tabs.Tab>
        <Tabs.Tab label="Spells" index={2}>
          <Sparkles />
        </Tabs.Tab>
        <Tabs.Tab label="Quests" index={3}>
          <Feather />
        </Tabs.Tab>
        <Tabs.Tab label="Map" index={4}>
          <Map />
        </Tabs.Tab>
        <Tabs.Tab label="Journal" index={5}>
          <NotebookPen />
        </Tabs.Tab>
        <Tabs.Tab label="Party" index={6}>
          <Users />
        </Tabs.Tab>
        <Tabs.Tab label="Settings" index={7}>
          <Settings2 />
        </Tabs.Tab>
        {isDM && (
          <Tabs.Tab label="Admin" index={8}>
            <Wrench />
          </Tabs.Tab>
        )}
        {isDM && (
          <Tabs.Tab label="MapEditor" index={9}>
            <Map />
          </Tabs.Tab>
        )}
      </Tabs.Nav>

      {/* Panels - Takes remaining space, each panel scrolls independently */}
      <Tabs.Panels className="overflow-hidden">
        <Tabs.Panel label="Inventory" index={0} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Inventory</h3>
            <p className="text-gray-400">Your items will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Character Sheet" index={1} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Character Sheet</h3>
            <p className="text-gray-400">Character stats will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Spells" index={2} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Spells</h3>
            <p className="text-gray-400">Your spells will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Quests" index={3} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Quests</h3>
            <p className="text-gray-400">Your quests will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Map" index={4} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Map</h3>
            <p className="text-gray-400">Map overview will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Journal" index={5} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Journal</h3>
            <p className="text-gray-400">Your journal entries will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Party" index={6} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Party</h3>
            <p className="text-gray-400">Party members will appear here</p>
          </div>
        </Tabs.Panel>

        <Tabs.Panel label="Settings" index={7} className="h-full overflow-y-auto">
          <div className="p-4">
            <h3 className="text-lg font-bold">Settings</h3>
            <p className="text-gray-400">Game settings will appear here</p>
          </div>
        </Tabs.Panel>

        {isDM && (
          <Tabs.Panel label="Admin" index={8} className="h-full overflow-y-auto">
            <Admin />
          </Tabs.Panel>
        )}

        {isDM && (
          <Tabs.Panel label="MapEditor" index={9} className="h-full overflow-y-auto">
            <MapEditor />
          </Tabs.Panel>
        )}
      </Tabs.Panels>
    </Tabs>
  );
}
