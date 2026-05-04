import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DAILY_LIMIT = 20;

function todayKey(): string {
  return new Date().toISOString().split('T')[0] || '';
}

interface QuotaState {
  usedToday: number;
  dayKey: string;
  tryConsume: () => boolean;
  remaining: () => number;
}

export const useJudgeQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      usedToday: 0,
      dayKey: todayKey(),
      
      tryConsume: () => {
        const today = todayKey();
        const state = get();
        
        // Reset on new day
        if (state.dayKey !== today) {
          set({ usedToday: 1, dayKey: today });
          return true;
        }
        
        if (state.usedToday >= DAILY_LIMIT) return false;
        set({ usedToday: state.usedToday + 1 });
        return true;
      },
      
      remaining: () => {
        if (get().dayKey !== todayKey()) return DAILY_LIMIT;
        return Math.max(0, DAILY_LIMIT - get().usedToday);
      },
    }),
    { name: 'judge-quota' }
  )
);
