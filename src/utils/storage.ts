export interface WeekState {
  sex: string;
  age: number;
  weightKg: number;
  heightCm: number;
  weeklyKm: number;
  weeklyBike: number;
  weeklySwim: number;
  weeklyStrength: number;
  doubleSessionDays: number;
  activityFactor: number;
  dayType: string;
  goal: string;
  carbLow: number;
  carbHigh: number;
  protein: number;
  fat: number;
  dark: boolean;
  weeklySessions: {
    [key: string]: {
      duration: number;
      type: string;
      intensity: string;
      doubleSession: boolean;
      secondSession: {
        duration: number;
        type: string;
        intensity: string;
      };
    };
  };
}

const STORAGE_KEY = 'fuel-factor-state-v1';

export const loadState = (): WeekState | null => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      return null;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    console.error('Error loading state from localStorage:', err);
    return null;
  }
};

export const saveState = (state: WeekState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
};

export const defaultState = (): WeekState => ({
  sex: "male",
  age: 27,
  weightKg: 87,
  heightCm: 183,
  weeklyKm: 60,
  weeklyBike: 0,
  weeklySwim: 0,
  weeklyStrength: 0,
  doubleSessionDays: 0,
  activityFactor: 1.45,
  dayType: "key",
  goal: "performance",
  carbLow: 5,
  carbHigh: 8,
  protein: 1.8,
  fat: 1.1,
  dark: false,
  weeklySessions: {
    monday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    tuesday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    wednesday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    thursday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    friday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    saturday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } },
    sunday: { duration: 0, type: 'run', intensity: 'aerobic', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic' } }
  }
});
