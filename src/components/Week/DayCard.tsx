import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Session {
  duration: number;
  type: string;
  intensity: string;
  timeOfDay?: string;
  doubleSession?: boolean;
  secondSession?: {
    duration: number;
    type: string;
    intensity: string;
    timeOfDay?: string;
  };
}

interface DayCardProps {
  day: string;
  baseCalories: number;
  trainingCalories: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  session?: Session;
  onUpdate?: (updatedSession: Session) => void;
}

// Helper to capitalize first letter
const capitalize = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const DayCard: React.FC<DayCardProps> = ({ 
  day, 
  baseCalories, 
  trainingCalories,
  carbs = 261,
  protein = 148,
  fat = 70,
  session,
  onUpdate
}) => {
  // Track if we're updating from props to prevent feedback loop
  const isUpdatingFromProps = useRef(false);
  const hasInitialized = useRef(false);

  const [min, setMin] = useState(session?.duration || 0);
  const [type, setType] = useState(session?.type ? capitalize(session.type) : 'Run');
  const [intensity, setIntensity] = useState(session?.intensity ? capitalize(session.intensity) : 'Aerobic');
  const [timeOfDay, setTimeOfDay] = useState(session?.timeOfDay || 'Morning');
  const [secondSession, setSecondSession] = useState(session?.doubleSession || false);
  const [min2, setMin2] = useState(session?.secondSession?.duration || 0);
  const [type2, setType2] = useState(session?.secondSession?.type ? capitalize(session.secondSession.type) : 'Run');
  const [intensity2, setIntensity2] = useState(session?.secondSession?.intensity ? capitalize(session.secondSession.intensity) : 'Aerobic');
  const [timeOfDay2, setTimeOfDay2] = useState(session?.secondSession?.timeOfDay || 'Morning');

  // Helper to send updates to parent
  const notifyParent = useCallback(() => {
    if (onUpdate && hasInitialized.current && !isUpdatingFromProps.current) {
      onUpdate({
        duration: min,
        type: type.toLowerCase(),
        intensity: intensity.toLowerCase(),
        timeOfDay,
        doubleSession: secondSession,
        secondSession: secondSession ? {
          duration: min2,
          type: type2.toLowerCase(),
          intensity: intensity2.toLowerCase(),
          timeOfDay: timeOfDay2
        } : undefined
      });
    }
  }, [min, type, intensity, timeOfDay, secondSession, min2, type2, intensity2, timeOfDay2, onUpdate]);

  // Update state when session prop changes
  useEffect(() => {
    if (session) {
      isUpdatingFromProps.current = true;
      setMin(session.duration || 0);
      setType(session.type ? capitalize(session.type) : 'Run');
      setIntensity(session.intensity ? capitalize(session.intensity) : 'Aerobic');
      setTimeOfDay(session.timeOfDay || 'Morning');
      setSecondSession(session.doubleSession || false);
      setMin2(session.secondSession?.duration || 0);
      setType2(session.secondSession?.type ? capitalize(session.secondSession.type) : 'Run');
      setIntensity2(session.secondSession?.intensity ? capitalize(session.secondSession.intensity) : 'Aerobic');
      setTimeOfDay2(session.secondSession?.timeOfDay || 'Morning');
      hasInitialized.current = true;
      // Reset flag after a moment
      setTimeout(() => {
        isUpdatingFromProps.current = false;
      }, 10);
    }
  }, [session]);

  // Notify parent when any state changes
  useEffect(() => {
    notifyParent();
  }, [notifyParent]);

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 capitalize">
            {day}
          </h3>
          <div className="flex gap-2">
            <span className="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
              {baseCalories} kcal
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
              Training: {trainingCalories}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            C:{carbs}g
          </span>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            P:{protein}g
          </span>
          <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">
            F:{fat}g
          </span>
        </div>
      </div>

      {/* Session Form */}
      <div className="space-y-3">
        {/* First Session */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
              MIN
            </label>
            <input
              type="number"
              value={min === 0 ? '' : min}
              onChange={(e) => setMin(Number(e.target.value) || 0)}
              onFocus={(e) => { if (min === 0) { e.target.value = ''; setMin(0); } }}
              onBlur={(e) => { if (e.target.value === '') setMin(0); }}
              min="0"
              max="300"
              placeholder="0"
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
              TYPE
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
            >
              <option>Run</option>
              <option>Bike</option>
              <option>Swim</option>
              <option>Strength</option>
              <option>Cross-Train</option>
              <option>Rest</option>
            </select>
          </div>
          {type.toLowerCase() !== 'strength' && (
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                INTENSITY
              </label>
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
              >
                <option>Aerobic</option>
                <option>Threshold</option>
                <option>VO2max</option>
              </select>
            </div>
          )}
          {type.toLowerCase() === 'strength' && <div></div>}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
              TIME
            </label>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
            >
              <option>Morning</option>
              <option>Lunchtime</option>
              <option>Afternoon</option>
              <option>Evening</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={secondSession}
                onChange={(e) => setSecondSession(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Add Second Session</span>
            </label>
          </div>
        </div>

        {/* Divider */}
        {secondSession && (
          <>
            <div className="border-t border-slate-200 dark:border-slate-700 my-3"></div>
            
            {/* Second Session */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                  MIN
                </label>
                <input
                  type="number"
                  value={min2 === 0 ? '' : min2}
                  onChange={(e) => setMin2(Number(e.target.value) || 0)}
                  onFocus={(e) => { if (min2 === 0) { e.target.value = ''; setMin2(0); } }}
                  onBlur={(e) => { if (e.target.value === '') setMin2(0); }}
                  min="0"
                  max="300"
                  placeholder="0"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                  TYPE
                </label>
                <select
                  value={type2}
                  onChange={(e) => setType2(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option>Run</option>
                  <option>Bike</option>
                  <option>Swim</option>
                  <option>Strength</option>
                  <option>Cross-Train</option>
                  <option>Rest</option>
                </select>
              </div>
              {type2.toLowerCase() !== 'strength' && (
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                    INTENSITY
                  </label>
                  <select
                    value={intensity2}
                    onChange={(e) => setIntensity2(e.target.value)}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <option>Aerobic</option>
                    <option>Threshold</option>
                    <option>VO2max</option>
                  </select>
                </div>
              )}
              {type2.toLowerCase() === 'strength' && <div></div>}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                  TIME
                </label>
                <select
                  value={timeOfDay2}
                  onChange={(e) => setTimeOfDay2(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option>Morning</option>
                  <option>Lunchtime</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DayCard;
