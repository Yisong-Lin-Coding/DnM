import { Link, useParams } from "react-router-dom";
import {
  Book,
  Shield,
  User,
  Sparkles,
  Scroll,
  Sword,
  Skull,
  Github,
  Linkedin,
} from "lucide-react";
import Body from "../../pageComponents/bodySkeleton";
import Header from "../../pageComponents/header";

const GITHUB_URL = "https://github.com/Yisong-Lin-Coding/DnM";
const LINKEDIN_URL = "https://www.linkedin.com/in/yisong-lin-8605a3357/";

const TOPICS = {
  lore: {
    label: "Lore",
    icon: Book,
    description:
      "World notes, setting references, and system context for your campaigns.",
  },
  classes: {
    label: "Classes",
    icon: Shield,
    description:
      "Class overviews, progression notes, and playstyle references.",
  },
  backgrounds: {
    label: "Backgrounds",
    icon: User,
    description:
      "Character background guides and story-first templates.",
  },
  races: {
    label: "Races",
    icon: Sparkles,
    description:
      "Race and lineage references, traits, and feature notes.",
  },
  spells: {
    label: "Spells",
    icon: Scroll,
    description:
      "Spell lookup and magical rules references for play.",
  },
  items: {
    label: "Items",
    icon: Sword,
    description:
      "Item catalogs, equipment notes, and inventory references.",
  },
  enemies: {
    label: "Enemies",
    icon: Skull,
    description:
      "Enemy concepts, encounter references, and challenge ideas.",
  },
};

const TOPIC_ORDER = ["lore", "classes", "backgrounds", "races", "spells", "items", "enemies"];

export default function LoreMenu() {
  const { topic } = useParams();
  const safeTopic = TOPICS[topic] ? topic : "lore";
  const sessionID = sessionStorage.getItem("session_ID");
  const baseRoute = sessionID ? `/ISK/${sessionID}/lore` : "/login";
  const activeTopic = TOPICS[safeTopic];
  const ActiveIcon = activeTopic.icon;

  return (
    <Body className="bg-website-default-900 text-website-default-100">
      <Header className="col-span-3" title="Lore Directory" />
      <Body.Left className="row-span-1 col-start-1" />

      <Body.Center className="row-span-1 col-start-2 min-h-screen px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TOPIC_ORDER.map((key) => {
            const item = TOPICS[key];
            const Icon = item.icon;
            const isActive = safeTopic === key;
            const to = key === "lore" ? baseRoute : `${baseRoute}/${key}`;

            return (
              <Link
                key={key}
                to={to}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? "border-website-specials-500 bg-website-specials-500/10"
                    : "border-website-default-700 bg-website-default-800/60 hover:bg-website-default-800"
                }`}
              >
                <div className="flex items-center gap-2 text-website-neutral-50 font-semibold">
                  <Icon className="size-4" />
                  {item.label}
                </div>
                <p className="text-sm text-website-neutral-300 mt-2">{item.description}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-website-default-700 bg-website-default-800/60 p-6 text-left">
          <div className="flex items-center gap-2 text-lg font-semibold text-website-neutral-50">
            <ActiveIcon className="size-5 text-website-specials-400" />
            {activeTopic.label}
          </div>
          <p className="mt-3 text-sm text-website-neutral-300">
            {activeTopic.description}
          </p>
          <p className="mt-2 text-sm text-website-neutral-400">
            This section is now routable and can be expanded with data-backed content next.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-website-default-600 px-3 py-2 text-sm hover:bg-website-default-700"
            >
              <Github className="size-4" />
              Project GitHub
            </a>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-website-default-600 px-3 py-2 text-sm hover:bg-website-default-700"
            >
              <Linkedin className="size-4" />
              Creator LinkedIn
            </a>
          </div>
        </div>
      </Body.Center>

      <Body.Right className="col-start-3" />
      <Body.Footer className="col-span-3" />
    </Body>
  );
}
