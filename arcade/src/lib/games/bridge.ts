import * as cards from '$kit/src/core/rules/cards.ts';
import * as play from '$kit/games/bridge/rules/play.ts';
import { bridge, isPlayerTurn } from '$kit/games/bridge/module.ts';
import type { Deal } from '$kit/games/bridge/module.ts';
import type { Run } from '$kit/src/run/run.ts';
import type { GameUI, TableView } from './types.ts';
import { POS } from './types.ts';
import BridgeBid from './BridgeBid.svelte';

function view(run: Run<Deal>): TableView {
	const d = run.hand;
	const st = d.state;
	const seats = [1, 2, 3, 4].map((s) => ({
		pos: POS[s],
		name: s === d.declarer ? 'You' : s === d.dummy ? 'Dummy' : cards.SEATS[s].name,
		cards: st ? st.hands[s] : d.hands[s],
		faceUp: s === d.declarer || (s === d.dummy && d.dummyVisible),
		tally: st && s === d.declarer ? `${st.nsTricks} tricks` : st && s === cards.EAST ? `${st.ewTricks} tricks` : undefined,
		active: !!st && !st.complete && st.turn === s,
		playable: !!st && isPlayerTurn(run) && st.turn === s
	}));
	const shown = st ? (st.trick.length ? st.trick : (st.tricks.at(-1)?.plays ?? [])) : [];
	const c = d.contract;
	return {
		seats,
		trick: shown.map((p) => ({ pos: POS[p.seat], card: p.card })),
		trickDone: !!st && !st.trick.length && st.tricks.length > 0,
		legal: new Set(st && isPlayerTurn(run) ? play.legalPlays(st, st.turn).map((x) => `${x.suit}-${x.rank}`) : []),
		trump: c && c.strain !== cards.NOTRUMP ? c.strain : undefined,
		banner: c ? `${cards.contractName(c)}${c.doubled ? ' doubled' : ''} · need ${6 + c.level} tricks` : undefined
	};
}

export const bridgeUI: GameUI = {
	module: bridge,
	blurb: 'Bid from your hand and partner’s, declare, play dummy, and score by the duplicate table.',
	back: 'royal',
	view: view as GameUI['view'],
	Pre: BridgeBid
};
