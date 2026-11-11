// The arcade's controller: which game, its run, and every action, saved as
// seed + actions per game so a run picks up where it left off.

import * as R from '$kit/src/run/run.ts';
import { apply, replay, type Action, type Save } from '$kit/src/run/save.ts';
import type { Run } from '$kit/src/run/run.ts';
import { byId } from './games/index.ts';
import type { GameUI } from './games/types.ts';

const KEY = (id: string) => `cardkit-arcade-${id}`;

class Arcade {
	screen = $state<'menu' | 'run'>('menu');
	ui = $state.raw<GameUI | null>(null);
	run = $state.raw<Run | null>(null);
	/** Bumped on every change: views read it to refresh. */
	v = $state(0);
	picked = $state<string[]>([]);
	toast = $state('');
	private save: Save | null = null;

	saved(id: string): boolean {
		try {
			const s = localStorage.getItem(KEY(id));
			if (!s) return false;
			const run = replay(byId(id)!.module, JSON.parse(s));
			return run.phase !== R.PHASE.OVER && run.phase !== R.PHASE.VICTORY;
		} catch {
			return false;
		}
	}

	start(id: string, resume = false) {
		const ui = byId(id)!;
		let save: Save | null = null;
		if (resume) {
			try {
				save = JSON.parse(localStorage.getItem(KEY(id)) ?? 'null');
			} catch {}
		}
		if (save) this.run = replay(ui.module, save);
		else {
			this.run = R.newRun(ui.module);
			save = { version: 1, game: id, seed: this.run.seed, actions: [] };
		}
		this.save = save;
		this.ui = ui;
		this.picked = [];
		this.screen = 'run';
		this.persist();
		this.v++;
	}

	do(a: Action) {
		const run = this.run!;
		try {
			const out = apply(run, a);
			if (Array.isArray(out) && out[0] === false) return this.flash(`Can't: ${out[1]}`);
		} catch (e) {
			return this.flash((e as Error).message);
		}
		this.save!.actions.push(a);
		this.picked = [];
		this.persist();
		this.v++;
	}

	game(a: unknown) {
		this.do({ t: 'game', a });
	}

	togglePick(key: string) {
		const max = this.ui?.pick ?? 0;
		if (this.picked.includes(key)) this.picked = this.picked.filter((k) => k !== key);
		else if (this.picked.length < max) this.picked = [...this.picked, key];
	}

	flash(text: string) {
		this.toast = text;
		setTimeout(() => this.toast === text && (this.toast = ''), 1800);
	}

	private persist() {
		try {
			localStorage.setItem(KEY(this.save!.game), JSON.stringify(this.save));
		} catch {}
	}

	toMenu() {
		this.screen = 'menu';
	}
}

export const arcade = new Arcade();
