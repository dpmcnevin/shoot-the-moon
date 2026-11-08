// Stage geometry, as in Vulnerable: a fixed logical stage scaled to fit the
// window, with a portrait stage for tall screens. Your hand fans along the
// bottom; the three opponents hold face-down hands at the other seats.

import * as cards from '$engine/rules/cards.ts';
import { CARD_H, CARD_W } from '$engine/ui/theme.ts';

export type Orientation = 'landscape' | 'portrait';

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** How an opponent's face-down hand is laid out. */
export interface SeatLayout {
	/** Centre of the hand. */
	x: number;
	y: number;
	/** Direction the cards spread in, and the gap between them. */
	dx: number;
	dy: number;
	r: number;
	s: number;
	/** Name label position. */
	labelX: number;
	labelY: number;
	align: 'left' | 'center' | 'right';
}

export interface Layout {
	orientation: Orientation;
	W: number;
	H: number;
	sidebar: Rect;
	table: Rect;
	tableCX: number;
	trickCY: number;
	ovalRX: number;
	ovalRY: number;
	/** Top of your hand. */
	handY: number;
	maxHandWidth: number;
	seats: Record<number, SeatLayout>;
	trickOffset: Record<number, [number, number]>;
	playOut: Rect;
}

const LANDSCAPE: Layout = (() => {
	const W = 1280,
		H = 720,
		sideW = 270;
	const tableCX = sideW + (W - sideW) / 2;
	const trickCY = 318;
	return {
		orientation: 'landscape',
		W,
		H,
		sidebar: { x: 0, y: 0, w: sideW, h: H },
		table: { x: sideW, y: 0, w: W - sideW, h: H },
		tableCX,
		trickCY,
		ovalRX: 270,
		ovalRY: 170,
		handY: 590,
		maxHandWidth: 780,
		seats: {
			[cards.NORTH]: { x: tableCX, y: 62, dx: 26, dy: 0, r: Math.PI, s: 0.62, labelX: tableCX - 100, labelY: 112, align: 'center' },
			[cards.WEST]: { x: sideW + 64, y: trickCY, dx: 0, dy: 20, r: Math.PI / 2, s: 0.62, labelX: sideW + 14, labelY: trickCY - 190, align: 'left' },
			[cards.EAST]: { x: W - 64, y: trickCY, dx: 0, dy: 20, r: -Math.PI / 2, s: 0.62, labelX: W - 154, labelY: trickCY - 190, align: 'right' }
		},
		trickOffset: {
			[cards.NORTH]: [0, -82],
			[cards.SOUTH]: [0, 82],
			[cards.WEST]: [-112, 0],
			[cards.EAST]: [112, 0]
		},
		playOut: { x: W - 180, y: 520, w: 160, h: 40 }
	};
})();

const PORTRAIT: Layout = (() => {
	const W = 800,
		H = 1280,
		sideH = 300;
	const tableCX = W / 2;
	const handY = H - CARD_H - 56;
	const trickCY = 760;
	return {
		orientation: 'portrait',
		W,
		H,
		sidebar: { x: 0, y: 0, w: W, h: sideH },
		table: { x: 0, y: sideH, w: W, h: H - sideH },
		tableCX,
		trickCY,
		ovalRX: 240,
		ovalRY: 210,
		handY,
		maxHandWidth: 770,
		seats: {
			[cards.NORTH]: { x: tableCX, y: sideH + 70, dx: 24, dy: 0, r: Math.PI, s: 0.6, labelX: tableCX - 100, labelY: sideH + 116, align: 'center' },
			[cards.WEST]: { x: 50, y: trickCY, dx: 0, dy: 20, r: Math.PI / 2, s: 0.6, labelX: 10, labelY: trickCY - 190, align: 'left' },
			[cards.EAST]: { x: W - 50, y: trickCY, dx: 0, dy: 20, r: -Math.PI / 2, s: 0.6, labelX: W - 150, labelY: trickCY - 190, align: 'right' }
		},
		trickOffset: {
			[cards.NORTH]: [0, -96],
			[cards.SOUTH]: [0, 96],
			[cards.WEST]: [-112, 0],
			[cards.EAST]: [112, 0]
		},
		playOut: { x: W - 176, y: handY - 70, w: 160, h: 40 }
	};
})();

export function getLayout(o: Orientation): Layout {
	return o === 'portrait' ? PORTRAIT : LANDSCAPE;
}

export function trickXY(L: Layout, seat: number): [number, number] {
	const off = L.trickOffset[seat];
	return [L.tableCX + off[0], L.trickCY + off[1]];
}

/** Where a seat's cards come from and go to (the middle of its hand, or below the stage for you). */
export function seatOrigin(L: Layout, seat: number): [number, number] {
	if (seat === cards.SOUTH) return [L.tableCX, L.H + CARD_H];
	return [L.seats[seat].x, L.seats[seat].y];
}

/** A small fixed tilt per card, so tricks look tossed rather than placed. */
export function tossAngle(card: cards.Card): number {
	return (((card.rank * 7 + card.suit * 13) % 11) - 5) * 0.022;
}

export interface Slot {
	card: cards.Card;
	x: number;
	w: number;
	cx: number;
	cy: number;
	r: number;
	idle: number;
}

/** Your fanned hand. */
export function handSlots(L: Layout, hand: cards.Card[]): Slot[] {
	const n = hand.length;
	const spacing = n > 1 ? Math.min(56, (L.maxHandWidth - CARD_W) / (n - 1)) : 0;
	const total = CARD_W + spacing * Math.max(0, n - 1);
	const x0 = L.tableCX - total / 2;
	return hand.map((card, idx) => {
		const k = idx + 1 - (n + 1) / 2;
		return {
			card,
			x: x0 + idx * spacing,
			w: idx === n - 1 ? CARD_W : spacing,
			cx: x0 + idx * spacing + CARD_W / 2,
			cy: L.handY + CARD_H / 2 + k * k * 0.6,
			r: k * 0.028,
			idle: (idx + 1) * 0.7
		};
	});
}

/** Positions for an opponent's face-down hand. */
export function opponentSlots(L: Layout, seat: number, n: number): { x: number; y: number; r: number; s: number }[] {
	const S = L.seats[seat];
	return Array.from({ length: n }, (_, i) => {
		const k = i - (n - 1) / 2;
		return { x: S.x + k * S.dx, y: S.y + k * S.dy, r: S.r, s: S.s };
	});
}
