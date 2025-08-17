"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// if you later need to fetch user info from session you need this:
// export const dynamic = "force-dynamic";

type Monster = {
  name: string;
  image: string;
};

const monsters: Monster[] = [
  { name: "Original", image: "/monsters/original.png" },
  { name: "Ultra White", image: "/monsters/ultra_white.png" },
  { name: "Aussie Lemonade", image: "/monsters/aussie_lemonade.png" },
  { name: "Original Zero", image: "/monsters/original_zero.png" },
  { name: "Peachy Keen", image: "/monsters/peachy_keen.png" },
  { name: "Rio Punch", image: "/monsters/rio_punch.png" },
  { name: "Ultra Fiesta Mango", image: "/monsters/ultra_fiesta_mango.png" },
  { name: "Ultra Paradise", image: "/monsters/ultra_paradise.png" },
  { name: "Ultra Rosa", image: "/monsters/ultra_rosa.png" },
];

const ITEM_WIDTH = 160;
const CONTAINER_WIDTH = 640;
const SPIN_ROUNDS = 3;
const ANIMATION_DURATION = 4000;

function getRandomMonster(): Monster {
  return monsters[Math.floor(Math.random() * monsters.length)];
}

export default function MonsterPage() {
  const [selected, setSelected] = useState<Monster | null>(null);
  const [rolling, setRolling] = useState(false);
  const [offset, setOffset] = useState(0);
  const t = useTranslations("monster");

  const handleOpen = () => {
    if (rolling) return;

    setRolling(true);
    const chosen = getRandomMonster();
    setSelected(chosen);

    const chosenIndex = monsters.findIndex((m) => m.name === chosen.name);
    const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;

    const finalOffset =
      (monsters.length * SPIN_ROUNDS + chosenIndex) * ITEM_WIDTH - centerOffset;

    setOffset(finalOffset);

    setTimeout(() => setRolling(false), ANIMATION_DURATION);
  };

  const repeatedMonsters = Array(SPIN_ROUNDS + 2).fill(monsters).flat();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-white gap-6">
      <h1 className="text-5xl font-bold">
        {t("title")}
      </h1>

      <button
        className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded text-xl font-semibold transition disabled:opacity-50"
        onClick={handleOpen}
        disabled={selected !== null || rolling}
      >
        {rolling ? t("rolling") : t("button_text")}
      </button>

      {/* Case-opening strip */}
      <div className="relative w-[640px] flex h-48 mx-auto overflow-hidden border-4 border-green-600 rounded-lg bg-black">
        {/* highlight line */}
        <div className="absolute top-0 left-1/2 w-1 h-full bg-red-500 z-10 transform -translate-x-1/2" />

        <div
          className="flex transition-transform ease-out"
          style={{
            transform: `translateX(-${offset}px)`,
            transitionDuration: `${ANIMATION_DURATION}ms`,
          }}
        >
          {repeatedMonsters.map((monster, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center w-40 flex-shrink-0 p-2"
            >
              <img
                src={monster.image}
                alt={monster.name}
                className="w-24 h-24 object-contain drop-shadow-lg"
              />
              <span className="mt-2 text-sm">{monster.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reveal chosen monster name after roll */}
      {!rolling && selected && (
        <div className="mt-4 text-3xl font-bold">{selected.name}</div>
      )}
    </div>
  );
}
