import * as H from '$kit/games/hearts/rules/hearts.ts';
import { hearts } from '$kit/games/hearts/module.ts';
import type { HeartsHand } from '$kit/games/hearts/module.ts';
import type { Run } from '$kit/src/run/run.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import HeartsPass from './HeartsPass.svelte';

function view(run: Run<HeartsHand>): TableView {
	const h = run.hand;
	const st = h.state;
	const pts = st ? H.pointsTaken(st) : [0, 0, 0, 0, 0];
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: s === H.PLAYER ? 'You' : H.SEAT_NAMES[s],
		cards: st ? st.hands[s] : h.dealt[s],
		faceUp: s === H.PLAYER,
		tally: st ? `${pts[s]}` : undefined,
		active: !!st && !st.complete && st.turn === s,
		playable: s === H.PLAYER
	}));
	const shown = st ? (st.trick.length ? st.trick : (st.tricks.at(-1)?.plays ?? [])) : [];
	return {
		seats,
		trick: shown.map((p) => ({ pos: POS[p.seat], card: p.card })),
		trickDone: !!st && !st.trick.length && st.tricks.length > 0,
		legal: new Set(st && !st.complete && st.turn === H.PLAYER ? H.legalPlays(st, H.PLAYER).map((c) => `${c.suit}-${c.rank}`) : []),
		banner: !st ? `Pass ${h.passDir}` : h.passDir === 'hold' ? 'No passing this hand' : undefined
	};
}

export const heartsUI: GameUI = {
	module: hearts,
	blurb: 'Pass three, dodge every point, or take them all and shoot the moon.',
	back: 'standard',
	view: view as GameUI['view'],
	Pre: HeartsPass,
	pick: 3
};
