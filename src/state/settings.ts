import { Difficulty } from "@/config/game";

const STORAGE_KEY = "botz.settings.v1";

export interface Settings {
  soundOn: boolean;
  difficulty: Difficulty;
}

const DEFAULTS: Settings = {
  soundOn: true,
  difficulty: "normal",
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private mode, etc.) — settings just won't persist.
  }
}

let current: Settings = load();

export const SettingsStore = {
  get(): Settings {
    return current;
  },
  setSoundOn(on: boolean): void {
    current = { ...current, soundOn: on };
    save(current);
  },
  setDifficulty(difficulty: Difficulty): void {
    current = { ...current, difficulty };
    save(current);
  },
};
