import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";
import DayCard from "./components/Week/DayCard";
import AthleteProfile from "./components/AthleteProfile";
import WeeklySummary from "./components/WeeklySummary";
import DailyCalories from "./components/DailyCalories";
import { fetchWeatherByCity, fetchForecastByCity, calculateHydrationNeeds } from "./utils/weather.js";

// ---------- UI primitives ----------
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl shadow-lg ring-1 ring-slate-200/50 dark:ring-slate-700/50 p-4 sm:p-6 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4 sm:mb-6">
    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-orange-700 dark:text-orange-300 drop-shadow-sm">{title}</h2>
    {subtitle && <p className="text-sm sm:text-base lg:text-lg text-slate-700 dark:text-slate-300 mt-1">{subtitle}</p>}
  </div>
);

const Label = ({ children }) => (
  <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{children}</label>
);
// slider + number input aligned in one row
const NumberInput = ({ value, onChange, min = 0, max = 9999, step = 1, suffix = "", ...props }) => (
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
    <input 
      type="range" 
      value={value} 
      min={min} 
      max={max} 
      step={step} 
      onChange={(e)=>onChange(Number(e.target.value))} 
      className="flex-1 accent-orange-600 h-6 sm:h-8 rounded-lg" 
      {...props}
    />
    <div className="flex items-center gap-2 w-full sm:w-40">
      <input 
        type="number" 
        value={value} 
        onChange={(e)=>onChange(Number(e.target.value))} 
        className="flex-1 sm:w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
        min={min}
        max={max}
        step={step}
      />
      {suffix && <span className="text-sm sm:text-base text-orange-700 dark:text-orange-300 font-semibold whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);
// label left, control right (for aligned rows)
const InputRow = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
    <Label>{label}</Label>
    <div className="flex-1">{children}</div>
  </div>
);

// ---------- Core calculations ----------
function mifflinStJeor({ sex, weightKg, heightCm, age }) {
  const s = sex === "female" ? -161 : 5;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s; // kcal/day
}
function runningKcalPerDay(weightKg, weeklyKm) {
  return (weightKg * weeklyKm) / 7; // ~1 kcal per kg per km
}
function bikingKcalPerDay(weightKg, weeklyKm) {
  return (weightKg * weeklyKm * 0.4) / 7; // ~0.4 kcal per kg per km (more efficient)
}
function swimmingKcalPerDay(weightKg, weeklyKm) {
  return (weightKg * weeklyKm * 1.2) / 7; // ~1.2 kcal per kg per km (less efficient)
}
function strengthKcalPerDay(weightKg, weeklyHours) {
  return (weightKg * weeklyHours * 6) / 7; // ~6 kcal per kg per hour
}

// Performance tab calorie calculations using MET values
function calculateSessionCalories(weightKg, duration, type, intensity) {
  if (duration === 0) return 0;
  
  // Normalize type values (handle different casings and variations)
  const normalizedType = type ? type.toLowerCase().trim() : 'run';
  
  // Rest day = no calories
  if (normalizedType === 'rest') return 0;
  
  // Map variations to standard types (handle Cross-Train, HIIT, etc.)
  const typeMap = {
    'run': 'run',
    'bike': 'bike',
    'cycle': 'bike',
    'cycling': 'bike',
    'swim': 'swim',
    'swimming': 'swim',
    'strength': 'strength',
    'weight': 'strength',
    'weights': 'strength',
    'cross-train': 'run', // Map Cross-Train to Run for calorie calculation
    'hiit': 'hitt', // Map HIIT
    'hitt': 'hitt',
    'rest': null // Return 0 for rest
  };
  
  const mappedType = typeMap[normalizedType] || 'run';
  
  if (!mappedType) return 0; // Handle rest days
  
  // Normalize intensity values (handle different casings and variations)
  const normalizedIntensity = intensity ? intensity.toLowerCase().trim() : 'aerobic';
  
  // Map variations to standard intensities
  const intensityMap = {
    'aerobic': 'aerobic',
    'recovery': 'aerobic',
    'tempo': 'threshold',
    'threshold': 'threshold',
    'intervals': 'threshold',
    'vo2max': 'vo2max',
    'vo2': 'vo2max'
  };
  
  const mappedIntensity = intensityMap[normalizedIntensity] || 'aerobic';
  
  // MET values for different activities and intensities
  // Aerobic = Zone 1-2 (65-80% VO2max), Threshold = Zone 3-4 (80-95% VO2max), VO2max = Zone 4-5 (95-100% VO2max)
  const metValues = {
    run: { aerobic: 7.5, threshold: 10.5, vo2max: 14.0 },
    bike: { aerobic: 6.5, threshold: 9.5, vo2max: 12.5 },
    swim: { aerobic: 6.0, threshold: 9.0, vo2max: 11.5 },
    hitt: { aerobic: 7.5, threshold: 10.5, vo2max: 14.0 },
    strength: { aerobic: 3.5, threshold: 5.0, vo2max: 6.5 }
  };
  
  // Get MET value, with fallback to default
  const met = metValues[mappedType]?.[mappedIntensity] || metValues.run.aerobic;
  
  // Formula: (MET × body weight in kg × 3.5) / 200 = kcal/min
  const kcalPerMinute = (met * weightKg * 3.5) / 200;
  const totalCalories = kcalPerMinute * duration;
  
  return Math.round(totalCalories);
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// ---------- Shareable URL params ----------
const paramMap = [
  "sex","age","weightKg","heightCm","weeklyKm","weeklyBike","weeklySwim","weeklyStrength","doubleSessionDays","activityFactor","dayType","goal","carbLow","carbHigh","protein","fat","dark"
];
function encodeState(state){
  const p = new URLSearchParams();
  paramMap.forEach(k=>{ if(state[k]!==undefined && state[k]!==null) p.set(k, String(state[k])); });
  return `${window.location.pathname}?${p.toString()}`;
}
function readState(){
  const p = new URLSearchParams(window.location.search);
  const q = Object.fromEntries(p.entries());
  return {
    sex: q.sex || "male",
    age: q.age ? Number(q.age) : 27,
    weightKg: q.weightKg ? Number(q.weightKg) : 87,
    heightCm: q.heightCm ? Number(q.heightCm) : 183,
    weeklyKm: q.weeklyKm ? Number(q.weeklyKm) : 60,
    weeklyBike: q.weeklyBike ? Number(q.weeklyBike) : 0,
    weeklySwim: q.weeklySwim ? Number(q.weeklySwim) : 0,
    weeklyStrength: q.weeklyStrength ? Number(q.weeklyStrength) : 0,
    doubleSessionDays: q.doubleSessionDays ? Number(q.doubleSessionDays) : 0,
    activityFactor: q.activityFactor ? Number(q.activityFactor) : 1.45,
    dayType: q.dayType || "key",
    goal: q.goal || "performance",
    carbLow: q.carbLow ? Number(q.carbLow) : 5,
    carbHigh: q.carbHigh ? Number(q.carbHigh) : 8,
    protein: q.protein ? Number(q.protein) : 1.8,
    fat: q.fat ? Number(q.fat) : 1.1,
    dark: q.dark === "true"
  };
}

// ---------- Performance Tab Components ----------
const WeeklySessionDay = ({ day, dayIndex, session, onUpdate, trainingCalories, totalCalories, macros, weightKg }) => {
  const updateSession = (field, value) => {
    onUpdate({ ...session, [field]: value });
  };

  const updateSecondSession = (field, value) => {
    onUpdate({ 
      ...session, 
      secondSession: { ...session.secondSession, [field]: value } 
    });
  };

  const toggleDoubleSession = () => {
    onUpdate({ 
      ...session, 
      doubleSession: !session.doubleSession,
      secondSession: session.doubleSession ? session.secondSession : { duration: 0, type: 'run', intensity: 'aerobic' }
    });
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 capitalize">{day}</h3>
        <div className="text-right">
          <div className="text-sm text-slate-600 dark:text-slate-400">Total Daily Calories</div>
          <div className="text-xl font-bold text-orange-700 dark:text-orange-300">{totalCalories} kcal</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Training: {trainingCalories} kcal
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div>
          <Label>Duration (min)</Label>
          <input
            type="number"
            value={session.duration}
            onChange={(e) => updateSession('duration', Number(e.target.value))}
            onFocus={(e) => { if (session.duration === 0) { e.target.select(); } }}
            min="0"
            max="300"
            className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        <div>
          <Label>Session Type</Label>
          <select
            value={session.type}
            onChange={(e) => updateSession('type', e.target.value)}
            className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="run">Run</option>
            <option value="bike">Bike</option>
            <option value="swim">Swim</option>
            <option value="hitt">HIIT</option>
            <option value="strength">Strength</option>
          </select>
        </div>

        <div>
          <Label>Intensity</Label>
          <select
            value={session.intensity}
            onChange={(e) => updateSession('intensity', e.target.value)}
            className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="aerobic">Aerobic</option>
            <option value="threshold">Threshold</option>
            <option value="vo2max">VO2max</option>
          </select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={session.doubleSession}
              onChange={toggleDoubleSession}
              className="w-4 h-4 text-emerald-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Double Session</span>
          </label>
        </div>
      </div>

      {session.doubleSession && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Second Session</h4>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Duration (min)</Label>
              <input
                type="number"
                value={session.secondSession.duration}
                onChange={(e) => updateSecondSession('duration', Number(e.target.value))}
                onFocus={(e) => { if (session.secondSession.duration === 0) { e.target.select(); } }}
                min="0"
                max="300"
                className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <Label>Session Type</Label>
              <select
                value={session.secondSession.type}
                onChange={(e) => updateSecondSession('type', e.target.value)}
                className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="run">Run</option>
                <option value="bike">Bike</option>
                <option value="swim">Swim</option>
                <option value="hitt">HIIT</option>
                <option value="strength">Strength</option>
              </select>
            </div>

            <div>
              <Label>Intensity</Label>
              <select
                value={session.secondSession.intensity}
                onChange={(e) => updateSecondSession('intensity', e.target.value)}
                className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="aerobic">Aerobic</option>
                <option value="threshold">Threshold</option>
                <option value="vo2max">VO2max</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Fueling Scenarios */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Fueling Scenarios</h4>
        <div className="grid grid-cols-3 gap-2">
          {/* Underfueling */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Underfueling</div>
            <div className="text-xs text-red-600 dark:text-red-400 mb-2">{Math.round(totalCalories * 0.85)} kcal</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">C: {Math.round(weightKg * 5.0)}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">P: {macros.protein}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">F: {Math.round(((totalCalories * 0.85) - (Math.round(weightKg * 5.0) * 4) - (macros.protein * 4)) / 9)}g</div>
          </div>
          
          {/* Optimal */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Optimal</div>
            <div className="text-xs text-green-600 dark:text-green-400 mb-2">{totalCalories} kcal</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">C: {macros.carbs}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">P: {macros.protein}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">F: {macros.fat}g</div>
          </div>
          
          {/* Overfueling */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Overfueling</div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">{Math.round(totalCalories * 1.10)} kcal</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">C: {Math.round(weightKg * 8.0)}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">P: {macros.protein}g</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">F: {Math.round(((totalCalories * 1.10) - (Math.round(weightKg * 8.0) * 4) - (macros.protein * 4)) / 9)}g</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WeeklyCalorieChart = ({ dailyTotalCalories, dailyTrainingCalories, weeklySessions, nonTraining, weightKg }) => {
  const maxCalories = Math.max(...dailyTotalCalories, 100);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Debug logging
  console.log('Chart data:', { dailyTotalCalories, nonTraining, maxCalories, weightKg });
  
  // Session type colors
  const sessionColors = {
    run: 'from-red-500 to-red-400',
    bike: 'from-blue-500 to-blue-400', 
    swim: 'from-cyan-500 to-cyan-400',
    hitt: 'from-purple-500 to-purple-400',
    strength: 'from-orange-500 to-orange-400'
  };

  const getSessionBreakdown = (dayIndex) => {
    const day = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayIndex];
    const session = weeklySessions[day];
    const sessions = [];
    
    // Add first session if it exists
    if (session.duration > 0) {
      sessions.push({
        type: session.type,
        calories: calculateSessionCalories(weightKg, session.duration, session.type, session.intensity),
        color: sessionColors[session.type] || 'from-gray-500 to-gray-400'
      });
    }
    
    // Add second session if it exists
    if (session.doubleSession && session.secondSession.duration > 0) {
      sessions.push({
        type: session.secondSession.type,
        calories: calculateSessionCalories(weightKg, session.secondSession.duration, session.secondSession.type, session.secondSession.intensity),
        color: sessionColors[session.secondSession.type] || 'from-gray-500 to-gray-400'
      });
    }
    
    return sessions;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between h-64 space-x-2">
        {dailyTotalCalories.map((totalCalories, index) => {
          const sessions = getSessionBreakdown(index);
          const restingHeight = (nonTraining / maxCalories) * 240; // Use 240px as base height
          const sessionHeights = sessions.map(session => (session.calories / maxCalories) * 240);
          
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{totalCalories}</div>
              <div className="w-full h-full flex flex-col justify-end">
                {/* Session calories (stacked on top) */}
                {sessionHeights.map((height, sessionIndex) => (
                  <div
                    key={sessionIndex}
                    className={`w-full bg-gradient-to-t ${sessions[sessionIndex].color} transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${Math.max(height, 4)}px` }}
                    title={`${sessions[sessionIndex].type}: ${sessions[sessionIndex].calories} kcal`}
                  />
                ))}
                
                {/* Total fluid calories (always at bottom) */}
                <div
                  className="w-full bg-gradient-to-t from-slate-400 to-slate-300 rounded-t-lg"
                  style={{ height: `${Math.max(restingHeight, 8)}px` }}
                  title={`Resting: ${nonTraining} kcal`}
                />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 font-medium">{days[index]}</div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-slate-400 to-slate-300 rounded"></div>
          <span className="text-slate-600 dark:text-slate-400">Resting</span>
        </div>
        {Object.entries(sessionColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={`w-3 h-3 bg-gradient-to-r ${color} rounded`}></div>
            <span className="text-slate-600 dark:text-slate-400 capitalize">{type}</span>
          </div>
        ))}
      </div>
      
      <div className="text-center text-sm text-slate-600 dark:text-slate-400">
        Total calories per day (resting + training)
      </div>
    </div>
  );
};

export default function App(){
  // ---------- State ----------
  const initial = readState();
  const [sex, setSex] = useState(initial.sex);
  const [age, setAge] = useState(initial.age);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [heightCm, setHeightCm] = useState(initial.heightCm);
  const [weeklyKm, setWeeklyKm] = useState(initial.weeklyKm);
  const [weeklyBike, setWeeklyBike] = useState(initial.weeklyBike || 0);
  const [weeklySwim, setWeeklySwim] = useState(initial.weeklySwim || 0);
  const [weeklyStrength, setWeeklyStrength] = useState(initial.weeklyStrength || 0);
  const [doubleSessionDays, setDoubleSessionDays] = useState(initial.doubleSessionDays || 0);
  const [activityFactor, setActivityFactor] = useState(initial.activityFactor);
  const [dayType, setDayType] = useState(initial.dayType); // key | normal | recovery
  const [goal, setGoal] = useState(initial.goal); // performance | maintain_weight | slight_loss
  const [carbLow, setCarbLow] = useState(initial.carbLow);
  const [carbHigh, setCarbHigh] = useState(initial.carbHigh);
  const [protein, setProtein] = useState(initial.protein);
  const [fat, setFat] = useState(initial.fat);
  const [dark, setDark] = useState(Boolean(initial.dark));
  const [tab, setTab] = useState("daily"); // daily | race | hydration | performance
  
  // Performance tab state
  const [weeklySessions, setWeeklySessions] = useState({
    monday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    tuesday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    wednesday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    thursday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    friday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    saturday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } },
    sunday: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning', doubleSession: false, secondSession: { duration: 0, type: 'run', intensity: 'aerobic', timeOfDay: 'Morning' } }
  });

  // Persist dark mode to class on <html>
  useEffect(()=>{
    const root = document.documentElement;
    if(dark) root.classList.add("dark"); else root.classList.remove("dark");
  },[dark]);

  // ---------- Derived numbers ----------
  const bmr = useMemo(() => Math.round(mifflinStJeor({ sex, weightKg, heightCm, age })), [sex, weightKg, heightCm, age]);
  const nonTraining = useMemo(() => Math.round(bmr * activityFactor), [bmr, activityFactor]);
  const runKcal = useMemo(() => Math.round(runningKcalPerDay(weightKg, weeklyKm)), [weightKg, weeklyKm]);
  const bikeKcal = useMemo(() => Math.round(bikingKcalPerDay(weightKg, weeklyBike)), [weightKg, weeklyBike]);
  const swimKcal = useMemo(() => Math.round(swimmingKcalPerDay(weightKg, weeklySwim)), [weightKg, weeklySwim]);
  const strengthKcal = useMemo(() => Math.round(strengthKcalPerDay(weightKg, weeklyStrength)), [weightKg, weeklyStrength]);
  const totalTrainingKcal = useMemo(() => runKcal + bikeKcal + swimKcal + strengthKcal, [runKcal, bikeKcal, swimKcal, strengthKcal]);

  const dayAdj = useMemo(()=> dayType === "key" ? 250 : dayType === "recovery" ? -200 : 0,[dayType]);
  const goalAdj = useMemo(()=> goal === "performance" ? 100 : goal === "slight_loss" ? -200 : 0,[goal]);
  const doubleSessionAdj = useMemo(()=> doubleSessionDays * 150, [doubleSessionDays]); // Extra 150 kcal per double session day

  const targetCalories = clamp(Math.round(nonTraining + totalTrainingKcal + dayAdj + goalAdj + doubleSessionAdj), 1800, 6000);

  // Dynamic macro scaling based on training load
  const baseCarbRange = [Math.round(carbLow * weightKg), Math.round(carbHigh * weightKg)];
  const baseProteinG = Math.round(protein * weightKg);
  const baseFatG = Math.round(fat * weightKg);

  // Training load multiplier (1.0 for light, up to 1.3 for very heavy)
  const trainingLoadMultiplier = useMemo(() => {
    const totalTrainingHours = (weeklyKm + weeklyBike + weeklySwim) / 20 + weeklyStrength; // rough hours estimate
    const doubleSessionBonus = doubleSessionDays * 0.1;
    return Math.min(1.3, 1.0 + (totalTrainingHours + doubleSessionBonus) * 0.02);
  }, [weeklyKm, weeklyBike, weeklySwim, weeklyStrength, doubleSessionDays]);

  // Adjust carb range based on training load
  const carbRange = [
    Math.round(baseCarbRange[0] * trainingLoadMultiplier),
    Math.round(baseCarbRange[1] * trainingLoadMultiplier)
  ];
  
  // Protein increases slightly with training load
  const proteinG = Math.round(baseProteinG * (1 + (trainingLoadMultiplier - 1) * 0.2));
  
  // Fat stays relatively stable but can decrease slightly with very high training
  const fatG = Math.round(baseFatG * Math.max(0.8, 1.1 - (trainingLoadMultiplier - 1) * 0.3));

  const carbKcalMid = Math.round(((carbRange[0] + carbRange[1]) / 2) * 4);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const macroTotalKcal = carbKcalMid + proteinKcal + fatKcal;
  
  // Final scaling to fit target calories with 5% buffer for micronutrients
  const targetMacroCalories = Math.round(targetCalories * 0.95); // 95% of total calories for macros
  const scale = macroTotalKcal > targetMacroCalories ? targetMacroCalories / macroTotalKcal : 1;

  const carbGFinal = Math.round(((carbRange[0] + carbRange[1]) / 2) * scale);
  const proteinGFinal = Math.round(proteinG * scale);
  const fatGFinal = Math.round(fatG * scale);

  const carbKcal = carbGFinal * 4;
  const proteinKcalFinal = proteinGFinal * 4;
  const fatKcalFinal = fatGFinal * 9;

  const preCho = dayType === "key" ? 2.0 : dayType === "normal" ? 1.0 : 0.5; // g/kg
  const duringCho = dayType === "key" ? "30–60 g/h if >75 min or back-to-back" : dayType === "normal" ? "Optional small sip" : "Not required";
  const postCho = dayType === "key" ? 1.0 : 0.8; // g/kg

  // Hydration helpers
  const [sessionMin, setSessionMin] = useState(75);
  const [ambientC, setAmbientC] = useState(18);
  const [sweatCategory, setSweatCategory] = useState('Medium'); // Low / Medium / High / Very High
  
  // Advanced sodium calculation inputs (Premium feature)
  const [saltinessCategory, setSaltinessCategory] = useState('Medium'); // Low / Medium / High / Very High
  const [heatAcclimation, setHeatAcclimation] = useState('Not acclimated'); // Not / Partial / Well
  const [sessionDurationHr, setSessionDurationHr] = useState(1.5);
  
  // Tooltip visibility states
  const [showSaltinessTooltip, setShowSaltinessTooltip] = useState(false);
  const [showAcclimationTooltip, setShowAcclimationTooltip] = useState(false);
  
  // Map training log intensity to hydration multiplier
  const getIntensityMultiplier = (intensity) => {
    const normalized = intensity ? intensity.toLowerCase() : 'aerobic';
    const mapping = {
      'recovery': 0.9,      // Low intensity
      'aerobic': 0.9,       // Low intensity
      'tempo': 1.0,         // Moderate
      'threshold': 1.15,   // High
      'vo2max': 1.25,       // Very High
      'intervals': 1.25,    // Very High
      'vo2': 1.25          // Very High
    };
    return mapping[normalized] || 1.0;
  };
  
  // Baseline sweat rate
  const baselineSweatRate = useMemo(() => {
    const baselineRates = {
      'Low': 0.7,
      'Medium': 1.2,
      'High': 1.7,
      'Very High': 2.3
    };
    return baselineRates[sweatCategory] || 1.2;
  }, [sweatCategory]);
  
  // Baseline sodium concentration (Premium)
  const baselineNaMgPerL = useMemo(() => {
    const baselineSodium = {
      'Low': 500,
      'Medium': 900,
      'High': 1300,
      'Very High': 1800
    };
    return baselineSodium[saltinessCategory] || 900;
  }, [saltinessCategory]);
  
  // Intensity modifiers
  const intensitySweatMultiplier = useMemo(() => {
    // Based on training log intensity (default to 'High' if not specified)
    return 1.15; // High intensity default
  }, []);
  
  const intensityNaMultiplier = useMemo(() => {
    // Based on training log intensity
    return 1.10; // High intensity default
  }, []);
  
  // Temperature multiplier for sweat rate
  const temperatureMultiplier = useMemo(() => {
    if (ambientC <= 15) return 0.85; // Cool
    if (ambientC >= 35) return 1.40; // Very hot
    if (ambientC >= 29) return 1.25; // Hot
    if (ambientC >= 23) return 1.10; // Warm
    return 1.00; // Temperate
  }, [ambientC]);
  
  // Heat acclimation multiplier for sodium
  const acclimationMultiplier = useMemo(() => {
    const multipliers = {
      'Not acclimated': 1.00,
      'Partial acclimated': 0.85,
      'Well acclimated': 0.70
    };
    return multipliers[heatAcclimation] || 1.00;
  }, [heatAcclimation]);
  
  // Calculate effective sweat rate and sodium
  const effectiveSweatRate = useMemo(() => {
    return baselineSweatRate * intensitySweatMultiplier * temperatureMultiplier;
  }, [baselineSweatRate, intensitySweatMultiplier, temperatureMultiplier]);
  
  const effectiveNaMgPerL = useMemo(() => {
    return baselineNaMgPerL * intensityNaMultiplier * acclimationMultiplier;
  }, [baselineNaMgPerL, intensityNaMultiplier, acclimationMultiplier]);
  
  // Calculate sodium loss
  const sodiumLossPerHour = useMemo(() => {
    return effectiveSweatRate * effectiveNaMgPerL; // L/h * mg/L = mg/h
  }, [effectiveSweatRate, effectiveNaMgPerL]);
  
  const sessionSodiumLoss = useMemo(() => {
    return sodiumLossPerHour * sessionDurationHr;
  }, [sodiumLossPerHour, sessionDurationHr]);
  
  // Weather integration
  const [location, setLocation] = useState('');
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // Default to this Monday
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0]; // YYYY-MM-DD format
  });
  const [currentWeather, setCurrentWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weeklyWeather, setWeeklyWeather] = useState({});
  
  // Fetch weather for location
  const fetchWeather = async (cityName) => {
    if (!cityName) return;
    setLoadingWeather(true);
    try {
      const [current, forecast] = await Promise.all([
        fetchWeatherByCity(cityName),
        fetchForecastByCity(cityName)
      ]);
      
      setCurrentWeather(current);
      setWeeklyWeather(forecast || {});
      
      if (current) {
        setAmbientC(Math.round(current.temp));
        console.log(`✓ Weather loaded for ${cityName}: ${current.temp}°C`);
      }
    } catch (error) {
      console.error('Weather fetch failed:', error);
      // Fall back to manual temperature entry
    } finally {
      setLoadingWeather(false);
    }
  };
  
  // Calculate environmental heat/humidity index
  const envIndex = useMemo(() => {
    const t = Math.max(0, ambientC - 10); // >10°C starts to add load
    const h = Math.max(0, 50 - 40) / 2; // assuming 50% humidity
    return 50 + t * 3 + h * 2; // 50 baseline
  }, [ambientC, weightKg]);
  
  // Calculate replacement fraction (typically 60-80% of sweat rate)
  const replacementFraction = useMemo(() => {
    const baseFraction = 0.65; // Typical gut tolerance for replacement
    const envScale = 0.9 * Math.min(1, (envIndex - 50) / 70) + 0.6;
    return Math.max(0.4, Math.min(0.9, baseFraction * envScale));
  }, [envIndex]);
  
  // Sweat rate in ml/h and recommended fluid per hour (using default intensity for manual calculator)
  const sweatMlPerHr = useMemo(() => baselineSweatRate * 1.0 * 1000, [baselineSweatRate]);
  const fluidPerHour = useMemo(() => {
    const recFluid = Math.max(300, Math.min(1200, sweatMlPerHr * replacementFraction));
    return Math.round(recFluid);
  }, [sweatMlPerHr, replacementFraction]);
  
  // Total fluid needed for session
  const totalFluidMl = useMemo(() => {
    const hours = sessionMin / 60;
    return Math.round(fluidPerHour * hours);
  }, [fluidPerHour, sessionMin]);
  
  // Sodium calculations (using default intensity for manual calculator)
  const sweatNaMgPerL = useMemo(() => 500 + Math.max(0, ambientC - 15) * 20, [ambientC]); // Rough estimate based on temp
  const sweatNaLossPerHr = useMemo(() => baselineSweatRate * sweatNaMgPerL, [baselineSweatRate, sweatNaMgPerL]);
  const recSodiumPerHr = useMemo(() => Math.round(sweatNaLossPerHr * 0.7), [sweatNaLossPerHr]); // 70% replacement
  const totalSodiumMg = useMemo(() => {
    const hours = sessionMin / 60;
    return Math.round(recSodiumPerHr * hours);
  }, [recSodiumPerHr, sessionMin]);
  
  // Drink sodium concentration
  const drinkNaMgPerL = useMemo(() => {
    // If we drink fluidPerHour ml/h, we need recSodiumPerHr mg Na
    const drinkLPerHr = fluidPerHour / 1000;
    return drinkLPerHr > 0 ? Math.round(recSodiumPerHr / drinkLPerHr) : 700;
  }, [fluidPerHour, recSodiumPerHr]);
  
  // Additional computed values for display
  const fluidNeeded = useMemo(() => totalFluidMl / 1000, [totalFluidMl]);
  const sodiumNeeded = useMemo(() => totalSodiumMg, [totalSodiumMg]);
  const sodiumMgPerL = useMemo(() => drinkNaMgPerL, [drinkNaMgPerL]);
  
  // Helper to estimate temperature based on time of day
  const getTempForTimeOfDay = useMemo(() => {
    return (baseTemp, timeOfDay) => {
      // Temperature variations by time of day (relative to midday peak)
      const timeAdjustments = {
        'Morning': -2,      // Cooler in morning
        'Lunchtime': 0,     // Peak temperature
        'Afternoon': +2,    // Hottest part of day
        'Evening': -3       // Cooling down
      };
      return baseTemp + (timeAdjustments[timeOfDay] || 0);
    };
  }, []);
  
  // Calculate resting fluid needs (ml/day) based on body size
  // Research basis: General recommendation of 30-40ml/kg (AHA, EFSA, USDA)
  // 30ml/kg is the baseline for daily resting fluid needs
  const restingFluidNeeds = useMemo(() => {
    // Base fluid: 30ml per kg body weight
    return Math.round(weightKg * 30);
  }, [weightKg]);
  
  // Daily resting fluid (24 hours)
  const dailyRestingFluid = useMemo(() => Math.round(restingFluidNeeds / 24), [restingFluidNeeds]);
  
  // Calculate dates for the week
  const weekDates = useMemo(() => {
    const startDate = new Date(weekStartDate + 'T00:00:00'); // Ensure local date
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      // Get YYYY-MM-DD in local timezone to match forecast
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      days.push({
        date: dateKey,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      });
    }
    return days;
  }, [weekStartDate]);
  
  // Weekly hydration schedule based on training log and weather
  const weeklyHydrationSchedule = useMemo(() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const baseTemp = currentWeather?.temp || ambientC;
    const baseHumidity = currentWeather?.humidity || 50;
    
    return dayNames.map((dayName, index) => {
      const day = days[index];
      const session = weeklySessions[day];
      const hasTraining = session.duration > 0;
      const weekDate = weekDates[index];
      
      // Get forecast for this specific date
      const forecastForDate = weeklyWeather[weekDate.date] || null;
      const dayTemp = forecastForDate?.avgTemp || baseTemp;
      const dayHumidity = forecastForDate?.avgHumidity || baseHumidity;
      
      const sessions = [];
      
      // First session
      if (session.duration > 0) {
        const timeOfDay = session.timeOfDay || 'Morning';
        const weatherTemp = getTempForTimeOfDay(dayTemp, timeOfDay);
        const weatherHumidity = dayHumidity;
        const trainingHours = session.duration / 60;
        
        // Calculate effective sweat rate for this session based on its intensity
        const intensitySweatMult = getIntensityMultiplier(session.intensity);
        const intensityNaMult = session.intensity === 'threshold' || session.intensity === 'vo2max' ? 1.10 : 
                                 session.intensity === 'vo2max' || session.intensity === 'intervals' ? 1.20 : 1.0;
        const sessionEffectiveRate = baselineSweatRate * intensitySweatMult;
        
        const hydration = calculateHydrationNeeds(
          weatherTemp,
          weatherHumidity,
          trainingHours,
          sessionEffectiveRate,
          {
            baselineSweatRate,
            baselineNaPerL: baselineNaMgPerL, // mg/L
            intensitySweatMult,
            intensityNaMult,
            heatAcclimationMult: acclimationMultiplier
          }
        );
        
        
        sessions.push({
          type: session.type,
          duration: session.duration,
          timeOfDay,
          temp: Math.round(weatherTemp),
          humidity: weatherHumidity,
          fluidPerHour: hydration.fluidPerHour,
          totalFluid: Math.round(trainingHours * hydration.fluidPerHour),
          sodiumPerHour: hydration.sodiumPerHour,
          totalSodium: Math.round(trainingHours * hydration.sodiumPerHour)
        });
      }
      
      // Second session if double session
      if (session.doubleSession && session.secondSession?.duration > 0) {
        const timeOfDay = session.secondSession.timeOfDay || 'Afternoon';
        const weatherTemp = getTempForTimeOfDay(dayTemp, timeOfDay);
        const weatherHumidity = dayHumidity;
        const trainingHours = session.secondSession.duration / 60;
        
        // Calculate effective sweat rate for this session based on its intensity
        const intensitySweatMult = getIntensityMultiplier(session.secondSession.intensity);
        const intensityNaMult = session.secondSession.intensity === 'threshold' || session.secondSession.intensity === 'vo2max' ? 1.10 : 
                                  session.secondSession.intensity === 'vo2max' || session.secondSession.intensity === 'intervals' ? 1.20 : 1.0;
        const sessionEffectiveRate = baselineSweatRate * intensitySweatMult;
        
        const hydration = calculateHydrationNeeds(
          weatherTemp,
          weatherHumidity,
          trainingHours,
          sessionEffectiveRate,
          {
            baselineSweatRate,
            baselineNaPerL: baselineNaMgPerL, // mg/L
            intensitySweatMult,
            intensityNaMult,
            heatAcclimationMult: acclimationMultiplier
          }
        );
        
        sessions.push({
          type: session.secondSession.type,
          duration: session.secondSession.duration,
          timeOfDay,
          temp: Math.round(weatherTemp),
          humidity: weatherHumidity,
          fluidPerHour: hydration.fluidPerHour,
          totalFluid: Math.round(trainingHours * hydration.fluidPerHour),
          sodiumPerHour: hydration.sodiumPerHour,
          totalSodium: Math.round(trainingHours * hydration.sodiumPerHour)
        });
      }
      
      // Calculate totals
      const totalTrainingFluid = sessions.reduce((sum, s) => sum + s.totalFluid, 0);
      const totalTrainingSodium = sessions.reduce((sum, s) => sum + s.totalSodium, 0);
      const totalTrainingMins = sessions.reduce((sum, s) => sum + s.duration, 0);
      
      // Resting fluid for the day (24h worth, prorated)
      const dailyResting = Math.round(restingFluidNeeds);
      
      return {
        day: dayName,
        fullDay: day,
        hasTraining: hasTraining,
        sessions: sessions,
        totalTrainingFluid,
        totalTrainingSodium,
        totalTrainingMins,
        dailyResting: dailyResting,
        totalDaily: totalTrainingFluid + dailyResting,
        baseTemp: Math.round(dayTemp),
        humidity: dayHumidity,
        forecastDate: weekDate.fullDate,
        rawForecast: forecastForDate
      };
    });
  }, [weeklySessions, currentWeather, weeklyWeather, ambientC, baselineSweatRate, getTempForTimeOfDay, restingFluidNeeds, weekDates, getIntensityMultiplier]);

  // Performance tab calculations
  const dailyTrainingCalories = useMemo(() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.map(day => {
      const session = weeklySessions[day];
      if (!session) return 0;
      
      const firstSessionCalories = calculateSessionCalories(weightKg, session.duration, session.type, session.intensity);
      
      let secondSessionCalories = 0;
      if (session.doubleSession && session.secondSession) {
        secondSessionCalories = calculateSessionCalories(
          weightKg, 
          session.secondSession.duration || 0, 
          session.secondSession.type || 'run', 
          session.secondSession.intensity || 'aerobic'
        );
      }
      
      return firstSessionCalories + secondSessionCalories;
    });
  }, [weeklySessions, weightKg]);

  const dailyTrainingTime = useMemo(() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.map(day => {
      const session = weeklySessions[day];
      if (!session) return 0;
      
      const firstSessionTime = session.duration || 0;
      const secondSessionTime = (session.doubleSession && session.secondSession) ? (session.secondSession.duration || 0) : 0;
      return firstSessionTime + secondSessionTime;
    });
  }, [weeklySessions]);

  const trainingDays = useMemo(() => {
    return dailyTrainingTime.filter(time => time > 0).length;
  }, [dailyTrainingTime]);

  const doubleDays = useMemo(() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.filter(day => weeklySessions[day].doubleSession).length;
  }, [weeklySessions]);

  const dailyTotalCalories = useMemo(() => {
    return dailyTrainingCalories.map(trainingCalories => {
      // Base calories = BMR + non-training activity + training calories
      return nonTraining + trainingCalories;
    });
  }, [dailyTrainingCalories, nonTraining]);

  const weeklyTotalCalories = useMemo(() => 
    dailyTotalCalories.reduce((sum, calories) => sum + calories, 0), 
    [dailyTotalCalories]
  );

  // Calculate daily macros for each day
  const dailyMacros = useMemo(() => {
    return dailyTotalCalories.map(totalCalories => {
      // Use the same macro calculation logic as the main app
      const targetMacroCalories = Math.round(totalCalories * 0.95); // 95% of total calories for macros
      
      // Calculate carbs based on training load (5-8g/kg range)
      const carbG = Math.round(weightKg * 6.5); // Middle of 5-8g range
      const proteinG = Math.round(weightKg * 1.8); // 1.8g/kg as specified
      const carbKcal = carbG * 4;
      const proteinKcal = proteinG * 4;
      const remainingKcal = targetMacroCalories - carbKcal - proteinKcal;
      const fatG = Math.round(remainingKcal / 9);
      const fatKcal = fatG * 9;
      
      return {
        carbs: carbG,
        protein: proteinG,
        fat: fatG,
        totalCalories: totalCalories,
        macroCalories: carbKcal + proteinKcal + fatKcal
      };
    });
  }, [dailyTotalCalories, weightKg]);

  // ---------- Actions ----------
  const copyShareLink = async () => {
    const url = encodeState({ sex, age, weightKg, heightCm, weeklyKm, weeklyBike, weeklySwim, weeklyStrength, doubleSessionDays, activityFactor, dayType, goal, carbLow, carbHigh, protein, fat, dark });
    await navigator.clipboard.writeText(url);
    alert("Shareable link copied:\n" + url);
  };
  const downloadCSV = () => {
    const rows = [["Sex","Age","Weight_kg","Height_cm","Running_km","Cycling_km","Swimming_km","Strength_hrs","Double_sessions","Activity_factor","Day_type","Goal","Target_kcal","Carb_g","Protein_g","Fat_g","Pre_CHO_gkg","Post_CHO_gkg"],[sex,age,weightKg,heightCm,weeklyKm,weeklyBike,weeklySwim,weeklyStrength,doubleSessionDays,activityFactor,dayType,goal,targetCalories,carbGFinal,proteinGFinal,fatGFinal,preCho,postCho]];
    const csv = rows.map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nutrition_targets_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };
  const exportPDF = () => window.print();
  const resetAll = () => {
    setSex("male"); setAge(27); setWeightKg(87); setHeightCm(183);
    setWeeklyKm(60); setWeeklyBike(0); setWeeklySwim(0); setWeeklyStrength(0); setDoubleSessionDays(0);
    setActivityFactor(1.45); setDayType("key"); setGoal("performance");
    setCarbLow(5); setCarbHigh(8); setProtein(1.8); setFat(1.1); setDark(false); setTab("daily");
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-700/50 print:hidden shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Nutrition Planner Logo" 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl shadow-lg object-contain bg-white dark:bg-slate-800 p-1"
              />
              <div>
                <div className="text-lg sm:text-xl font-bold leading-tight text-orange-700 dark:text-orange-400">Nutrition Planner</div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Running fuel calculator</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={()=>setDark(v=>!v)} 
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px] active:scale-95"
              >
                <span className="hidden sm:inline">{dark ? "☀️ Light" : "🌙 Dark"}</span>
                <span className="sm:hidden">{dark ? "☀️" : "🌙"}</span>
              </button>
              <button 
                onClick={copyShareLink} 
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs sm:text-sm font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm min-h-[44px] active:scale-95"
              >
                <span className="hidden sm:inline">📋 Share</span>
                <span className="sm:hidden">📋</span>
              </button>
              <button 
                onClick={downloadCSV} 
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px] active:scale-95"
              >
                <span className="hidden sm:inline">📊 CSV</span>
                <span className="sm:hidden">📊</span>
              </button>
              <button 
                onClick={exportPDF} 
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px] active:scale-95"
              >
                <span className="hidden sm:inline">📄 PDF</span>
                <span className="sm:hidden">📄</span>
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 sm:pb-4">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="inline-flex min-w-max rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {[
                {id:"daily",label:"Daily", icon:"📊"},
                {id:"traininglog",label:"Training", icon:"🏃"},
                {id:"race",label:"Race Week", icon:"🏁"},
                {id:"hydration",label:"Hydration", icon:"💧"},
                {id:"coach",label:"Coach", icon:"💡"},
                {id:"reports",label:"Reports", icon:"📈"},
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={()=>setTab(t.id)} 
                  className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    tab===t.id
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm" 
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="hidden sm:inline">{t.icon} </span>{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 print:px-8">
        <AnimatePresence mode="wait">
          {tab === "daily" && (
            <motion.div key="daily" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}}>
              {/* Inputs */}
              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <Card>
                  <SectionTitle title="Athlete" subtitle="Basics for BMR and per-kg macros" />
                  <div className="space-y-4">
                    <InputRow label="Sex">
                      <div className="flex gap-2">
                        {["male","female"].map(s=>(
                          <button 
                            key={s} 
                            onClick={()=>setSex(s)} 
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                              sex===s
                                ? "bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 text-white shadow-sm" 
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </InputRow>
                    <InputRow label="Age"><NumberInput value={age} onChange={setAge} min={14} max={80} /></InputRow>
                    <InputRow label="Weight"><NumberInput value={weightKg} onChange={setWeightKg} min={35} max={140} step={0.5} suffix="kg" /></InputRow>
                    <InputRow label="Height"><NumberInput value={heightCm} onChange={setHeightCm} min={120} max={220} step={0.5} suffix="cm" /></InputRow>
                    <InputRow label="Sweat Rate Category">
                      <select 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500" 
                        value={sweatCategory}
                        onChange={(e) => setSweatCategory(e.target.value)}
                      >
                        <option value="Low">Low (0.7 L/hr)</option>
                        <option value="Medium">Medium (1.2 L/hr)</option>
                        <option value="High">High (1.7 L/hr)</option>
                        <option value="Very High">Very High (2.3 L/hr)</option>
                      </select>
                    </InputRow>
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="Training Load" subtitle="Multi-sport training & adjustments" />
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <InputRow label="Running"><NumberInput value={weeklyKm} onChange={setWeeklyKm} min={0} max={200} step={1} suffix="km/week" /></InputRow>
                      <InputRow label="Cycling"><NumberInput value={weeklyBike} onChange={setWeeklyBike} min={0} max={300} step={1} suffix="km/week" /></InputRow>
                      <InputRow label="Swimming"><NumberInput value={weeklySwim} onChange={setWeeklySwim} min={0} max={50} step={0.5} suffix="km/week" /></InputRow>
                      <InputRow label="Strength"><NumberInput value={weeklyStrength} onChange={setWeeklyStrength} min={0} max={20} step={0.5} suffix="hrs/week" /></InputRow>
                    </div>
                    <InputRow label="Double Session Days"><NumberInput value={doubleSessionDays} onChange={setDoubleSessionDays} min={0} max={7} step={1} suffix="days/week" /></InputRow>
                    <InputRow label="Activity Factor (non-training)"><NumberInput value={activityFactor} onChange={setActivityFactor} min={1.2} max={1.8} step={0.01} /></InputRow>
                    <div className="text-xs text-slate-500 -mt-2">Sedentary ~1.3, active job ~1.6. Double sessions add +150 kcal/day.</div>
                    <InputRow label="Day Type">
                      <div className="flex gap-2 flex-wrap">
                        {[{id:"key",label:"Key"},{id:"normal",label:"Normal"},{id:"recovery",label:"Recovery"}].map(d=> (
                          <button 
                            key={d.id} 
                            onClick={()=>setDayType(d.id)} 
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                              dayType===d.id
                                ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm" 
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </InputRow>
                    <InputRow label="Goal">
                      <div className="flex gap-2 flex-wrap">
                        {[{id:"performance",label:"Performance"},{id:"maintain_weight",label:"Maintain"},{id:"slight_loss",label:"Slight loss"}].map(g=> (
                          <button 
                            key={g.id} 
                            onClick={()=>setGoal(g.id)} 
                            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                              goal===g.id
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm" 
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </InputRow>
                  </div>
                </Card>

                <Card className="lg:col-span-2">
                  <SectionTitle title="Macro Targets (g/kg)" subtitle="Auto-scales if calories too low" />
                  <div className="space-y-4">
                    <InputRow label="Carbohydrate (low)"><NumberInput value={carbLow} onChange={setCarbLow} min={3} max={10} step={0.1} suffix="g/kg" /></InputRow>
                    <InputRow label="Carbohydrate (high)"><NumberInput value={carbHigh} onChange={setCarbHigh} min={carbLow} max={12} step={0.1} suffix="g/kg" /></InputRow>
                    <InputRow label="Protein"><NumberInput value={protein} onChange={setProtein} min={1.4} max={2.4} step={0.1} suffix="g/kg" /></InputRow>
                    <InputRow label="Fat"><NumberInput value={fat} onChange={setFat} min={0.6} max={1.6} step={0.05} suffix="g/kg" /></InputRow>
                    <p className="text-xs text-slate-500">Protein held constant; carbs/fats scale if macros exceed daily kcal.</p>
                  </div>
                </Card>
              </div>

              {/* Outputs */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.05}}>
                  <Card>
                    <SectionTitle title="Daily Energy" />
                    <div className="space-y-1 text-sm">
                      <KV label="BMR (Mifflin–St Jeor)" value={`${bmr} kcal`} />
                      <KV label="Non-training movement" value={`${nonTraining} kcal`} />
                      <div className="ml-2 space-y-1">
                        <KV label="Running" value={`${runKcal} kcal`} />
                        <KV label="Cycling" value={`${bikeKcal} kcal`} />
                        <KV label="Swimming" value={`${swimKcal} kcal`} />
                        <KV label="Strength" value={`${strengthKcal} kcal`} />
                      </div>
                      <KV label="Total training" value={`${totalTrainingKcal} kcal`} />
                      <KV label="Day adjustment" value={`${dayAdj>0?"+":""}${dayAdj} kcal`} />
                      <KV label="Goal adjustment" value={`${goalAdj>0?"+":""}${goalAdj} kcal`} />
                      <KV label="Double sessions" value={`${doubleSessionAdj>0?"+":""}${doubleSessionAdj} kcal`} />
                      <hr className="my-2" />
                      <KV big label="Target calories (today)" value={`${targetCalories} kcal`} />
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
                  <Card>
                    <SectionTitle title="Macros (targets)" />
                    <div className="text-sm space-y-1">
                      <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Training Load Multiplier</div>
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                          {trainingLoadMultiplier.toFixed(2)}x
                        </div>
                        <div className="text-xs text-slate-500">
                          {trainingLoadMultiplier < 1.1 ? "Light" : trainingLoadMultiplier < 1.2 ? "Moderate" : "Heavy"} training load
                        </div>
                      </div>
                      <KV label="Carbohydrate" value={`${carbGFinal} g (${carbKcal} kcal)`} />
                      <KV label="Protein" value={`${proteinGFinal} g (${proteinKcalFinal} kcal)`} />
                      <KV label="Fat" value={`${fatGFinal} g (${fatKcalFinal} kcal)`} />
                      <hr className="my-2" />
                      <KV label="Total macro kcal" value={`${carbKcal + proteinKcalFinal + fatKcalFinal} kcal`} />
                      <div className="text-xs text-slate-500 mt-2">
                        Macro calories are 95% of total daily energy, leaving 5% for micronutrients and fiber.
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.15}}>
                  <Card>
                    <SectionTitle title="Fuel Timing" />
                    <ul className="text-sm list-disc pl-4 space-y-1">
                      <li><strong>Pre:</strong> {preCho} g/kg carbs + 20–30 g protein (1–3 h before)</li>
                      <li><strong>During:</strong> {duringCho}</li>
                      <li><strong>Post (0–60 min):</strong> {postCho} g/kg carbs + 20–30 g protein</li>
                      <li><strong>Double sessions:</strong> 1–1.5 g/kg carbs between sessions</li>
                      <li><strong>Strength days:</strong> Extra 20–30 g protein post-workout</li>
                      <li>Hydration: 500–750 ml/h in heat + electrolytes</li>
                    </ul>
                  </Card>
                </motion.div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.2}}>
                  <Card>
                    <SectionTitle title="Example Menu (scalable)" />
                    <div className="space-y-3">
                      {[
                        {title:"Breakfast (Pre-Run)",items:["Oats (80 g) + milk","Banana + honey","Whey protein (25 g)"]},
                        {title:"Post-Run Snack",items:["Greek yogurt (200 g)","Berries","Granola (40 g)"]},
                        {title:"Lunch",items:["Rice (200 g cooked)","Chicken breast (180 g)","Veg + olive oil"]},
                        {title:"Snack",items:["Banana","Peanut butter toast","Electrolyte drink"]},
                        {title:"Dinner",items:["Pasta (120 g dry)","Lean beef (180 g)","Tomato sauce"]},
                        {title:"Evening Snack",items:["Milk","Toast + nut butter"]},
                      ].map((m,i)=> (
                        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-800/50">
                          <div className="font-semibold mb-2 text-slate-800 dark:text-slate-200">{m.title}</div>
                          <ul className="list-disc pl-4 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                            {m.items.map((it,j)=>(<li key={j}>{it}</li>))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.25}}>
                  <Card>
                    <SectionTitle title="Guidelines" />
                    <ul className="list-disc pl-4 text-sm space-y-2 text-slate-700 dark:text-slate-300">
                      <li>Carb periodisation: push to upper range on key days / long sessions.</li>
                      <li>Protein ~0.3 g/kg per feeding × 4–5 meals to optimise MPS.</li>
                      <li>Fats mostly from olive oil, nuts, avocado, fatty fish.</li>
                      <li>Multi-sport: Higher carbs on cycling days, more protein on strength days.</li>
                      <li>Double sessions: Extra 1–1.5 g/kg carbs between sessions.</li>
                      <li>Supplements: Vitamin D, Omega-3, Caffeine (3–6 mg/kg pre-key), Creatine (3–5 g/day).</li>
                      <li>Monitor iron/ferritin each block if training hard.</li>
                      <li>Red flags: unintended weight loss, low mood, persistent fatigue → increase calories.</li>
                    </ul>
                    <div className="mt-4 flex gap-2 print:hidden">
                      <button 
                        onClick={resetAll} 
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        🔄 Reset All
                      </button>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}

          {tab === "race" && (
            <motion.div key="race" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <Card>
                <SectionTitle title="Race Event Planning" subtitle="Set your race details and goal time" />
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Race Event</Label>
                    <select className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100">
                      <option>5km</option>
                      <option>10km</option>
                      <option>Half Marathon</option>
                      <option selected>Marathon</option>
                      <option>Ironman 70.3</option>
                      <option>Ironman</option>
                    </select>
                  </div>
                  <div>
                    <Label>Goal Time (hours)</Label>
                    <input type="number" min="0" max="24" defaultValue="3" className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <Label>Goal Time (minutes)</Label>
                    <input type="number" min="0" max="59" defaultValue="30" className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-3 py-2" />
                  </div>
                </div>
              </Card>
              
              <Card>
                <SectionTitle title="7-Day Race Week Breakdown" />
                <div className="space-y-4">
                  {[
                    {day:7,phase:"Normal Training",carbs:696,calories:2732},
                    {day:6,phase:"Normal Training",carbs:696,calories:2732},
                    {day:5,phase:"Normal Training",carbs:696,calories:2732},
                    {day:4,phase:"🔥 Carb Loading",carbs:696,calories:3428},
                    {day:3,phase:"🔥 Carb Loading",carbs:696,calories:3428},
                    {day:2,phase:"⚠️ Fiber Caution + Carb Load",carbs:870,calories:2732},
                    {day:1,phase:"⚠️ Fiber Caution + Carb Load",carbs:870,calories:2732}
                  ].map(d => (
                    <div key={d.day} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <div className="font-bold">Day {d.day}</div>
                          <div className={d.phase.includes("🔥") ? "text-orange-600" : d.phase.includes("⚠️") ? "text-amber-600" : "text-emerald-600"}>
                            {d.phase}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{d.calories} kcal</div>
                          <div className="text-sm text-slate-500">Rest: 2732 | Training: 0</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label>Min</Label>
                          <input type="number" min="0" max="300" defaultValue="0" className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1" />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <select className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1">
                            <option>Run</option>
                            <option>Bike</option>
                            <option>Swim</option>
                            <option>Strength</option>
                          </select>
                        </div>
                        <div>
                          <Label>Intensity</Label>
                          <select className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg px-2 py-1">
                            <option selected>Aerobic</option>
                            <option>Threshold</option>
                            <option>VO2max</option>
                          </select>
                        </div>
                        <div className="text-sm">
                          <div>C: {d.carbs}g</div>
                          <div>P: {Math.round(weightKg * 1.6)}g</div>
                          <div>F: 87g</div>
                        </div>
                      </div>
                      {d.phase.includes("🔥") && (
                        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm">
                          🔥 <strong>Carb Loading:</strong> Eat 5-6 small meals. Focus on simple carbs. Stay hydrated.
                        </div>
                      )}
                      {d.phase.includes("⚠️") && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                          ⚠️ <strong>Fiber Caution:</strong> Avoid beans, lentils, bran, cruciferous veg. Choose white rice, pasta, bread.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle title="Fiber Caution Foods" subtitle="Smart food choices for race week" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-orange-700 dark:text-orange-300">✅ Best Options (Low Fiber)</h4>
                    <div className="space-y-2 text-sm">
                      <div>🍚 White rice (cooked): 55g/cup</div>
                      <div>🍝 White pasta (cooked): 45g/cup</div>
                      <div>🍞 White bread (2 slices): 30g</div>
                      <div>🍌 Banana: 25g each</div>
                      <div>🧃 Sports drink: 35g/500ml</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-300">❌ Foods to Avoid</h4>
                    <div className="space-y-2 text-sm">
                      <div>• High-fiber foods (beans, lentils, bran)</div>
                      <div>• Cruciferous vegetables</div>
                      <div>• High-fat meals</div>
                      <div>• New/untested foods</div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {tab === "hydration" && (
            <motion.div key="hydration" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              {/* Location and Weather Section */}
              <Card>
                <SectionTitle title="Location & Weather" subtitle="Get forecast for your training week" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div>
                    <Label>Week Start Date</Label>
                    <input
                      type="date"
                      className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                    />
                </div>
                  <div className="md:col-span-2">
                    <Label>Location</Label>
                    <div className="flex gap-3 mt-1">
                      <input
                        type="text"
                        placeholder="Enter city name (e.g., London, New York)"
                        className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-4 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && fetchWeather(location)}
                      />
                      <button
                        onClick={() => fetchWeather(location)}
                        disabled={loadingWeather || !location}
                        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingWeather ? 'Loading...' : 'Get Weather'}
                      </button>
                    </div>
                  </div>
                </div>
                {currentWeather && (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="text-5xl">🌤️</div>
                    <div>
                      <div className="text-xl font-bold">{currentWeather.city}, {currentWeather.country}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 capitalize">{currentWeather.description}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-3xl font-bold">{Math.round(currentWeather.temp)}°C</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Humidity: {currentWeather.humidity}%</div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Premium Hydration Calculator - Auto-calculates from training log & weather */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <SectionTitle title="🧂 Premium Sodium Calculator" subtitle="Advanced sodium loss estimation (auto-synced with training log & weather)" />
                  </div>
                  <span className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold rounded-full">
                    PREMIUM
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Saltiness Category</Label>
                      <div className="group relative inline-block">
                        <div 
                          className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold cursor-pointer flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors"
                          onClick={() => setShowSaltinessTooltip(!showSaltinessTooltip)}
                        >
                          ?
                        </div>
                        <div className={`absolute left-0 bottom-full mb-2 w-80 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 transition-all duration-200 z-50 pointer-events-none ${showSaltinessTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                          <div className="font-semibold mb-2 text-orange-300">Saltiness Category Guide:</div>
                          <div className="space-y-1.5">
                            <div><span className="text-orange-400 font-semibold">Low</span> (500 mg/L): Rare white marks on skin or clothing.</div>
                            <div><span className="text-orange-400 font-semibold">Medium</span> (900 mg/L): Occasional light salt streaks after longer/harder sessions.</div>
                            <div><span className="text-orange-400 font-semibold">High</span> (1,300 mg/L): Salt marks common on kit and skin, especially after moderate-long workouts.</div>
                            <div><span className="text-orange-400 font-semibold">Very High</span> (1,800 mg/L): Heavy salt residue with visible white crusting on clothing and equipment.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <select 
                      className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500"
                      value={saltinessCategory}
                      onChange={(e) => setSaltinessCategory(e.target.value)}
                    >
                      <option value="Low">Low (500 mg/L)</option>
                      <option value="Medium">Medium (900 mg/L)</option>
                      <option value="High">High (1,300 mg/L)</option>
                      <option value="Very High">Very High (1,800 mg/L)</option>
                    </select>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Heat Acclimation Status</Label>
                      <div className="group relative inline-block">
                        <div 
                          className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold cursor-pointer flex items-center justify-center hover:bg-orange-600 active:bg-orange-700 transition-colors"
                          onClick={() => setShowAcclimationTooltip(!showAcclimationTooltip)}
                        >
                          ?
                        </div>
                        <div className={`absolute left-0 bottom-full mb-2 w-80 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg shadow-xl p-3 transition-all duration-200 z-50 pointer-events-none ${showAcclimationTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                          <div className="font-semibold mb-2 text-orange-300">Heat Acclimation Guide:</div>
                          <div className="space-y-1.5">
                            <div><span className="text-orange-400 font-semibold">Not acclimated:</span> Heat feels harder, sweating less efficient.</div>
                            <div><span className="text-orange-400 font-semibold">Partially (3-7 days):</span> Few recent heat sessions, exercise easier but sweating heavy/uneven.</div>
                            <div><span className="text-orange-400 font-semibold">Well acclimated (8-14+ days):</span> Regular heat training, sweating starts earlier and more evenly.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <select 
                      className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500"
                      value={heatAcclimation}
                      onChange={(e) => setHeatAcclimation(e.target.value)}
                    >
                      <option value="Not acclimated">Not acclimated (1.00×)</option>
                      <option value="Partial acclimated">Partial (0.85×)</option>
                      <option value="Well acclimated">Well acclimated (0.70×)</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-800">
                  <div className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">⚙️ Auto-Calculated Settings</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-slate-600 dark:text-slate-400">Intensity Modifier</div>
                      <div className="font-mono font-semibold text-orange-700 dark:text-orange-300">Sweat: {intensitySweatMultiplier.toFixed(2)}× Na: {intensityNaMultiplier.toFixed(2)}×</div>
                      <div className="text-slate-500 text-[10px] mt-1">From training log intensity</div>
                    </div>
                    <div>
                      <div className="text-slate-600 dark:text-slate-400">Temperature Modifier</div>
                      <div className="font-mono font-semibold text-orange-700 dark:text-orange-300">{temperatureMultiplier.toFixed(2)}× @ {ambientC}°C</div>
                      <div className="text-slate-500 text-[10px] mt-1">From weather API</div>
                    </div>
                    <div>
                      <div className="text-slate-600 dark:text-slate-400">Acclimation Modifier</div>
                      <div className="font-mono font-semibold text-orange-700 dark:text-orange-300">{acclimationMultiplier.toFixed(2)}× Na</div>
                      <div className="text-slate-500 text-[10px] mt-1">{heatAcclimation}</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Weekly Hydration Schedule */}
                <Card>
                <SectionTitle title="Weekly Hydration Schedule" subtitle="Training sessions + resting fluid needs" />
                <div className="space-y-4">
                  {weeklyHydrationSchedule.map((day, index) => (
                    <div key={day.day} className={`border rounded-xl p-4 ${day.hasTraining ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="mb-3">
                        <div className="font-bold text-lg">{day.day}</div>
                        {day.forecastDate && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">{day.forecastDate}</div>
                        )}
                      </div>
                      
                      {day.hasTraining ? (
                        <>
                          {/* Training Sessions */}
                          {day.sessions.map((session, idx) => (
                            <div key={idx} className="mb-3 pb-3 border-b border-orange-200 dark:border-orange-700 last:border-0 last:pb-0 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold text-orange-700 dark:text-orange-300">
                                  {session.timeOfDay} Session • {session.type} • {session.duration} min
                                </div>
                                <div className="text-xs text-slate-500">
                                  {session.temp}°C • {session.humidity}% humidity
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-slate-600 dark:text-slate-400 mb-1">Rate</div>
                                  <div className="font-semibold text-orange-700 dark:text-orange-400">
                                    <span className="text-slate-700 dark:text-slate-300">Fluid:</span> {session.fluidPerHour} ml/h
                                  </div>
                                  <div className="font-semibold text-orange-700 dark:text-orange-400">
                                    <span className="text-slate-700 dark:text-slate-300">Sodium:</span> {session.sodiumPerHour} mg/h
                                  </div>
                                </div>
                                <div>
                                  <div className="text-slate-600 dark:text-slate-400 mb-1">Session Total</div>
                                  <div className="font-semibold text-orange-700 dark:text-orange-400">
                                    <span className="text-slate-700 dark:text-slate-300">Fluid:</span> {session.totalFluid} ml
                                  </div>
                                  <div className="font-semibold text-orange-700 dark:text-orange-400">
                                    <span className="text-slate-700 dark:text-slate-300">Sodium:</span> {session.totalSodium} mg
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Daily Summary */}
                          <div className="mt-3 pt-3 border-t-2 border-slate-300 dark:border-slate-600">
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="text-slate-600 dark:text-slate-400 mb-1">Training Total</div>
                                <div className="font-bold text-orange-700 dark:text-orange-300">
                                  <span className="text-slate-700 dark:text-slate-300 text-xs font-normal">Fluid:</span> {day.totalTrainingFluid} ml
                                </div>
                                <div className="text-xs text-slate-500">
                                  <span className="font-semibold">Sodium:</span> {day.totalTrainingSodium} mg
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-600 dark:text-slate-400 mb-1">Total Fluid Intake (24h)</div>
                                <div className="font-bold text-orange-700 dark:text-orange-300">
                                  <span className="text-slate-700 dark:text-slate-300 text-xs font-normal">Fluid:</span> {day.dailyResting} ml
                                </div>
                                <div className="text-xs text-slate-500">Background fluid</div>
                              </div>
                              <div>
                                <div className="text-slate-600 dark:text-slate-400 mb-1">Daily Total</div>
                                <div className="font-bold text-xl text-orange-800 dark:text-orange-200">
                                  <span className="text-slate-700 dark:text-slate-300 text-sm font-normal">Fluid:</span> {day.totalDaily} ml
                                </div>
                                <div className="text-xs text-slate-500">All fluids combined</div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Rest day • {day.baseTemp}°C forecasted • {day.dailyResting} ml total fluid recommended
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </Card>


              <div className="grid lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <Card>
                    <SectionTitle title="Manual Temperature Override" subtitle="Adjust temperature manually or use weather from above" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Body mass (kg)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500" 
                        value={weightKg} 
                        onChange={e => setWeightKg(Number(e.target.value))}
                        min={35}
                        max={140}
                      />
                    </div>

                    <div>
                      <Label>Session duration (min)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500" 
                        value={sessionMin} 
                        onChange={e => setSessionMin(Number(e.target.value))}
                        min={15}
                        max={480}
                      />
                    </div>

                    <div>
                      <Label>Intensity</Label>
                      <select 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500"
                        value={"easy"}
                      >
                        <option value="easy">Aerobic / Easy</option>
                        <option value="tempo">Tempo / Threshold</option>
                        <option value="vo2">VO₂ / Intervals</option>
                        <option value="strength">Strength</option>
                      </select>
                    </div>

                    <div>
                      <Label>Ambient temperature (°C)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500" 
                        value={ambientC} 
                        onChange={e => setAmbientC(Number(e.target.value))}
                        min={-10}
                        max={45}
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">ℹ️ Hydration Settings</div>
                      <div className="text-xs text-orange-700 dark:text-orange-300">
                        Sweat rate category is set in the Daily tab. Intensity automatically matches your training log.
                      </div>
                    </div>

                    <div>
                      <Label>Estimated sweat sodium (mg/L)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500" 
                        value={Math.round(sweatNaMgPerL)} 
                        onChange={e => {}}
                        readOnly
                        min={300}
                        max={1500}
                      />
                      <p className="text-xs text-slate-500 mt-1">Auto-calculated from ambient temp. Typical 500–1000 mg/L.</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="px-3 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">Env index: {Math.round(envIndex)}</span>
                    <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-orange-700 dark:text-orange-300 rounded-lg">Fluid rate: {fluidPerHour} ml/h</span>
                    <span className="px-3 py-1 text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg">Sodium: {recSodiumPerHr} mg/h</span>
                  </div>
                </Card>

                {/* Output Section */}
                <div className="space-y-6">
                  <Card>
                    <SectionTitle title="Session Plan" subtitle="Targets per hour and totals for the session" />
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Per hour</div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{fluidPerHour} ml</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sodium: {recSodiumPerHr} mg</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total this session</div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{totalFluidMl} ml</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sodium: {totalSodiumMg} mg</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-emerald-50 dark:bg-emerald-900/20">
                      <div className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-2">Drink Sodium Concentration</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        Your drink should contain approximately <span className="font-bold text-orange-700 dark:text-orange-300">{drinkNaMgPerL} mg/L</span> sodium to meet your needs.
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <SectionTitle title="Notes & Safeguards" />
                    <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                      <li>These are planning targets. Adjust by thirst, gut comfort, and weigh-in feedback.</li>
                      <li>Aim to limit body mass loss to ~2% in most events. Consider gut training for higher rates.</li>
                      <li>Use higher drink sodium in heavy sweaters or very hot/humid conditions.</li>
                    </ul>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {tab === "performance-old" && (
            <motion.div key="performance" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <Card>
                <SectionTitle title="Athlete Profile" subtitle="Basic info for calorie and macro calculations" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Weight</div>
                    <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{weightKg} kg</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Height</div>
                    <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{heightCm} cm</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-600 dark:text-slate-400">BMR</div>
                    <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{bmr} kcal</div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Base Activity</div>
                    <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{nonTraining} kcal</div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Note: Update your weight, height, and activity level in the Daily tab to adjust calculations.
                </p>
              </Card>

              <Card>
                <SectionTitle title="Weekly Training Schedule" subtitle="Plan your sessions and track daily calories" />
                <div className="space-y-4">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => (
                    <WeeklySessionDay 
                      key={day}
                      day={day}
                      dayIndex={index}
                      session={weeklySessions[day]}
                      onUpdate={(updatedSession) => {
                        setWeeklySessions(prev => ({
                          ...prev,
                          [day]: updatedSession
                        }));
                      }}
                      trainingCalories={dailyTrainingCalories[index]}
                      totalCalories={dailyTotalCalories[index]}
                      macros={dailyMacros[index]}
                      weightKg={weightKg}
                    />
                  ))}
                </div>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <SectionTitle title="Daily Calories" subtitle="Total calories per day (resting + training)" />
                  <div className="space-y-2">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => (
                      <div key={day} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="font-medium capitalize">{day}</span>
                        <div className="text-right">
                          <div className="font-bold text-orange-700 dark:text-orange-300">
                            {dailyTotalCalories[index]} kcal
                          </div>
                          <div className="text-xs text-slate-500">
                            Training: {dailyTrainingCalories[index]} kcal
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="Weekly Summary" subtitle="Total calories for the week" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-2">
                      {weeklyTotalCalories} kcal
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Average: {Math.round(weeklyTotalCalories / 7)} kcal/day
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Includes resting + training calories
                    </div>
                  </div>
                </Card>
              </div>

              <Card>
                <SectionTitle title="Weekly Calorie Chart" subtitle="Visual breakdown of daily total calories" />
                <WeeklyCalorieChart 
                  dailyTotalCalories={dailyTotalCalories}
                  dailyTrainingCalories={dailyTrainingCalories}
                  weeklySessions={weeklySessions}
                  nonTraining={nonTraining}
                  weightKg={weightKg}
                />
              </Card>
            </motion.div>
          )}

          {tab === "traininglog" && (
            <motion.div key="traininglog" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <Card>
                <SectionTitle title="Daily Training Log" subtitle="Track your sessions and nutrition" />
                <div className="space-y-4">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => (
                    <DayCard 
                      key={day}
                      day={day}
                      baseCalories={nonTraining}
                      trainingCalories={dailyTrainingCalories[index]}
                      carbs={Math.round(weightKg * (carbLow + carbHigh) / 2)}
                      protein={Math.round(weightKg * protein)}
                      fat={Math.round(weightKg * fat)}
                      session={weeklySessions[day]}
                      onUpdate={(updatedSession) => {
                        setWeeklySessions(prev => ({
                          ...prev,
                          [day]: updatedSession
                        }));
                      }}
                    />
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {tab === "coach" && (
            <motion.div key="coach" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <AthleteProfile 
                weightKg={weightKg}
                heightCm={heightCm}
                bmr={bmr}
                baseActivity={nonTraining}
              />
              
              <Card>
                <SectionTitle title="Coach Dashboard" subtitle="Manage athletes and training programs" />
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Athletes (0/5)</h3>
                    <button className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700">
                      + Add Athlete
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
                    <div className="text-4xl mb-3">🏋️</div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">No athletes yet</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Add up to 5 athletes to track their nutrition and training</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {tab === "reports" && (
            <motion.div key="reports" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <Card>
                <WeeklySummary 
                  dailyCalories={dailyTotalCalories}
                  dailyTrainingCalories={dailyTrainingCalories}
                  weightKg={weightKg}
                  carbsPerKg={(carbLow + carbHigh) / 2}
                  proteinPerKg={protein}
                  fatPerKg={fat}
                  dailyTrainingTime={dailyTrainingTime}
                  trainingDays={trainingDays}
                  doubleDays={doubleDays}
                />
              </Card>

              {/* Daily Hydration Schedule */}
              <Card>
                <SectionTitle title="Daily Hydration & Calories Summary" subtitle="Training + resting calories with hydration targets" />
                <div className="space-y-4">
                  {weeklyHydrationSchedule.map((day, index) => {
                    const dailyCalories = dailyTotalCalories[index];
                    return (
                      <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                          <div className="flex-1">
                            <div className="font-bold text-base sm:text-lg">{day.day}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {day.forecastDate}
                              {day.hasTraining && ` • ${day.totalTrainingMins} min training`}
                            </div>
                          </div>
                          <div className="text-left sm:text-right flex-shrink-0">
                            <div className="font-bold text-lg sm:text-xl text-orange-700 dark:text-orange-300">
                              {dailyCalories} kcal
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {day.totalDaily} ml fluid
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                          {/* Energy Breakdown */}
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border-2 border-orange-200 dark:border-orange-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-orange-700 dark:text-orange-300 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              ⚡ Energy
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              <div className="text-base sm:text-lg font-bold">Total: {dailyCalories} kcal</div>
                              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                Training: {day.hasTraining ? dailyTrainingCalories[index] : 0} kcal
                              </div>
                            </div>
                          </div>

                          {/* Hydration Breakdown */}
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border-2 border-blue-200 dark:border-blue-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              💧 Hydration
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              <div className="text-base sm:text-lg font-bold">Total: {day.totalDaily} ml</div>
                              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                Training: {day.totalTrainingFluid} ml
                              </div>
                            </div>
                          </div>

                          {/* Sodium */}
                          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 sm:p-4 border-2 border-purple-200 dark:border-purple-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              🧂 Sodium
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              <div className="text-base sm:text-lg font-bold">Training: {day.totalTrainingSodium} mg</div>
                              <div className="text-xs text-slate-500 mt-0.5 sm:mt-1">
                                {day.hasTraining ? 'During session' : 'Rest day'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Fuel Status Boxes */}
                        <div className="mt-4">
                          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                            Daily Calories
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          <div className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5 sm:mb-1 leading-tight">Under</div>
                            <div className="text-xs sm:text-sm font-bold text-red-800 dark:text-red-200">
                              {Math.round(dailyCalories * 0.85)} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-red-600 dark:text-red-400 mt-0.5">&lt;85%</div>
                          </div>
                          <div className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-300 mb-0.5 sm:mb-1 leading-tight">Optimal</div>
                            <div className="text-xs sm:text-sm font-bold text-green-800 dark:text-green-200">
                              {dailyCalories} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-green-600 dark:text-green-400 mt-0.5">100%</div>
                          </div>
                          <div className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-orange-700 dark:text-orange-300 mb-0.5 sm:mb-1 leading-tight">Over</div>
                            <div className="text-xs sm:text-sm font-bold text-orange-800 dark:text-orange-200">
                              {Math.round(dailyCalories * 1.1)} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-orange-600 dark:text-orange-400 mt-0.5">&gt;110%</div>
                          </div>
                          </div>
                        </div>

                        {/* Hydration Status Boxes */}
                        <div className="mt-4">
                          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                            Daily Hydration
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          <div className="border-2 border-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5 sm:mb-1 leading-tight">Under</div>
                            <div className="text-xs sm:text-sm font-bold text-red-800 dark:text-red-200">
                              {Math.round(day.totalDaily * 0.85)} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-red-600 dark:text-red-400 mt-0.5">&lt;85%</div>
                          </div>
                          <div className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-300 mb-0.5 sm:mb-1 leading-tight">Optimal</div>
                            <div className="text-xs sm:text-sm font-bold text-green-800 dark:text-green-200">
                              {day.totalDaily} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-green-600 dark:text-green-400 mt-0.5">100%</div>
                          </div>
                          <div className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-orange-700 dark:text-orange-300 mb-0.5 sm:mb-1 leading-tight">Over</div>
                            <div className="text-xs sm:text-sm font-bold text-orange-800 dark:text-orange-200">
                              {Math.round(day.totalDaily * 1.1)} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-orange-600 dark:text-orange-400 mt-0.5">&gt;110%</div>
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-xs text-slate-500 dark:text-slate-400 mt-6">
          Disclaimer: Educational tool; individual needs vary. Consult a sports dietitian for medical conditions.
        </div>
      </main>
    </div>
  );
}

function KV({ label, value, big }){
  return (
    <div className={`flex justify-between items-center ${big?"text-lg sm:text-xl lg:text-2xl font-bold text-orange-700 dark:text-orange-300":"text-sm sm:text-base lg:text-lg"}`}>
      <span className="text-slate-600 dark:text-slate-300 font-semibold text-left pr-2">{label}</span>
      <span className="font-bold text-orange-700 dark:text-orange-300 text-right whitespace-nowrap">{value}</span>
    </div>
  );
}
