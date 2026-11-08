// Player settings, persisted in localStorage. Port of src/ui/settings.lua.

export type SettingKey = 'music' | 'sfx' | 'fourColor' | 'pixelCards' | 'rubberView' | 'sortByRank';

const STORAGE_KEY = 'shoot-the-moon.settings';
const DEFAULTS: Record<SettingKey, boolean> = {
	music: true,
	sfx: true,
	fourColor: true,
	pixelCards: true,
	rubberView: false,
	/** Your hand sorted by rank (low to high, across suits) instead of by suit. */
	sortByRank: false
};

const SPEED_KEY = 'shoot-the-moon.speed';
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 3;
export const SPEED_STEP = 0.25;

class Settings {
	/** Play speed: how quickly the opponents play and the table moves on. */
	speed = $state(1);

	setSpeed(v: number) {
		this.speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(v / SPEED_STEP) * SPEED_STEP));
		try {
			localStorage.setItem(SPEED_KEY, String(this.speed));
		} catch {
			/* ignore */
		}
	}

	music = $state(DEFAULTS.music);
	sfx = $state(DEFAULTS.sfx);
	fourColor = $state(DEFAULTS.fourColor);
	pixelCards = $state(DEFAULTS.pixelCards);
	rubberView = $state(DEFAULTS.rubberView);
	sortByRank = $state(DEFAULTS.sortByRank);

	load() {
		try {
			const sp = Number(localStorage.getItem(SPEED_KEY));
			if (sp >= SPEED_MIN && sp <= SPEED_MAX) this.speed = sp;
		} catch {
			/* ignore */
		}
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const saved = JSON.parse(raw) as Partial<Record<SettingKey, boolean>>;
			for (const key of Object.keys(DEFAULTS) as SettingKey[]) {
				if (typeof saved[key] === 'boolean') this[key] = saved[key]!;
			}
		} catch {
			/* private mode or corrupt data: keep defaults */
		}
	}

	save() {
		try {
			const out: Record<string, boolean> = {};
			for (const key of Object.keys(DEFAULTS) as SettingKey[]) out[key] = this[key];
			localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
		} catch {
			/* ignore */
		}
	}

	get(key: SettingKey): boolean {
		return this[key];
	}

	toggle(key: SettingKey): boolean {
		this[key] = !this[key];
		this.save();
		return this[key];
	}
}

export const settings = new Settings();
