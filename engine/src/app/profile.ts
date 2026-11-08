// The player's record across runs: totals, the relics found and bosses
// beaten (for the Collection's marks), and a history of recent runs. Kept on
// the device (localStorage on the web, UserDefaults on the iPad) as JSON.
//
// `noteRun` is called after every action with the run and an id for it. It
// is idempotent, so calling it twice changes nothing: each run's entry is
// updated in place, and totals grow only by what changed since last time.

import * as R from '../game/run.ts';
import type { Run } from '../game/run.ts';

export type RunResult = 'playing' | 'won' | 'lost' | 'abandoned';

export interface RunRecord {
	id: string;
	seed: string;
	ruleset: string;
	started: number;
	ended?: number;
	result: RunResult;
	table: number;
	board: number;
	bestHand: number;
	moons: number;
	cleanHands: number;
	hands: number;
	relics: string[];
}

export interface Profile {
	version: 1;
	/** Runs started, won, and the furthest table reached in any. */
	runs: number;
	wins: number;
	bestTable: number;
	bestHand: number;
	moons: number;
	cleanHands: number;
	handsPlayed: number;
	relicsFound: string[];
	bossesBeaten: string[];
	/** Most recent first, at most HISTORY entries. */
	history: RunRecord[];
}

export const HISTORY = 30;

export function emptyProfile(): Profile {
	return { version: 1, runs: 0, wins: 0, bestTable: 0, bestHand: 0, moons: 0, cleanHands: 0, handsPlayed: 0, relicsFound: [], bossesBeaten: [], history: [] };
}

/** A profile from stored JSON, or a fresh one if there is none or it won't read. */
export function parseProfile(json: string | null | undefined): Profile {
	if (!json) return emptyProfile();
	try {
		const p = JSON.parse(json) as Profile;
		return p && p.version === 1 && Array.isArray(p.history) ? { ...emptyProfile(), ...p } : emptyProfile();
	} catch {
		return emptyProfile();
	}
}

const addTo = (list: string[], key: string) => {
	if (!list.includes(key)) list.push(key);
};

/** Bring the profile up to date with this run. */
export function noteRun(p: Profile, run: Run, id: string, now = Date.now()): Profile {
	let entry = p.history.find((e) => e.id === id);
	if (!entry) {
		// A new run: any other still marked as playing was left unfinished.
		for (const e of p.history) if (e.result === 'playing') e.result = 'abandoned';
		entry = { id, seed: String(run.seed), ruleset: run.ruleset, started: now, result: 'playing', table: 1, board: 1, bestHand: 0, moons: 0, cleanHands: 0, hands: 0, relics: [] };
		p.history.unshift(entry);
		p.history.length = Math.min(p.history.length, HISTORY);
		p.runs++;
	}
	// Totals grow by what this run added since it was last noted.
	p.moons += Math.max(0, run.stats.moons - entry.moons);
	p.cleanHands += Math.max(0, run.stats.cleanHands - entry.cleanHands);
	p.handsPlayed += Math.max(0, run.stats.handsPlayed - entry.hands);
	entry.moons = run.stats.moons;
	entry.cleanHands = run.stats.cleanHands;
	entry.hands = run.stats.handsPlayed;
	entry.table = Math.min(run.table, R.TABLES);
	entry.board = run.board;
	entry.bestHand = Math.max(entry.bestHand, run.stats.bestHand);
	for (const r of run.relics) {
		addTo(entry.relics, r.key);
		addTo(p.relicsFound, r.key);
	}
	p.bestHand = Math.max(p.bestHand, run.stats.bestHand);
	p.bestTable = Math.max(p.bestTable, entry.table);
	// A boss is beaten when its board is won (the last one ends in victory).
	if ((run.phase === R.PHASE.BOARD_WON || run.phase === R.PHASE.VICTORY) && R.bossActive(run) && run.boss) addTo(p.bossesBeaten, run.boss);
	if (entry.result === 'playing' && (run.phase === R.PHASE.VICTORY || run.phase === R.PHASE.GAME_OVER)) {
		entry.result = run.phase === R.PHASE.VICTORY ? 'won' : 'lost';
		entry.ended = now;
		if (entry.result === 'won') p.wins++;
	}
	return p;
}
