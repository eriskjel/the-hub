import { useEffect, useRef, useState } from "react";
import { ANIMATION_DURATION } from "@/app/[locale]/(protected)/monster/constants";
import { RARITY_PROBABILITIES } from "@/lib/monster/catalog";
import { computeLandingOffset } from "@/lib/monster/landingOffset";
import { createVisualStrip, createWeightedStrip, maskLegendary } from "@/lib/monster/visualStrip";
import type { DrinkRarity, DrinkVariant } from "../types";

const VISUAL_STRIP_ROUNDS = 40;
const SPIN_SOUND_SRC = "/sounds/cs.m4a";

/**
 * The caller (page.tsx) performs the authoritative roll via the server and
 * hands the result back through this callback. The hook is purely responsible
 * for the visual animation + the "latest result" UI state.
 */
export type RollFn = () => Promise<{
    item: string;
    rarity: DrinkRarity;
    image: string;
}>;

export function useDrinkCase(drinks: DrinkVariant[], roll: RollFn) {
    if (process.env.NODE_ENV === "development") validateRarityWeightsDev();

    const [selected, setSelected] = useState<DrinkVariant | null>(null);
    const [rolling, setRolling] = useState(false);
    const [opening, setOpening] = useState(false); // waiting on the server roll
    const [offset, setOffset] = useState(0);
    const [animate, setAnimate] = useState(true);
    const [stripDrinks, setStripDrinks] = useState<DrinkVariant[]>(() =>
        maskLegendary(drinks.filter((d) => d.rarity !== "yellow"))
    );

    const spinSound = useSpinSound();

    useEffect(() => {
        setStripDrinks(maskLegendary(createWeightedStrip(drinks, false)));
    }, [drinks]);

    const handleOpen = async () => {
        if (rolling || opening) return;

        setOpening(true);
        let result: Awaited<ReturnType<RollFn>>;
        try {
            result = await roll();
        } catch {
            // Caller surfaces the error via its own mutation state; just
            // re-enable the button here.
            setOpening(false);
            return;
        }

        // Trust the server's image/rarity — if someone raced a catalog change
        // the server value wins.
        const chosenVariant: DrinkVariant = {
            name: result.item,
            image: result.image,
            rarity: result.rarity,
        };

        playSpinSound(spinSound.current);

        const { strip, chosenIndex } = createVisualStrip(
            drinks,
            chosenVariant,
            VISUAL_STRIP_ROUNDS
        );
        setStripDrinks(maskLegendary(strip));

        setAnimate(true);
        setOpening(false);
        setRolling(true);
        setOffset(0);
        setSelected(chosenVariant);

        const finalOffset = computeLandingOffset(strip.length, chosenIndex);

        // Double rAF so the 0-offset paint commits before we transition to
        // the final offset, otherwise the browser skips the animation.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setOffset(finalOffset));
        });

        setTimeout(() => setRolling(false), ANIMATION_DURATION);
    };

    const reset = () => {
        setAnimate(false);
        setOffset(0);
        setSelected(null);
        setRolling(false);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => setAnimate(true));
        });
    };

    return {
        selected,
        rolling,
        opening,
        offset,
        handleOpen,
        reset,
        duration: ANIMATION_DURATION,
        animate,
        stripMonsters: stripDrinks,
    };
}

function useSpinSound() {
    const ref = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        const audio = new Audio(SPIN_SOUND_SRC);
        audio.addEventListener("error", () => {
            console.warn(`Failed to load audio file: ${SPIN_SOUND_SRC}`);
            ref.current = null;
        });
        ref.current = audio;
        return () => {
            audio.pause();
            ref.current = null;
        };
    }, []);
    return ref;
}

function playSpinSound(audio: HTMLAudioElement | null) {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
        // Autoplay restrictions — requires a prior user gesture; fine to ignore.
    });
}

function validateRarityWeightsDev() {
    const total = Object.values(RARITY_PROBABILITIES).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.001) {
        console.warn(`RARITY_PROBABILITIES sum to ${total}, expected 100`);
    }
}
