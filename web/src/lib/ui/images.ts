// Turns card and icon art into image URLs, cached per card, style and scale.
//
// Pixel art is rasterised at an integer multiple of its native size with
// nearest-neighbour sampling, and drawn with `image-rendering: pixelated`, so
// pixels stay square. Smooth cards are drawn with canvas 2D at the device's
// resolution.

import * as cards from '$engine/rules/cards.ts';
import type { Card } from '$engine/rules/cards.ts';
import * as pixelcards from '$engine/ui/pixelcards.ts';
import * as icons from '$engine/ui/icons.ts';
import * as cardart from '$engine/ui/cardart.ts';
import { toCanvas } from '$engine/ui/pixel.ts';
import { CARD_H, CARD_W } from '$engine/ui/theme.ts';
import { sealBitmap } from '$engine/ui/sealart.ts';
import type { SealKey } from '$engine/game/seals.ts';

const cache = new Map<string, string>();

function url(canvas: HTMLCanvasElement): string {
	return canvas.toDataURL('image/png');
}

function cached(key: string, build: () => string): string {
	let u = cache.get(key);
	if (!u) {
		u = build();
		cache.set(key, u);
	}
	return u;
}

/**
 * Pixel scale factor for card art: the smallest integer multiple of the
 * native 40x56 bitmap that covers the card's on-screen size in device pixels.
 */
let pixelScale = 4;
export function setDeviceScale(cssPxPerStagePx: number) {
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
	// x1.5: your hand is drawn up to 1.5x (layout handScale).
	pixelScale = Math.max(1, Math.min(8, Math.ceil((CARD_W / pixelcards.W) * cssPxPerStagePx * dpr * 1.5)));
}

export function cardFace(card: Card, trump: boolean, pixel: boolean, fourColor: boolean): string {
	const key = `${cards.code(card)}|${trump ? 't' : ''}|${pixel ? 'p' + pixelScale : 's'}|${fourColor ? 4 : 2}`;
	return cached(key, () => {
		if (pixel) return url(toCanvas(pixelcards.faceBitmap(card, trump, fourColor), pixelScale));
		return smooth((g) => cardart.face(g, card, trump, fourColor));
	});
}

export function cardBack(pixel: boolean): string {
	return cached(`back|${pixel ? 'p' + pixelScale : 's'}`, () =>
		pixel ? url(toCanvas(pixelcards.backBitmap(), pixelScale)) : smooth((g) => cardart.back(g))
	);
}

function smooth(draw: (g: CanvasRenderingContext2D) => void): string {
	const k = 4; // supersample; your hand is shown up to 1.5x, on 2x screens
	const canvas = document.createElement('canvas');
	canvas.width = CARD_W * k;
	canvas.height = CARD_H * k;
	const g = canvas.getContext('2d')!;
	g.scale(k, k);
	g.translate(CARD_W / 2, CARD_H / 2);
	draw(g);
	return url(canvas);
}

/** An icon tile (18x18 native), rasterised at 8x for crisp scaling. */
export function icon(key: string): string {
	return cached(`icon|${key}`, () => url(toCanvas(icons.bitmap(key), 8)));
}

/** A pixel-art wax seal (14x14 native), rasterised at 8x for crisp scaling. */
export function seal(key: SealKey): string {
	return cached(`seal|${key}`, () => url(toCanvas(sealBitmap(key), 8)));
}
