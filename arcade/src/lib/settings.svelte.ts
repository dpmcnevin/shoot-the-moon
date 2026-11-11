// Sound and music on or off, remembered between visits.

const KEY = 'cardkit-arcade-settings';

class Settings {
	music = $state(false);
	sfx = $state(true);

	constructor() {
		try {
			const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
			if (typeof s.music === 'boolean') this.music = s.music;
			if (typeof s.sfx === 'boolean') this.sfx = s.sfx;
		} catch {}
	}

	toggle(k: 'music' | 'sfx'): boolean {
		this[k] = !this[k];
		try {
			localStorage.setItem(KEY, JSON.stringify({ music: this.music, sfx: this.sfx }));
		} catch {}
		return this[k];
	}
}

export const settings = new Settings();
