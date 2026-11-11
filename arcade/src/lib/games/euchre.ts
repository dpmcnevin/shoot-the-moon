import * as E from '$kit/games/euchre/rules.ts';
import { euchre } from '$kit/games/euchre/module.ts';
import { seatName } from '$kit/games/euchre/ai.ts';
import type { EuchreHand } from '$kit/games/euchre/rules.ts';
import type { Run } from '$kit/src/run/run.ts';
import * as cards from '$kit/src/core/rules/cards.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import EuchreCall from './EuchreCall.svelte';

function view(run: Run<EuchreHand>): TableView {
	const h = run.hand;
	const out = E.sittingOut(h);
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: `${seatName(s)}${s === out ? ' · sitting out' : ''}`,
		dealer: s === h.dealer,
		cards: h.hands[s],
		faceUp: s === E.PLAYER,
		tally: h.trump !== null && (s === E.PLAYER || s === cards.EAST) ? `${E.tricksFor(h, s)} tricks` : undefined,
		active: !h.complete && h.turn === s,
		playable: s === E.PLAYER
	}));
	const shown = h.trick.length ? h.trick : (h.tricks.at(-1)?.plays ?? []);
	const yourTurn = h.trump !== null && !h.complete && h.turn === E.PLAYER;
	const maker = h.maker ? `${seatName(h.maker)} made ${cards.SUITS[h.trump!].name.toLowerCase()}${h.alone ? ', alone' : ''}` : '';
	return {
		seats,
		trick: shown.map((p) => ({ pos: POS[p.seat], card: p.card })),
		trickDone: !h.trick.length && h.tricks.length > 0,
		legal: new Set(yourTurn ? E.legalPlays(h, E.PLAYER).map((c) => `${c.suit}-${c.rank}`) : []),
		trump: h.trump ?? undefined,
		// Both bowers are trumps: the left one is the other jack of trump's color.
		isTrump: h.trump !== null ? (c) => E.isTrump(c, h.trump!) : undefined,
		banner: h.trump !== null ? maker : undefined
	};
}

export const euchreUI: GameUI = {
	module: euchre,
	blurb: 'Order it up or name trump, ride the bowers, march your partnership, and euchre the other side.',
	back: 'collector',
	view: view as GameUI['view'],
	Pre: EuchreCall
};
