import React, { useState, useEffect } from 'react';

interface Session {
  duration: number;
  type: string;
  intensity: string;
  location?: string;
  doubleSession?: boolean;
  secondSession?: {
    duration: number;
    type: string;
    intensity: string;
    location?: string;
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
  const [min, setMin] = useState(session?.duration || 0);
  const [type, setType] = useState(session?.type || 'Run');
  const [intensity, setIntensity] = useState(session?.intensity || 'Aerobic');
  const [location, setLocation] = useState(session?.location || '');
  const [secondSession, setSecondSession] = useState(session?.doubleSession || false);
  const [min2, setMin2] = useState(session?.secondSession?.duration || 0);
  const [type2, setType2] = useState(session?.secondSession?.type || 'Run');
  const [intensity2, setIntensity2] = useState(session?.secondSession?.intensity || 'Aerobic');
  const [location2, setLocation2] = useState(session?.secondSession?.location || '');

  // Update state when session prop changes
  useEffect(() => {
    if (session) {
      setMin(session.duration || 0);
      setType(session.type || 'Run');
      setIntensity(session.intensity || 'Aerobic');
      setLocation(session.location || '');
      setSecondSession(session.doubleSession || false);
      setMin2(session.secondSession?.duration || 0);
      setType2(session.secondSession?.type || 'Run');
      setIntensity2(session.secondSession?.intensity || 'Aerobic');
      setLocation2(session.secondSession?.location || '');
    }
  }, [session]);

  // Notify parent of updates
  const handleUpdate = () => {
    if (onUpdate) {
      onUpdate({
        duration: min,
        type: type.toLowerCase(),
        intensity: intensity.toLowerCase(),
        location,
        doubleSession: secondSession,
        secondSession: secondSession ? {
          duration: min2,
          type: type2.toLowerCase(),
          intensity: intensity2.toLowerCase(),
          location: location2
        } : undefined
      });
    }
  };

  useEffect(() => {
    handleUpdate();
  }, [min, type, intensity, location, secondSession, min2, type2, intensity2, location2]);

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
              value={min}
              onChange={(e) => setMin(Number(e.target.value))}
              min="0"
              max="300"
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
              <option>Recovery</option>
              <option>Tempo</option>
              <option>Intervals</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
              LOCATION
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City"
                className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 pl-8 text-sm"
              />
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400">
                📍
              </span>
            </div>
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
                  value={min2}
                  onChange={(e) => setMin2(Number(e.target.value))}
                  min="0"
                  max="300"
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
                  <option>Recovery</option>
                  <option>Tempo</option>
                  <option>Intervals</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1 block">
                  LOCATION
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={location2}
                    onChange={(e) => setLocation2(e.target.value)}
                    placeholder="City"
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1.5 pl-8 text-sm"
                  />
                  <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400">
                    📍
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DayCard;
