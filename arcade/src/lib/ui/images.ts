// Card and icon art as image URLs, rasterised once per card and cached.

import * as cards from '$kit/src/core/rules/cards.ts';
import type { Card } from '$kit/src/core/rules/cards.ts';
import * as pixelcards from '$kit/src/core/ui/pixelcards.ts';
import * as icons from '$kit/src/core/ui/icons.ts';
import { toCanvas } from '$kit/src/core/ui/pixel.ts';

const cache = new Map<string, string>();
const SCALE = 6;

function cached(key: string, build: () => string): string {
	let u = cache.get(key);
	if (!u) cache.set(key, (u = build()));
	return u;
}

export function cardFace(card: Card, trump = false): string {
	return cached(`${cards.code(card)}|${trump}`, () => toCanvas(pixelcards.faceBitmap(card, trump, false), SCALE).toDataURL());
}

export function cardBack(deck = 'standard'): string {
	return cached(`back|${deck}`, () => toCanvas(pixelcards.backBitmap(deck), SCALE).toDataURL());
}

export function icon(key: string): string {
	return cached(`icon|${key}`, () => toCanvas(icons.bitmap(key), 8).toDataURL());
}
