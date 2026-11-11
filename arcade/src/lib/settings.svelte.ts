// Sound and music on or off, remembered between visits.

const KEY = 'cardkit-arcade-settings';

class Settings {
	music = $state(false);
	sfx = $state(true);
	/** Play speed: how quickly the other seats play (0.5x to 3x). */
	speed = $state(1);
	/** Four suit colors (green clubs, orange diamonds). */
	fourColor = $state(false);

	constructor() {
		try {
			const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
			if (typeof s.music === 'boolean') this.music = s.music;
			if (typeof s.sfx === 'boolean') this.sfx = s.sfx;
			if (typeof s.speed === 'number') this.speed = s.speed;
			if (typeof s.fourColor === 'boolean') this.fourColor = s.fourColor;
		} catch {}
	}

	toggle(k: 'music' | 'sfx' | 'fourColor'): boolean {
		this[k] = !this[k];
		this.store();
		return this[k];
	}

	setSpeed(v: number) {
		this.speed = Math.min(3, Math.max(0.5, Math.round(v * 4) / 4));
		this.store();
	}

	private store() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ music: this.music, sfx: this.sfx, speed: this.speed, fourColor: this.fourColor }));
		} catch {}
	}
}

export const settings = new Settings();
