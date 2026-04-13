import {
    CONTAINER_WIDTH,
    ITEM_STRIDE,
    ITEM_WIDTH,
    SPIN_ROUNDS,
} from "@/app/[locale]/(protected)/monster/constants";

const JITTER_PADDING = 16;
const DRAMA_PROBABILITY = 0.3;
const DRAMA_MIN_FRACTION = 0.7;

/**
 * Pixel offset that centers the chosen card under the indicator, plus a
 * random jitter so the indicator lands anywhere inside the card. 30% of
 * landings go close-to-edge for extra "did it just barely stick?" drama.
 */
export function computeLandingOffset(stripLength: number, chosenIndex: number): number {
    const centerOffset = CONTAINER_WIDTH / 2 - ITEM_WIDTH / 2;
    const baseOffset = (stripLength * SPIN_ROUNDS + chosenIndex) * ITEM_STRIDE - centerOffset;
    return baseOffset + jitter();
}

function jitter(): number {
    const maxJitter = ITEM_WIDTH / 2 - JITTER_PADDING;
    const direction = Math.random() < 0.5 ? -1 : 1;
    const drama = Math.random() < DRAMA_PROBABILITY;
    const fraction = drama
        ? DRAMA_MIN_FRACTION + Math.random() * (1 - DRAMA_MIN_FRACTION)
        : Math.random();
    return direction * maxJitter * fraction;
}
