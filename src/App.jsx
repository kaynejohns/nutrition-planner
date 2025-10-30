import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";
import DayCard from "./components/Week/DayCard";
import AthleteProfile from "./components/AthleteProfile";
import WeeklySummary from "./components/WeeklySummary";
import DailyCalories from "./components/DailyCalories";
import { fetchWeatherByCity, fetchForecastByCity, calculateHydrationNeeds } from "./utils/weather.js";
import { loadStripe } from '@stripe/stripe-js';
import { requireLogin, checkPremium, currentUser } from './lib/auth';

// ---------- UI primitives ----------
const Card = ({ children, className = "" }) => (
  <div className={`bg-[#24242A] rounded-card shadow-elevated border border-[#2A2A35] p-4 sm:p-6 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4 sm:mb-6">
    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#FFCE34] uppercase">{title}</h2>
    {subtitle && <p className="text-sm sm:text-base lg:text-lg text-[#A9A9B8] mt-1">{subtitle}</p>}
  </div>
);

const Label = ({ children }) => (
  <label className="text-xs sm:text-sm font-semibold text-[#A9A9B8] uppercase tracking-wide">{children}</label>
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
      className="flex-1 accent-[#FFCE34] h-6 sm:h-8 rounded-lg" 
      {...props}
    />
    <div className="flex items-center gap-2 w-full sm:w-40">
      <input 
        type="number" 
        value={value} 
        onChange={(e)=>onChange(Number(e.target.value))} 
        className="flex-1 sm:w-full border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2.5 text-base sm:text-lg text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34] transition-all"
        min={min}
        max={max}
        step={step}
      />
      {suffix && <span className="text-sm sm:text-base text-[#FFCE34] font-semibold whitespace-nowrap">{suffix}</span>}
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
    <div className="border border-[#2A2A35] rounded-card p-4 bg-[#2A2A35]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[#FFFFFF] capitalize">{day}</h3>
        <div className="text-right">
          <div className="text-sm text-[#A9A9B8]">Total Daily Calories</div>
          <div className="text-xl font-bold text-[#FFCE34]">{totalCalories} kcal</div>
          <div className="text-xs text-[#A9A9B8]">
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
                className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
                style={{ color: '#FFFFFF' }}
              />
        </div>

        <div>
          <Label>Session Type</Label>
          <select
            value={session.type}
            onChange={(e) => {
              const newType = e.target.value;
              if (newType === 'strength') {
                updateSession('type', newType);
                updateSession('intensity', 'aerobic'); // Clear intensity for strength
              } else {
                updateSession('type', newType);
              }
            }}
            className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
            style={{ color: '#FFFFFF' }}
          >
            <option value="run" style={{ background: '#24242A', color: '#FFFFFF' }}>Run</option>
            <option value="bike" style={{ background: '#24242A', color: '#FFFFFF' }}>Bike</option>
            <option value="swim" style={{ background: '#24242A', color: '#FFFFFF' }}>Swim</option>
            <option value="hitt" style={{ background: '#24242A', color: '#FFFFFF' }}>HIIT</option>
            <option value="strength" style={{ background: '#24242A', color: '#FFFFFF' }}>Strength</option>
          </select>
        </div>

        {session.type !== 'strength' && (
          <div>
            <Label>Intensity</Label>
            <select
              value={session.intensity}
              onChange={(e) => updateSession('intensity', e.target.value)}
              className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
            style={{ color: '#FFFFFF' }}
            >
              <option value="aerobic" style={{ background: '#24242A', color: '#FFFFFF' }}>Aerobic</option>
              <option value="threshold" style={{ background: '#24242A', color: '#FFFFFF' }}>Threshold</option>
              <option value="vo2max" style={{ background: '#24242A', color: '#FFFFFF' }}>VO2max</option>
            </select>
          </div>
        )}

        <div className="flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={session.doubleSession}
              onChange={toggleDoubleSession}
              className="w-4 h-4 text-emerald-600 bg-[#24242A] border-[#2A2A35] rounded focus:ring-[#FFCE34]"
            />
            <span className="text-sm font-medium text-[#FFFFFF]">Double Session</span>
          </label>
        </div>
      </div>

      {session.doubleSession && (
        <div className="border-t border-[#2A2A35] pt-3 mt-3">
          <h4 className="text-sm font-semibold text-[#FFFFFF] mb-3">Second Session</h4>
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
                className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
                style={{ color: '#FFFFFF' }}
              />
            </div>

            <div>
              <Label>Session Type</Label>
              <select
                value={session.secondSession.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  if (newType === 'strength') {
                    updateSecondSession('type', newType);
                    updateSecondSession('intensity', 'aerobic'); // Clear intensity for strength
                  } else {
                    updateSecondSession('type', newType);
                  }
                }}
                className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
                style={{ color: '#FFFFFF' }}
              >
                <option value="run" style={{ background: '#24242A', color: '#FFFFFF' }}>Run</option>
                <option value="bike" style={{ background: '#24242A', color: '#FFFFFF' }}>Bike</option>
                <option value="swim" style={{ background: '#24242A', color: '#FFFFFF' }}>Swim</option>
                <option value="hitt" style={{ background: '#24242A', color: '#FFFFFF' }}>HIIT</option>
                <option value="strength" style={{ background: '#24242A', color: '#FFFFFF' }}>Strength</option>
              </select>
            </div>

            {session.secondSession.type !== 'strength' && (
              <div>
                <Label>Intensity</Label>
                <select
                  value={session.secondSession.intensity}
                  onChange={(e) => updateSecondSession('intensity', e.target.value)}
                  className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34] focus:border-[#FFCE34]"
                  style={{ color: '#FFFFFF' }}
                >
                  <option value="aerobic" style={{ background: '#24242A', color: '#FFFFFF' }}>Aerobic</option>
                  <option value="threshold" style={{ background: '#24242A', color: '#FFFFFF' }}>Threshold</option>
                  <option value="vo2max" style={{ background: '#24242A', color: '#FFFFFF' }}>VO2max</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fueling Scenarios */}
      <div className="border-t border-[#2A2A35] pt-3 mt-3">
        <h4 className="text-sm font-semibold text-[#FFFFFF] mb-3">Fueling Scenarios</h4>
        <div className="grid grid-cols-3 gap-2">
          {/* Underfueling */}
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-red-300 mb-1">Underfueling</div>
            <div className="text-xs text-red-300 mb-2">{Math.round(totalCalories * 0.85)} kcal</div>
            <div className="text-xs text-[#A9A9B8]">C: {Math.round(weightKg * 5.0)}g</div>
            <div className="text-xs text-[#A9A9B8]">P: {macros.protein}g</div>
            <div className="text-xs text-[#A9A9B8]">F: {Math.round(((totalCalories * 0.85) - (Math.round(weightKg * 5.0) * 4) - (macros.protein * 4)) / 9)}g</div>
          </div>
          
          {/* Optimal */}
          <div className="bg-green-950/40 border border-green-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-green-300 mb-1">Optimal</div>
            <div className="text-xs text-green-300 mb-2">{totalCalories} kcal</div>
            <div className="text-xs text-[#A9A9B8]">C: {macros.carbs}g</div>
            <div className="text-xs text-[#A9A9B8]">P: {macros.protein}g</div>
            <div className="text-xs text-[#A9A9B8]">F: {macros.fat}g</div>
          </div>
          
          {/* Overfueling */}
          <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-2">
            <div className="text-xs font-semibold text-amber-300 mb-1">Overfueling</div>
            <div className="text-xs text-amber-300 mb-2">{Math.round(totalCalories * 1.10)} kcal</div>
            <div className="text-xs text-[#A9A9B8]">C: {Math.round(weightKg * 8.0)}g</div>
            <div className="text-xs text-[#A9A9B8]">P: {macros.protein}g</div>
            <div className="text-xs text-[#A9A9B8]">F: {Math.round(((totalCalories * 1.10) - (Math.round(weightKg * 8.0) * 4) - (macros.protein * 4)) / 9)}g</div>
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
              <div className="text-lg font-bold text-[#FFFFFF] mb-2">{totalCalories}</div>
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
              <div className="text-xs text-[#A9A9B8] mt-2 font-medium">{days[index]}</div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-slate-400 to-slate-300 rounded"></div>
          <span className="text-[#A9A9B8]">Resting</span>
        </div>
        {Object.entries(sessionColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className={`w-3 h-3 bg-gradient-to-r ${color} rounded`}></div>
            <span className="text-[#A9A9B8] capitalize">{type}</span>
          </div>
        ))}
      </div>
      
      <div className="text-center text-sm text-[#A9A9B8]">
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
  const [isPremium, setIsPremium] = useState(false); // Premium feature flag
  
  // Handle premium upgrade with Stripe
  const handleUpgrade = async () => {
    try {
      const user = await requireLogin();
      const token = await user.jwt();

      const res = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
          userId: user.id,
          email: user.email,
        }),
      });

      const { sessionUrl, error } = await res.json();
      if (error) return alert(error);

      window.location.href = sessionUrl;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    }
  };
  
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
  
  // Product Library State
  const [products, setProducts] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('race_products');
        return saved ? JSON.parse(saved) : [
          { id: 1, name: 'Energy Gel', carbs: 22, fluid: 30, sodium: 40, unit: 'pack' },
          { id: 2, name: 'Sports Drink', carbs: 14, fluid: 500, sodium: 230, unit: '500ml' },
          { id: 3, name: 'Electrolyte Tab', carbs: 0, fluid: 500, sodium: 500, unit: 'tab' }
        ];
      }
    } catch (e) {
      console.error('Error loading products:', e);
    }
    return [
      { id: 1, name: 'Energy Gel', carbs: 22, fluid: 30, sodium: 40, unit: 'pack' },
      { id: 2, name: 'Sports Drink', carbs: 14, fluid: 500, sodium: 230, unit: '500ml' },
      { id: 3, name: 'Electrolyte Tab', carbs: 0, fluid: 500, sodium: 500, unit: 'tab' }
    ];
  });
  
  const [productCounts, setProductCounts] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('race_product_counts');
        return saved ? JSON.parse(saved) : {};
      }
    } catch (e) {
      console.error('Error loading product counts:', e);
    }
    return {};
  });

  // Persist dark mode to class on <html>
  useEffect(()=>{
    const root = document.documentElement;
    if(dark) root.classList.add("dark"); else root.classList.remove("dark");
  },[dark]);
  
  // Persist products to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('race_products', JSON.stringify(products));
      }
    } catch (e) {
      console.error('Error saving products:', e);
    }
  }, [products]);
  
  // Persist product counts to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && Object.keys(productCounts).length > 0) {
        localStorage.setItem('race_product_counts', JSON.stringify(productCounts));
      }
    } catch (e) {
      console.error('Error saving product counts:', e);
    }
  }, [productCounts]);

  // Check premium status from user metadata and sync with Stripe
  useEffect(() => {
    const isUserPremium = checkPremium();
    setIsPremium(isUserPremium);
    
    // Check subscription status with Stripe on load
    const checkSubscription = async () => {
      const user = currentUser();
      if (!user) return;
      
      try {
        const token = await user.jwt();
        await fetch('/.netlify/functions/check-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: user.email, userId: user.id }),
        });
        // Update premium status after sync
        setIsPremium(checkPremium());
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };
    
    checkSubscription();
    
    // Listen for Identity events to update premium status
    // @ts-ignore
    window.netlifyIdentity?.on('login', async () => {
      setIsPremium(checkPremium());
      // Re-check subscription after login
      await checkSubscription();
      setIsPremium(checkPremium());
    });
    // @ts-ignore
    window.netlifyIdentity?.on('logout', () => setIsPremium(false));
  }, []);
  

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
  const [showRaceHelp, setShowRaceHelp] = useState(false);
  const [showDailyHelp, setShowDailyHelp] = useState(false);
  const [showTrainingHelp, setShowTrainingHelp] = useState(false);
  const [showHydrationHelp, setShowHydrationHelp] = useState(false);
  const [showCoachHelp, setShowCoachHelp] = useState(false);
  const [showReportsHelp, setShowReportsHelp] = useState(false);
  
  // Race Week states
  const [raceEvent, setRaceEvent] = useState('Marathon');
  const [raceDate, setRaceDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  });
  const [raceGoalHours, setRaceGoalHours] = useState(3);
  const [raceGoalMins, setRaceGoalMins] = useState(30);
  const [raceLocation, setRaceLocation] = useState('');
  const [raceWeather, setRaceWeather] = useState(null);
  const [loadingRaceWeather, setLoadingRaceWeather] = useState(false);
  const [fuelStrategy, setFuelStrategy] = useState('optimal'); // aggressive, optimal, safe
  
  // Race-specific hydration settings
  const [raceSweatCategory, setRaceSweatCategory] = useState('Medium'); // Low / Medium / High / Very High
  const [raceSaltinessCategory, setRaceSaltinessCategory] = useState('Medium'); // Low / Medium / High / Very High
  const [raceHeatAcclimation, setRaceHeatAcclimation] = useState('Not acclimated'); // Not acclimated / Partial / Well
  
  // Custom product specifications
  const [gelCarbs, setGelCarbs] = useState(22);
  const [gelSodium, setGelSodium] = useState(40);
  const [drinkCarbs, setDrinkCarbs] = useState(14);
  const [drinkSodium, setDrinkSodium] = useState(230);
  const [tabSodium, setTabSodium] = useState(500);
  
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
  const totalSweatLossMg = useMemo(() => {
    const hours = sessionMin / 60;
    return Math.round(sweatNaLossPerHr * hours);
  }, [sweatNaLossPerHr, sessionMin]);
  const sodiumLowerReplace = useMemo(() => Math.round(totalSweatLossMg * 0.4), [totalSweatLossMg]);
  const sodiumUpperReplace = useMemo(() => Math.round(totalSweatLossMg * 0.7), [totalSweatLossMg]);
  // Keep recSodiumPerHr for compatibility with drink concentration calculations
  const recSodiumPerHr = useMemo(() => Math.round(sweatNaLossPerHr * 0.7), [sweatNaLossPerHr]); // 70% replacement
  const totalSodiumMg = useMemo(() => sodiumUpperReplace, [sodiumUpperReplace]); // Use upper range as target
  
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
        
        
        const totalSweatLossMg = Math.round(trainingHours * hydration.sodiumPerHour);
        const sodiumLowerReplace = Math.round(totalSweatLossMg * 0.4);
        const sodiumUpperReplace = Math.round(totalSweatLossMg * 0.7);
        
        sessions.push({
          type: session.type,
          duration: session.duration,
          timeOfDay,
          temp: Math.round(weatherTemp),
          humidity: weatherHumidity,
          fluidPerHour: hydration.fluidPerHour,
          totalFluid: Math.round(trainingHours * hydration.fluidPerHour),
          sodiumPerHour: hydration.sodiumPerHour,
          totalSweatLossMg: totalSweatLossMg,
          sodiumLowerReplace: sodiumLowerReplace,
          sodiumUpperReplace: sodiumUpperReplace,
          totalSodium: sodiumUpperReplace // Use upper range for display compatibility
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
        
        const totalSweatLossMg2 = Math.round(trainingHours * hydration.sodiumPerHour);
        const sodiumLowerReplace2 = Math.round(totalSweatLossMg2 * 0.4);
        const sodiumUpperReplace2 = Math.round(totalSweatLossMg2 * 0.7);
        
        sessions.push({
          type: session.secondSession.type,
          duration: session.secondSession.duration,
          timeOfDay,
          temp: Math.round(weatherTemp),
          humidity: weatherHumidity,
          fluidPerHour: hydration.fluidPerHour,
          totalFluid: Math.round(trainingHours * hydration.fluidPerHour),
          sodiumPerHour: hydration.sodiumPerHour,
          totalSweatLossMg: totalSweatLossMg2,
          sodiumLowerReplace: sodiumLowerReplace2,
          sodiumUpperReplace: sodiumUpperReplace2,
          totalSodium: sodiumUpperReplace2 // Use upper range for display compatibility
        });
      }
      
      // Calculate totals
      const totalTrainingFluid = sessions.reduce((sum, s) => sum + s.totalFluid, 0);
      const totalTrainingSodium = sessions.reduce((sum, s) => sum + s.totalSodium, 0);
      const totalTrainingSweatLossMg = sessions.reduce((sum, s) => sum + (s.totalSweatLossMg || 0), 0);
      const totalTrainingLowerReplace = sessions.reduce((sum, s) => sum + (s.sodiumLowerReplace || 0), 0);
      const totalTrainingUpperReplace = sessions.reduce((sum, s) => sum + (s.sodiumUpperReplace || 0), 0);
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
        totalTrainingSweatLossMg,
        totalTrainingLowerReplace,
        totalTrainingUpperReplace,
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

  // Race Week Calculations
  const calculateRaceCalories = (eventType, goalTimeHours, goalTimeMins) => {
    const totalMinutes = goalTimeHours * 60 + goalTimeMins;
    const totalHours = totalMinutes / 60;
    
    // More accurate calorie burn calculation based on metabolic equivalents (METs)
    // Average MET values: 5km=9, 10km=10, Half=11, Marathon=12, Ironman=14
    const metValues = {
      '5km': 9,
      '10km': 10,
      'Half Marathon': 11,
      'Marathon': 12,
      'Ironman 70.3': 13,
      'Ironman': 14
    };
    
    const met = metValues[eventType] || 12;
    // MET calculation: METs × weight (kg) × hours = kcal burned during exercise
    const raceCalories = Math.round(met * weightKg * totalHours);
    
    // Base metabolic rate for race day (24 hours)
    const baseCalories = Math.round(weightKg * 24); // Resting metabolism for the day
    
    return {
      raceCalories: raceCalories,
      totalCalories: baseCalories + raceCalories,
      carbsNeeded: Math.round(raceCalories * 0.15 / 4), // 15% of race cals from carbs during event
      proteinNeeded: Math.round(weightKg * 1.8),
      fatNeeded: Math.round(weightKg * 1.2)
    };
  };

  const fetchRaceWeather = async (city) => {
    if (!city) return;
    setLoadingRaceWeather(true);
    try {
      // Use utility functions that handle both dev and prod environments
      const [currentData, forecastData] = await Promise.all([
        fetchWeatherByCity(city),
        (async () => {
          try {
            const url = import.meta.env.PROD
              ? `/.netlify/functions/weather?path=forecast.json&q=${encodeURIComponent(city)}&days=14&aqi=no`
              : `/api/weather/forecast.json?q=${encodeURIComponent(city)}&days=14&aqi=no`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Forecast fetch failed');
            return await response.json();
          } catch (error) {
            console.error('Forecast fetch error:', error);
            return null;
          }
        })()
      ]);
      
      // Find forecasted weather for race date
      const raceDay = new Date(raceDate);
      const raceDayStr = raceDay.toISOString().split('T')[0];
      let forecastedWeather = null;
      
      if (forecastData?.forecast?.forecastday) {
        forecastedWeather = forecastData.forecast.forecastday.find(
          day => day.date === raceDayStr
        );
      }
      
      if (forecastedWeather) {
        setRaceWeather({
          temp: forecastedWeather.day.avgtemp_c,
          maxTemp: forecastedWeather.day.maxtemp_c,
          humidity: forecastedWeather.day.avghumidity,
          condition: forecastedWeather.day.condition.text,
          icon: forecastedWeather.day.condition.icon
        });
      } else if (currentData) {
        setRaceWeather({
          temp: currentData.temp,
          maxTemp: currentData.temp,
          humidity: currentData.humidity,
          condition: currentData.description,
          icon: currentData.icon
        });
      } else {
        setRaceWeather(null);
      }
    } catch (error) {
      console.error('Race weather error:', error);
      setRaceWeather(null);
    } finally {
      setLoadingRaceWeather(false);
    }
  };

  const getCarbLoadingPlan = (eventType) => {
    const plans = {
      '5km': { days: 0, carbs: [], description: 'No special carb loading needed' },
      '10km': { days: 1, carbs: [8], description: '1 day moderate carb load' },
      'Half Marathon': { days: 2, carbs: [7, 8], description: '2 day progressive carb load' },
      'Marathon': { days: 3, carbs: [6, 8, 10], description: '3 day progressive carb load' },
      'Ironman 70.3': { days: 3, carbs: [6, 8, 10], description: '3 day progressive carb load' },
      'Ironman': { days: 4, carbs: [5, 7, 9, 10], description: '4 day progressive carb load' }
    };
    return plans[eventType] || plans['Marathon'];
  };
  
  // Calculate race nutrition targets (will be inlined in useMemo)
  const calculateRaceTargets = (timeline) => {
    if (!timeline || timeline.length === 0) return { carbs: 0, fluid: 0, sodium: 0 };
    
    const totalCarbs = timeline.reduce((sum, item) => {
      const carbs = item.carbs.replace('g', '');
      return sum + (parseInt(carbs) || 0);
    }, 0);
    const totalFluid = timeline.reduce((sum, item) => {
      const fluid = item.fluid.replace('ml', '');
      return sum + (parseInt(fluid) || 0);
    }, 0);
    const totalSodium = timeline.reduce((sum, item) => {
      const sodium = item.sodium.replace('mg', '');
      return sum + (parseInt(sodium) || 0);
    }, 0);
    
    return { carbs: totalCarbs, fluid: totalFluid, sodium: totalSodium };
  };
  
  // Solver: Find optimal product combinations to meet targets
  const solveProductMix = (targets, availableProducts) => {
    if (!targets || targets.carbs === 0) return {};
    
    const weights = { carbs: 1.0, fluid: 0.8, sodium: 1.2, units: 0.1 };
    const maxUnits = 30; // Reasonable max for search space
    let bestSolution = {};
    let bestError = Infinity;
    
    // Helper: Calculate error for a solution
    const calcError = (counts) => {
      let totalCarbs = 0, totalFluid = 0, totalSodium = 0, totalUnits = 0;
      
      availableProducts.forEach(p => {
        const count = counts[p.id] || 0;
        totalCarbs += p.carbs * count;
        totalFluid += p.fluid * count;
        totalSodium += p.sodium * count;
        totalUnits += count;
      });
      
      const carbErr = Math.abs(targets.carbs - totalCarbs) / Math.max(targets.carbs, 1);
      const fluidErr = Math.abs(targets.fluid - totalFluid) / Math.max(targets.fluid, 1);
      const sodiumErr = Math.abs(targets.sodium - totalSodium) / Math.max(targets.sodium, 1);
      const unitsPenalty = totalUnits / maxUnits;
      
      return weights.carbs * carbErr + weights.fluid * fluidErr + weights.sodium * sodiumErr + weights.units * unitsPenalty;
    };
    
    // Greedy heuristic fallback
    const greedySolve = () => {
      const counts = {};
      let remainingCarbs = targets.carbs;
      let remainingFluid = targets.fluid;
      let remainingSodium = targets.sodium;
      
      // Sort products by efficiency (carbs + fluid + sodium per unit)
      const sorted = [...availableProducts].sort((a, b) => {
        const aValue = a.carbs * 2 + a.fluid / 100 + a.sodium / 50;
        const bValue = b.carbs * 2 + b.fluid / 100 + b.sodium / 50;
        return bValue - aValue;
      });
      
      sorted.forEach(p => {
        let count = 0;
        const maxCount = Math.ceil(Math.max(
          remainingCarbs / (p.carbs || 1),
          remainingFluid / (p.fluid || 1),
          remainingSodium / (p.sodium || 1)
        ));
        
        // Try to add this product
        for (let c = 0; c <= maxCount; c++) {
          const testCounts = { ...counts, [p.id]: c };
          const err = calcError(testCounts);
          if (err < bestError) {
            count = c;
            bestError = err;
          }
        }
        
        if (count > 0) {
          counts[p.id] = count;
          remainingCarbs -= p.carbs * count;
          remainingFluid -= p.fluid * count;
          remainingSodium -= p.sodium * count;
        }
      });
      
      return counts;
    };
    
    // Use greedy heuristic
    return greedySolve();
  };

  // Race day hydration calculations (using race-specific settings)
  const calculateRaceDayHydration = () => {
    if (!raceWeather) return null;
    
    const temp = raceWeather.temp;
    const humidity = raceWeather.humidity || 50;
    const totalMinutes = raceGoalHours * 60 + raceGoalMins;
    const hours = totalMinutes / 60;
    
    // Calculate effective sweat rate based on intensity
    const intensityMultiplier = raceEvent.includes('Ironman') ? 1.15 : 
                               raceEvent === 'Marathon' ? 1.10 : 
                               raceEvent === 'Half Marathon' ? 1.05 : 1.0;
    
    // Baseline sweat rate from race-specific settings
    const baselineSweatRate = raceSweatCategory === 'Low' ? 0.7 :
                              raceSweatCategory === 'Medium' ? 1.2 :
                              raceSweatCategory === 'High' ? 1.7 : 2.3;
    
    // Temperature multiplier
    let tempMult = 1.0;
    if (temp <= 15) tempMult = 0.85;
    else if (temp >= 35) tempMult = 1.40;
    else if (temp >= 29) tempMult = 1.25;
    else if (temp >= 23) tempMult = 1.10;
    else tempMult = 1.00;
    
    const effectiveSweatRate = baselineSweatRate * intensityMultiplier * tempMult;
    
    // Fluid needs (70% replacement strategy)
    const fluidMlPerHour = Math.round(effectiveSweatRate * 1000 * 0.7);
    const totalFluidMl = Math.round(fluidMlPerHour * hours);
    
    // Sodium needs (using race-specific saltiness category)
    const baselineNaPerL = raceSaltinessCategory === 'Low' ? 500 :
                          raceSaltinessCategory === 'Medium' ? 900 :
                          raceSaltinessCategory === 'High' ? 1300 : 1800;
    
    const intensityNaMult = raceEvent.includes('Ironman') ? 1.20 :
                            raceEvent === 'Marathon' ? 1.10 :
                            raceEvent === 'Half Marathon' ? 1.05 : 1.0;
    
    const acclimationMult = raceHeatAcclimation === 'Not acclimated' ? 1.00 :
                           raceHeatAcclimation.includes('Partial') ? 0.85 : 0.70;
    
    const effectiveNa = baselineNaPerL * intensityNaMult * acclimationMult;
    const sodiumPerHour = Math.round(effectiveSweatRate * effectiveNa);
    const totalSweatLossMg = Math.round(sodiumPerHour * hours);
    const sodiumLowerReplace = Math.round(totalSweatLossMg * 0.4);
    const sodiumUpperReplace = Math.round(totalSweatLossMg * 0.7);
    
    return {
      fluidPerHour: fluidMlPerHour,
      totalFluidMl: totalFluidMl,
      sodiumPerHour: sodiumPerHour,
      totalSweatLossMg: totalSweatLossMg,
      sodiumLowerReplace: sodiumLowerReplace,
      sodiumUpperReplace: sodiumUpperReplace,
      totalSodiumMg: sodiumUpperReplace, // Use upper range as target for compatibility
      effectiveSweatRate: effectiveSweatRate.toFixed(2)
    };
  };

  // Generate race fueling timeline with strategy and weather awareness
  const generateRaceTimeline = () => {
    const totalMinutes = raceGoalHours * 60 + raceGoalMins;
    const totalHours = totalMinutes / 60;
    const timeline = [];
    
    // Fuel strategy multipliers
    const strategyMultiplier = {
      aggressive: 1.3,  // 30% more than optimal
      optimal: 1.0,     // Standard
      safe: 0.7         // 30% less (backoff)
    };
    
    const multiplier = strategyMultiplier[fuelStrategy];
    
    // Use the actual carbsNeeded from race calories calculation
    const raceCalories = calculateRaceCalories(raceEvent, raceGoalHours, raceGoalMins);
    const baseCarbsNeeded = raceCalories.carbsNeeded;
    const totalCarbsNeeded = Math.round(baseCarbsNeeded * multiplier);
    
    // Determine time bucket intervals and carb distribution
    const timeBucket = totalHours < 4 ? 30 : 60; // 30min for <4hr races, 60min for >=4hr races
    const buckets = Math.ceil(totalMinutes / timeBucket);
    
    // Calculate carbs per interval based on actual needs
    const effectiveIntervals = buckets - 1; // Exclude start at 0min
    const carbsPerInterval = Math.round(totalCarbsNeeded / effectiveIntervals);
    
    // Distribute carbs across buckets
    const carbDistribution = [];
    for (let i = 0; i < buckets; i++) {
      if (i === 0) {
        carbDistribution.push(0); // Start with no carbs
      } else {
        carbDistribution.push(carbsPerInterval);
      }
    }
    
    // Adjust if total doesn't match target
    const currentTotal = carbDistribution.reduce((sum, val) => sum + val, 0);
    const diff = totalCarbsNeeded - currentTotal;
    if (diff !== 0) {
      // Distribute the difference across middle buckets
      const middleStart = Math.floor(buckets / 3);
      const middleEnd = Math.ceil(buckets * 2 / 3);
      for (let i = middleStart; i < middleEnd && i < buckets; i++) {
        carbDistribution[i] += Math.round(diff / (middleEnd - middleStart));
      }
    }
    
    // Weather impact on hydration
    const weatherImpact = raceWeather ? (raceWeather.temp > 25 ? 1.2 : raceWeather.temp < 15 ? 0.9 : 1.0) : 1.0;
    
    // Calculate sodium needs from race hydration
    const hydrationInfo = calculateRaceDayHydration();
    // Use replacement range (40-70% of loss) - calculate mid-range per interval
    const sodiumReplacePerMin = hydrationInfo ? (hydrationInfo.sodiumPerHour * 0.55 / 60) : 0; // 55% = mid-range
    
    // Calculate fluid per bucket
    const totalFluidNeeded = hydrationInfo ? hydrationInfo.totalFluidMl : 0;
    const fluidPerBucket = Math.round(totalFluidNeeded / buckets);
    
    // Generate timeline entries
    for (let i = 0; i < buckets; i++) {
      const time = i * timeBucket;
      
      if (time > totalMinutes) break;
      
      const carbs = carbDistribution[i] || 0;
      const fluid = Math.round(fluidPerBucket * weatherImpact * multiplier);
      // Sodium per interval uses replacement range (scaled with strategy)
      const sodium = Math.round(sodiumReplacePerMin * timeBucket * multiplier);
      
      let label = '';
      let notes = '';
      
      if (time === 0) {
        label = 'Race Start';
        notes = 'Light start, no carbs - hydrate well';
      } else if (time >= totalMinutes - timeBucket) {
        label = totalHours < 4 ? 'Near Finish' : 'Final Hour';
        notes = 'Reduce intake, focus on hydration';
      } else {
        if (totalHours < 4) {
          label = `${time}min`;
        } else {
          label = `Hour ${Math.floor(time / 60) + 1}`;
        }
        notes = 'Consistent fueling';
      }
      
      timeline.push({
        time: time,
        label: label,
        carbs: `${carbs}g`,
        fluid: `${fluid}ml`,
        sodium: `${sodium}mg`,
        notes: notes
      });
    }
    
    // Add finish line entry
    timeline.push({
      time: totalMinutes,
      label: 'Finish Line',
      carbs: '0',
      fluid: '0',
      sodium: '0',
      notes: 'Immediate recovery: 1.2g/kg carbs + 0.3g/kg protein within 30 min!'
    });
    
    return timeline;
  };

  const raceCalories = calculateRaceCalories(raceEvent, raceGoalHours, raceGoalMins);
  const carbPlan = getCarbLoadingPlan(raceEvent);
  const raceHydration = calculateRaceDayHydration();
  const raceTimeline = generateRaceTimeline();
  const totalMinutes = raceGoalHours * 60 + raceGoalMins;
  const totalHours = totalMinutes / 60;
  
  // Calculate strategy-adjusted carbs needed to match timeline
  const strategyMultiplier = {
    aggressive: 1.3,
    optimal: 1.0,
    safe: 0.7
  };
  const adjustedCarbsNeeded = Math.round(raceCalories.carbsNeeded * strategyMultiplier[fuelStrategy]);
  
  // Compute race targets and solver solution
  const raceTargets = useMemo(() => calculateRaceTargets(raceTimeline), [raceTimeline]);
  const optimalCounts = useMemo(() => {
    if (!raceTimeline || raceTimeline.length === 0) return {};
    return solveProductMix(raceTargets, products);
  }, [raceTargets, products]);
  
  // Calculate actual values from product counts
  const planValues = useMemo(() => {
    let actualCarbs = 0, actualFluid = 0, actualSodium = 0;
    products.forEach(p => {
      const count = productCounts[p.id] || 0;
      actualCarbs += p.carbs * count;
      actualFluid += p.fluid * count;
      actualSodium += p.sodium * count;
    });
    return { carbs: actualCarbs, fluid: actualFluid, sodium: actualSodium };
  }, [products, productCounts]);
  
  // Calculate days before race for calendar
  const getDaysBeforeRace = () => {
    const today = new Date();
    const race = new Date(raceDate);
    const diffTime = race - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysBeforeRace = getDaysBeforeRace();
  const carbLoadingDays = Array.from({ length: 7 }, (_, i) => {
    const daysOut = 7 - i;
    const carbLoadDay = carbPlan.days >= daysOut;
    
    // Map days out to day names (counting backwards from race day)
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayName = dayNames[(i + 1) % 7]; // +1 because race day is day 1
    
    // Get training data for this day
    const session = weeklySessions[dayName];
    const hasTraining = session && session.duration > 0;
    const trainingCalories = hasTraining ? calculateSessionCalories(weightKg, session.duration, session.type, session.intensity) : 0;
    
    // Calculate base carbs (resting needs based on activity and training)
    let baseCarbsG = Math.round(weightKg * 5); // Base normal training carbs
    
    // Add carbs for training if there's a session
    if (hasTraining && session) {
      // Add training-related carbs based on intensity and duration
      const trainingCarbsMultiplier = session.intensity === 'vo2max' ? 0.8 : 
                                     session.intensity === 'threshold' ? 0.6 : 
                                     0.4; // aerobic
      const trainingCarbs = Math.round(trainingCalories * trainingCarbsMultiplier / 4); // 4 kcal per gram carb
      baseCarbsG += trainingCarbs;
    }
    
    // Calculate carb loading additions (NOT on race day - daysOut === 1 is race day)
    let carbLoadCarbsG = 0;
    if (carbLoadDay && daysOut > 1) { // Can carb load until day 2+, NOT on day 1 (race day) or day 0 (day before race shown as day 1)
      const carbsIndex = carbPlan.days - daysOut;
      if (carbsIndex >= 0 && carbsIndex < carbPlan.carbs.length) {
        carbLoadCarbsG = Math.round((carbPlan.carbs[carbsIndex] - 5) * weightKg); // Extra on top of base
      }
    }
    
    // Total carbs for the day
    const totalCarbsG = baseCarbsG + carbLoadCarbsG;
    
    // Calculate total calories: resting + training
    const restingCalories = nonTraining;
    const totalCalories = restingCalories + trainingCalories;
    
    // Calculate protein based on training (higher if strength or intense training)
    const baseProteinG = Math.round(weightKg * 1.8);
    let proteinG = baseProteinG;
    if (hasTraining && session) {
      if (session.type === 'strength') {
        proteinG = Math.round(weightKg * 2.2); // Extra for strength
      } else if (session.intensity === 'vo2max' || session.intensity === 'threshold') {
        proteinG = Math.round(weightKg * 2.0); // Moderate extra for intense training
      }
    }
    
    // Calculate fat (inverse relationship with carbs)
    const baseFatG = Math.round(weightKg * 1.2);
    let fatG = baseFatG;
    if (totalCarbsG > Math.round(weightKg * 7)) {
      // If very high carbs, slightly reduce fat
      fatG = Math.round(weightKg * 1.0);
    }
    
    return {
      dayNumber: daysOut,
      daysOut: daysOut,
      dayName: dayName,
      carbsG: totalCarbsG,
      baseCarbsG: baseCarbsG,
      carbLoadCarbsG: carbLoadCarbsG,
      proteinG: proteinG,
      fatG: fatG,
      isCarbLoading: carbLoadDay && daysOut > 1, // Show as carb loading on days 3+ before race (not day 1 = race day)
      isFiberCaution: daysOut <= 2,
      isRaceDay: daysOut === 1,
      hasTraining: hasTraining,
      trainingCalories: trainingCalories,
      restingCalories: restingCalories,
      totalCalories: totalCalories,
      session: session
    };
  });

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-[#1A1A1E] text-[#FFFFFF]">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#1A1A1E]/95 border-b border-[#2A2A35] print:hidden shadow-elevated">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Nutrition Planner Logo" 
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-card shadow-soft object-contain bg-[#24242A] p-1"
              />
              <div>
                <div className="text-lg sm:text-xl font-bold leading-tight text-[#FFCE34]">Nutrition Planner</div>
                <div className="text-xs sm:text-sm text-[#A9A9B8]">Running fuel calculator</div>
              </div>
            </div>
            
            {/* Login/Logout Button */}
            <div>
              {currentUser() ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-[#A9A9B8] hidden sm:inline">
                    {currentUser()?.email}
                  </span>
                  <button
                    onClick={() => {
                      // @ts-ignore
                      window.netlifyIdentity?.logout();
                    }}
                    className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium bg-[#2A2A35] text-[#A9A9B8] rounded-card border border-[#2A2A35] hover:bg-[#3A3A45] hover:text-white transition-all"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    // @ts-ignore
                    if (!window.netlifyIdentity) {
                      alert('Netlify Identity is not loaded. Please check your configuration and ensure it is enabled in Netlify.');
                      console.error('Netlify Identity is not available');
                      return;
                    }
                    // @ts-ignore
                    window.netlifyIdentity.open('login');
                  }}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-[#FFCE34] text-[#1A1A1E] rounded-card border border-[#FFCE34] hover:bg-[#FFD84D] font-bold transition-all"
                >
                  Login / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 sm:pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              {id:"daily",label:"Daily", icon:"📊", premium:false},
              {id:"traininglog",label:"Training", icon:"🏃", premium:true},
              {id:"race",label:"Race Week", icon:"🏁", premium:true},
              {id:"hydration",label:"Hydration", icon:"💧", premium:true},
              {id:"coach",label:"Coach", icon:"💡", premium:true},
              {id:"reports",label:"Reports", icon:"📈", premium:true},
            ].filter(t => t.id === 'daily' || isPremium || !t.premium).map(t => (
              <button 
                key={t.id} 
                onClick={()=>setTab(t.id)} 
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all rounded-card border-2 ${
                  tab===t.id
                    ? "bg-[#FFCE34] text-[#1A1A1E] border-[#FFCE34] shadow-soft font-bold" 
                    : "bg-[#24242A] text-[#A9A9B8] border-[#2A2A35] hover:bg-[#2A2A35] hover:text-[#FFFFFF]"
                }`}
              >
                <span className="hidden sm:inline">{t.icon} </span>{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 print:px-8">
        <AnimatePresence mode="wait">
          {tab === "daily" && (
            <motion.div key="daily" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}}>
              {/* Help Modal */}
              {showDailyHelp && (
                <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Daily Nutrition</h3>
                    <button
                      onClick={() => setShowDailyHelp(false)}
                      className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                    <div>
                      <strong className="text-[#FFCE34]">1️⃣ Athlete Information:</strong>
                      <p>Enter your sex, age, weight, height, and sweat rate category. This calculates your Basal Metabolic Rate (BMR) and daily calorie needs.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">2️⃣ Activity Level:</strong>
                      <p>Select your non-training activity level: Sedentary, Light, Moderate, or Very Active. This affects your daily calorie burn.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">3️⃣ Macro Targets:</strong>
                      <p>Set your carbohydrate, protein, and fat targets in grams per kilogram of body weight. These are your daily nutrition goals.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">4️⃣ Daily Summary:</strong>
                      <p>View your calculated daily calories, macros breakdown, and hydration targets based on your inputs.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">5️⃣ Upgrade to Premium:</strong>
                      <p>Access advanced features like Training Log, Race Week planning, Hydration analysis, Coach Reports, and more.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Inputs */}
              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <Card>
                  <div className="flex items-start justify-between mb-4">
                    <SectionTitle title="Athlete" subtitle="Basics for BMR and per-kg macros" />
                    <button
                      onClick={() => setShowDailyHelp(!showDailyHelp)}
                      className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all text-sm font-bold flex-shrink-0"
                      aria-label="Help"
                    >
                      ?
                    </button>
                  </div>
                  <div className="space-y-4">
                    <InputRow label="Sex">
                      <div className="flex gap-2">
                        {["male","female"].map(s=>(
                          <button 
                            key={s} 
                            onClick={()=>setSex(s)} 
                            className={`px-4 py-2 rounded-card border text-sm font-medium transition-all ${
                              sex===s
                                ? "bg-blue-600 border-blue-500 text-white shadow-lg font-bold" 
                                : "bg-[#24242A] text-[#FFFFFF] border-[#2A2A35] hover:bg-[#2A2A35]"
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
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-sm text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                        value={sweatCategory}
                        onChange={(e) => setSweatCategory(e.target.value)}
                        style={{ color: '#FFFFFF' }}
                      >
                        <option value="Low" style={{ background: '#24242A', color: '#FFFFFF' }}>Low (0.7 L/hr)</option>
                        <option value="Medium" style={{ background: '#24242A', color: '#FFFFFF' }}>Medium (1.2 L/hr)</option>
                        <option value="High" style={{ background: '#24242A', color: '#FFFFFF' }}>High (1.7 L/hr)</option>
                        <option value="Very High" style={{ background: '#24242A', color: '#FFFFFF' }}>Very High (2.3 L/hr)</option>
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
                    <div className="text-xs text-[#A9A9B8] -mt-2">Sedentary ~1.3, active job ~1.6. Double sessions add +150 kcal/day.</div>
                    <InputRow label="Day Type">
                      <div className="flex gap-2 flex-wrap">
                        {[{id:"key",label:"Key"},{id:"normal",label:"Normal"},{id:"recovery",label:"Recovery"}].map(d=> (
                          <button 
                            key={d.id} 
                            onClick={()=>setDayType(d.id)} 
                            className={`px-4 py-2 rounded-card border text-sm font-medium transition-all ${
                              dayType===d.id
                                ? "bg-[#FFCE34] text-white shadow-sm" 
                                : "bg-[#24242A] text-[#FFFFFF] border-[#2A2A35] hover:bg-[#2A2A35]"
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
                            className={`px-4 py-2 rounded-card border text-sm font-medium transition-all ${
                              goal===g.id
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm" 
                                : "bg-[#24242A] text-[#FFFFFF] border-[#2A2A35] hover:bg-[#2A2A35]"
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
                    <p className="text-xs text-[#A9A9B8]">Protein held constant; carbs/fats scale if macros exceed daily kcal.</p>
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
                      <KV big label="Target calories (today) - Averaged daily for exercise program" value={`${targetCalories} kcal`} />
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.1}}>
                  <Card>
                    <SectionTitle title="Macros (targets)" />
                    <div className="text-sm space-y-1">
                      <div className="mb-2 p-2 bg-[#24242A] rounded-lg">
                        <div className="text-xs text-[#A9A9B8] mb-1">Training Load Multiplier</div>
                        <div className="text-lg font-bold text-[#FFCE34]">
                          {trainingLoadMultiplier.toFixed(2)}x
                        </div>
                        <div className="text-xs text-[#A9A9B8]">
                          {trainingLoadMultiplier < 1.1 ? "Light" : trainingLoadMultiplier < 1.2 ? "Moderate" : "Heavy"} training load
                        </div>
                      </div>
                      <KV label="Carbohydrate" value={`${carbGFinal} g (${carbKcal} kcal)`} />
                      <KV label="Protein" value={`${proteinGFinal} g (${proteinKcalFinal} kcal)`} />
                      <KV label="Fat" value={`${fatGFinal} g (${fatKcalFinal} kcal)`} />
                      <hr className="my-2" />
                      <KV label="Total macro kcal" value={`${carbKcal + proteinKcalFinal + fatKcalFinal} kcal`} />
                      <div className="text-xs text-[#A9A9B8] mt-2">
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
                    <SectionTitle title="Example Menu (scales with your calories)" />
                    {(() => {
                      // Use actual target macros
                      const targetMacroCalories = Math.round(targetCalories * 0.95);
                      const targetCals = targetMacroCalories;
                      const targetCarbs = carbGFinal;
                      const targetProtein = proteinGFinal;
                      const targetFat = fatGFinal;
                      
                      // Calculate scaling factor based on target calories (base is 2500 kcal)
                      const baseCalories = 2500;
                      const scaleFactor = targetCalories / baseCalories;
                      const scale = (val) => Math.round(val * scaleFactor);
                      
                      // Approximate macros for each meal (scaled)
                      const meals = [
                        {title:"Breakfast (Pre-Run)",items:[`Oats (${scale(80)} g) + milk`,`Banana + honey`,`Whey protein (${scale(25)} g)`],cals:scale(500),carbs:scale(65),protein:scale(30),fat:scale(12)},
                        {title:"Post-Run Snack",items:[`Greek yogurt (${scale(200)} g)`,`Berries`,`Granola (${scale(40)} g)`],cals:scale(400),carbs:scale(45),protein:scale(25),fat:scale(15)},
                        {title:"Lunch",items:[`Rice (${scale(200)} g cooked)`,`Chicken breast (${scale(180)} g)`,`Veg + olive oil`],cals:scale(650),carbs:scale(75),protein:scale(50),fat:scale(20)},
                        {title:"Snack",items:[`Banana`,`Peanut butter toast`,`Electrolyte drink`],cals:scale(350),carbs:scale(50),protein:scale(10),fat:scale(12)},
                        {title:"Dinner",items:[`Pasta (${scale(120)} g dry)`,`Lean beef (${scale(180)} g)`,`Tomato sauce`],cals:scale(700),carbs:scale(85),protein:scale(55),fat:scale(18)},
                        {title:"Evening Snack",items:[`Milk`,`Toast + nut butter`],cals:scale(300),carbs:scale(30),protein:scale(15),fat:scale(15)},
                      ];
                      
                      const totalMealCals = meals.reduce((sum, m) => sum + m.cals, 0);
                      const totalMealCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
                      const totalMealProtein = meals.reduce((sum, m) => sum + m.protein, 0);
                      const totalMealFat = meals.reduce((sum, m) => sum + m.fat, 0);
                      
                      // Scale the meal totals to match target macros exactly
                      const carbsScale = totalMealCarbs > 0 ? targetCarbs / totalMealCarbs : 1;
                      const proteinScale = totalMealProtein > 0 ? targetProtein / totalMealProtein : 1;
                      const fatScale = totalMealFat > 0 ? targetFat / totalMealFat : 1;
                      
                      // Adjust each meal's macros to match targets
                      const adjustedMeals = meals.map(m => ({
                        ...m,
                        carbs: Math.round(m.carbs * carbsScale),
                        protein: Math.round(m.protein * proteinScale),
                        fat: Math.round(m.fat * fatScale),
                        cals: Math.round(m.carbs * carbsScale * 4 + m.protein * proteinScale * 4 + m.fat * fatScale * 9)
                      }));
                      
                      const adjustedTotalCals = adjustedMeals.reduce((sum, m) => sum + m.cals, 0);
                      const adjustedTotalCarbs = adjustedMeals.reduce((sum, m) => sum + m.carbs, 0);
                      const adjustedTotalProtein = adjustedMeals.reduce((sum, m) => sum + m.protein, 0);
                      const adjustedTotalFat = adjustedMeals.reduce((sum, m) => sum + m.fat, 0);
                      
                      return (
                        <div className="space-y-3">
                          {adjustedMeals.map((m,i)=> (
                            <div key={i} className="border border-[#2A2A35] rounded-card p-3 sm:p-4 bg-[#2A2A35]">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-semibold text-[#FFFFFF]">{m.title}</div>
                                <div className="text-xs text-[#FFCE34] font-bold">{m.cals} kcal</div>
                              </div>
                              <ul className="list-disc pl-4 text-sm text-[#FFFFFF] space-y-1 mb-2">
                                {m.items.map((it,j)=>(<li key={j}>{it}</li>))}
                              </ul>
                              <div className="text-xs text-[#A9A9B8] border-t border-[#2A2A35] pt-2">
                                {m.carbs}g carbs • {m.protein}g protein • {m.fat}g fat
                              </div>
                            </div>
                          ))}
                          <div className="mt-4 pt-4 border-t-2 border-[#FFCE34] bg-[#2A2A35] rounded-lg p-4">
                            <div className="text-sm font-semibold text-[#FFCE34] mb-2">Total: {adjustedTotalCals} kcal</div>
                            <div className="text-xs text-[#FFFFFF] mb-1">
                              {adjustedTotalCarbs}g carbs • {adjustedTotalProtein}g protein • {adjustedTotalFat}g fat
                            </div>
                            <div className="text-[10px] text-[#A9A9B8] mt-2">
                              Target: {targetCarbs}g carbs • {targetProtein}g protein • {targetFat}g fat
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                </motion.div>

                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.25}}>
                  <Card>
                    <SectionTitle title="Guidelines" />
                    <ul className="list-disc pl-4 text-sm space-y-2 text-[#FFFFFF]">
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
                        className="px-4 py-2 rounded-card border border-[#2A2A35] bg-[#24242A] text-[#FFFFFF] text-sm font-medium hover:bg-[#2A2A35] transition-colors"
                      >
                        🔄 Reset All
                      </button>
                    </div>
                  </Card>
                  
                  {/* Upgrade to Premium Card */}
                  {!isPremium && (
                    <Card className="bg-[#24242A] border-2 border-[#FFCE34]">
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl sm:text-3xl">🚀</span>
                            <h2 className="text-xl sm:text-2xl font-bold text-[#FFFFFF]">Upgrade to Premium</h2>
                          </div>
                          <p className="text-sm sm:text-base text-[#FFFFFF] mb-4">Unlock advanced features to take your nutrition planning to the next level</p>
                          
                          <div className="grid sm:grid-cols-2 gap-3 mb-4">
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Training Tab:</strong> Detailed weekly training log with nutrition timing</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Race Week:</strong> Complete race nutrition planner with timeline</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Hydration:</strong> Advanced sodium calculator with weather</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Coach Reports:</strong> Weekly summaries and insights</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Product Library:</strong> Custom fueling solver & optimization</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-[#FFFFFF] break-words">
                              <span className="text-green-300 flex-shrink-0">✓</span>
                              <span><strong>Weather Integration:</strong> Race day climate adaptation</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-full md:w-auto flex flex-col gap-3">
                          <button
                            onClick={handleUpgrade}
                            className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-purple-600 text-white rounded-card font-bold text-base sm:text-lg hover:from-orange-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                          >
                            Upgrade Now
                          </button>
                          <button
                            onClick={handleUpgrade}
                            className="px-6 sm:px-8 py-2 sm:py-3 bg-[#24242A] text-[#FFFFFF] rounded-card font-semibold text-sm sm:text-base border-2 border-[#2A2A35] hover:bg-[#2A2A35] transition-all"
                          >
                            Try Premium Free
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}

          {tab === "race" && (
            <motion.div key="race" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              
              {/* Race Event Selection */}
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <SectionTitle title="🎯 Race Setup" subtitle="Select your event and set your goal" />
                  <button
                    onClick={() => setShowRaceHelp(!showRaceHelp)}
                    className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all"
                    aria-label="Help"
                  >
                    ?
                  </button>
                </div>
                
                {/* Help Modal */}
                {showRaceHelp && (
                  <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Race Week</h3>
                      <button
                        onClick={() => setShowRaceHelp(false)}
                        className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                      <div>
                        <strong className="text-[#FFCE34]">1️⃣ Race Setup:</strong>
                        <p>Select your race type, date, and goal time. The system calculates your calorie and carbohydrate needs.</p>
                      </div>
                      
                      <div>
                        <strong className="text-[#FFCE34]">2️⃣ Fueling Strategy:</strong>
                        <p>Choose your approach:</p>
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                          <li><strong>Aggressive:</strong> +30% carbs for maximum performance (experienced racers)</li>
                          <li><strong>Optimal:</strong> Balanced fueling for most athletes</li>
                          <li><strong>Safe:</strong> -30% carbs for sensitive stomachs (first-timers)</li>
                        </ul>
                      </div>
                      
                      <div>
                        <strong className="text-[#FFCE34]">3️⃣ Weather & Hydration:</strong>
                        <p>Enter your race location and fetch weather. Configure:</p>
                        <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                          <li><strong>Sweat Rate:</strong> How much you sweat (Low to Very High)</li>
                          <li><strong>Sodium Loss:</strong> How salty your sweat is (Low to Very High)</li>
                          <li><strong>Heat Acclimation:</strong> Your adaptation to heat affects sodium needs</li>
                        </ul>
                      </div>
                      
                      <div>
                        <strong className="text-[#FFCE34]">4️⃣ Race Day Timeline:</strong>
                        <p>See when to fuel with carbs, fluids, and sodium. Timeline splits into 30-min (races &lt;4hrs) or 60-min buckets (races ≥4hrs).</p>
                      </div>
                      
                      <div>
                        <strong className="text-[#FFCE34]">5️⃣ Fueling Planner:</strong>
                        <p>Use the Product Library to customize your fuel products, then click "Auto-Optimize Mix" to get quantities that meet your targets.</p>
                        <p className="mt-2">Targets vs Plan badges show how close you are to meeting your needs (green = good, orange = close, red = far off).</p>
                      </div>
                      
                      <div>
                        <strong className="text-[#FFCE34]">6️⃣ Carb Loading Calendar:</strong>
                        <p>See your 7-day carb loading plan leading up to race day. Avoid fiber-rich foods 2 days before your race.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label>Race Event</Label>
                    <select 
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={raceEvent}
                      onChange={(e) => setRaceEvent(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>5km</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>10km</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Half Marathon</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Marathon</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Ironman 70.3</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Ironman</option>
                    </select>
                  </div>
                  <div>
                    <Label>Race Date</Label>
                    <input 
                      type="date" 
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={raceDate}
                      onChange={(e) => setRaceDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Goal Time (hours)</Label>
                    <input 
                      type="number" 
                      min="0" 
                      max="24" 
                      value={raceGoalHours} 
                      onChange={(e) => setRaceGoalHours(Number(e.target.value))}
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                    />
                  </div>
                  <div>
                    <Label>Goal Time (minutes)</Label>
                    <input 
                      type="number" 
                      min="0" 
                      max="59" 
                      value={raceGoalMins} 
                      onChange={(e) => setRaceGoalMins(Number(e.target.value))}
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                    />
                  </div>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Race Location</Label>
                    <div className="flex gap-2 mt-1">
                      <input 
                        type="text" 
                        placeholder="Enter city (e.g., London, New York)"
                        className="flex-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                        value={raceLocation}
                        onChange={(e) => setRaceLocation(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && fetchRaceWeather(raceLocation)}
                      />
                      <button
                        onClick={() => fetchRaceWeather(raceLocation)}
                        disabled={loadingRaceWeather || !raceLocation}
                        className="px-4 py-2 bg-[#FFCE34] hover:bg-[#FFD966] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingRaceWeather ? '⏳' : '🌤️'}
                      </button>
                    </div>
                  </div>
                  
                  {raceWeather && (
                    <div className="bg-[#2A2A35] rounded-lg p-3 flex items-center gap-3">
                      <img src={raceWeather.icon} alt={raceWeather.condition} className="w-12 h-12" />
                      <div>
                        <div className="font-semibold text-[#FFFFFF]">{raceWeather.maxTemp}°C - {raceWeather.condition}</div>
                        <div className="text-sm text-[#A9A9B8]">Humidity: {raceWeather.humidity}%</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Race Calories Summary */}
                <div className="mt-4 p-4 bg-orange-950/40 rounded-lg border border-orange-800">
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm text-[#A9A9B8]">Estimated Race Calories</div>
                      <div className="text-2xl font-bold text-[#FFCE34]">{raceCalories.raceCalories} kcal</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#A9A9B8]">Carbs Required ({fuelStrategy})</div>
                      <div className="text-2xl font-bold text-[#FFCE34]">{adjustedCarbsNeeded} g</div>
                    </div>
                    <div>
                      <div className="text-sm text-[#A9A9B8]">Total Daily (Rest + Race)</div>
                      <div className="text-2xl font-bold text-[#FFCE34]">{raceCalories.totalCalories} kcal</div>
                    </div>
                  </div>
                </div>
              </Card>
              
              {/* Hydration Settings */}
              <Card>
                <SectionTitle title="💧 Hydration Settings" subtitle="Configure your sweat rate and sodium needs" />
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Sweat Rate</Label>
                    <select 
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={raceSweatCategory}
                      onChange={(e) => setRaceSweatCategory(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Low</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Medium</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>High</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Very High</option>
                    </select>
                    <div className="text-xs text-[#A9A9B8] mt-1">
                      {raceSweatCategory === 'Low' ? '0.7 L/hr' :
                       raceSweatCategory === 'Medium' ? '1.2 L/hr' :
                       raceSweatCategory === 'High' ? '1.7 L/hr' : '2.3 L/hr'}
                    </div>
                  </div>
                  <div>
                    <Label>Sodium Loss</Label>
                    <select 
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={raceSaltinessCategory}
                      onChange={(e) => setRaceSaltinessCategory(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Low</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Medium</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>High</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Very High</option>
                    </select>
                    <div className="text-xs text-[#A9A9B8] mt-1">
                      {raceSaltinessCategory === 'Low' ? '500 mg/L' :
                       raceSaltinessCategory === 'Medium' ? '900 mg/L' :
                       raceSaltinessCategory === 'High' ? '1300 mg/L' : '1800 mg/L'}
                    </div>
                  </div>
                  <div>
                    <Label>Heat Acclimation</Label>
                    <select 
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-lg px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={raceHeatAcclimation}
                      onChange={(e) => setRaceHeatAcclimation(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Not acclimated</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Partially acclimated</option>
                      <option style={{ background: '#24242A', color: '#FFFFFF' }}>Well acclimated</option>
                    </select>
                    <div className="text-xs text-[#A9A9B8] mt-1">
                      {raceHeatAcclimation === 'Not acclimated' ? '100% sodium' :
                       raceHeatAcclimation === 'Partially acclimated' ? '85% sodium' : '70% sodium'}
                      {raceHydration && (
                        <span className="ml-2 text-[#FFCE34]">
                          → Lost {raceHydration.totalSweatLossMg}mg / Replace {raceHydration.sodiumLowerReplace}–{raceHydration.sodiumUpperReplace}mg
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!raceWeather && (
                  <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800 rounded-lg">
                    <div className="text-sm text-amber-200">
                      ⚠️ Please enter a race location and fetch weather to calculate race day hydration and sodium needs.
                    </div>
                  </div>
                )}
              </Card>
              
              <Card>
                <SectionTitle title="📅 7-Day Race Week Calendar" subtitle={carbPlan.description} />
                <div className="space-y-3">
                  {carbLoadingDays.map(d => (
                    <motion.div 
                      key={d.dayNumber}
                      initial={{opacity:0,x:-10}}
                      animate={{opacity:1,x:0}}
                      transition={{delay:d.dayNumber*0.05}}
                      className={`border-2 rounded-card p-4 transition-all ${
                        d.isRaceDay 
                          ? 'border-orange-500 bg-orange-950/40 shadow-lg' 
                          : d.isCarbLoading 
                            ? 'border-orange-800 bg-orange-950/40'
                            : 'border-[#2A2A35] bg-[#24242A]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                            d.isRaceDay 
                              ? 'bg-[#FFCE34] text-white' 
                              : 'bg-[#2A2A35] text-[#FFFFFF]'
                          }`}>
                            {d.dayNumber}
                          </div>
                          <div>
                            <div className="font-bold text-[#FFFFFF]">
                              {d.isRaceDay ? '🏁 Race Day!' : `Day ${d.dayNumber} Before Race`}
                            </div>
                            <div className={`text-sm font-medium ${
                              d.isCarbLoading ? 'text-[#FFCE34]' : 'text-[#A9A9B8]'
                            }`}>
                              {d.isCarbLoading && '🔥 '}
                              {d.isCarbLoading ? 'Carb Loading Day' : 'Normal Training'}
                              {d.isFiberCaution && ' - ⚠️ Low Fiber'}
                            </div>
                            {d.hasTraining && d.session && (
                              <div className="text-xs text-blue-400 mt-1">
                                {d.session.duration} min {d.session.type} ({d.session.intensity})
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                          <div>
                            <div className="text-xs text-[#A9A9B8] mb-1">Carbohydrate</div>
                            <div className="text-lg font-bold text-[#FFCE34]">{d.carbsG} g</div>
                            {d.isRaceDay ? (
                              <div className="text-[10px] text-emerald-400">Ready! 🏁</div>
                            ) : d.carbLoadCarbsG > 0 ? (
                              <div className="text-[10px] text-orange-400">+{d.carbLoadCarbsG}g carb load</div>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-xs text-[#A9A9B8] mb-1">Protein</div>
                            <div className="text-lg font-bold text-[#FFFFFF]">{d.proteinG} g</div>
                            {d.hasTraining && d.proteinG > Math.round(weightKg * 1.8) && (
                              <div className="text-[10px] text-blue-400">+training</div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-[#A9A9B8] mb-1">Fat</div>
                            <div className="text-lg font-bold text-[#FFFFFF]">{d.fatG} g</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#A9A9B8] mb-1">Calories</div>
                            <div className="text-lg font-bold text-emerald-400">{d.totalCalories} kcal</div>
                            <div className="text-[10px] text-[#A9A9B8]">
                              Rest: {d.restingCalories} + Train: {d.trainingCalories}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tips for each day */}
                      {d.isCarbLoading && !d.isFiberCaution && (
                        <div className="mt-3 p-3 bg-orange-950/40 border border-orange-800 rounded-lg">
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-[#FFCE34]">🔥</span>
                            <div>
                              <strong className="text-orange-300">Carb Loading Tips:</strong>
                              <ul className="mt-1 text-[#FFFFFF] space-y-1">
                                <li>• Eat 5-6 small meals throughout the day</li>
                                <li>• Focus on simple carbs: white rice, pasta, bread</li>
                                <li>• Drink extra fluids with electrolytes</li>
                                <li>• Avoid high-fat meals to prevent stomach issues</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      {d.isFiberCaution && (
                        <div className="mt-3 p-3 bg-amber-950/50 border border-amber-800 rounded-lg">
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-amber-400">⚠️</span>
                            <div>
                              <strong className="text-amber-300">Fiber Caution:</strong>
                              <ul className="mt-1 text-amber-200 space-y-1">
                                <li>• Avoid beans, lentils, bran, cruciferous vegetables</li>
                                <li>• Choose white rice, pasta, white bread</li>
                                <li>• Bananas, sports drinks, crackers are excellent choices</li>
                                <li>• No new or untested foods - stick to familiar foods</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      {d.isRaceDay && (
                        <div className="mt-3 p-3 bg-[#FFCE34] rounded-lg text-white">
                          <div className="flex items-start gap-2 text-sm">
                            <span>🏁</span>
                            <div>
                              <strong>Race Day Strategy:</strong>
                              <ul className="mt-1 space-y-1">
                                <li>• Pre-race: {Math.round(weightKg * 1)} g carbs 3-4 hours before start</li>
                                <li>• During race: 60-90g carbs/hour (gels, drinks, bananas)</li>
                                <li>• Hydration: 500-750ml fluid/hour + electrolytes</li>
                                <li>• Post-race: 1.2g/kg carbs + 0.3g/kg protein within 30 min</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </Card>

              {/* Race Day Fueling Timeline - Made Prominent */}
              <Card className="border-2 border-orange-800 bg-gradient-to-br from-orange-950/40 to-[#24242A]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <SectionTitle title="⏱️ Race Day Fueling Strategy" subtitle="Personalized race timeline with weather-adaptive fueling" />
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Fuel Strategy</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFuelStrategy('aggressive')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          fuelStrategy === 'aggressive'
                            ? 'bg-red-500 text-white shadow-md'
                            : 'bg-[#24242A] border border-[#2A2A35] text-[#FFFFFF]'
                        }`}
                      >
                        Aggressive
                      </button>
                      <button
                        onClick={() => setFuelStrategy('optimal')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          fuelStrategy === 'optimal'
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-[#24242A] border border-[#2A2A35] text-[#FFFFFF]'
                        }`}
                      >
                        Optimal
                      </button>
                      <button
                        onClick={() => setFuelStrategy('safe')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          fuelStrategy === 'safe'
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-[#24242A] border border-[#2A2A35] text-[#FFFFFF]'
                        }`}
                      >
                        Safe
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#24242A] rounded-card p-6 border-2 border-[#2A2A35]">
                  {fuelStrategy === 'aggressive' && (
                    <div className="mb-4 p-3 bg-red-950/40 border border-red-800 rounded-lg">
                      <div className="text-sm text-red-200">
                        <strong>🔥 Aggressive Strategy:</strong> Higher carbohydrate intake for maximal performance. Best for experienced racers with well-trained gut. Takes risks for speed.
                      </div>
                    </div>
                  )}
                  {fuelStrategy === 'optimal' && (
                    <div className="mb-4 p-3 bg-green-950/40 border border-green-800 rounded-lg">
                      <div className="text-sm text-green-200">
                        <strong>✅ Optimal Strategy:</strong> Balanced approach for most athletes. Provides adequate fuel without overwhelming the gut.
                      </div>
                    </div>
                  )}
                  {fuelStrategy === 'safe' && (
                    <div className="mb-4 p-3 bg-blue-950/40 border border-blue-800 rounded-lg">
                      <div className="text-sm text-blue-200">
                        <strong>🛡️ Safe Strategy:</strong> Conservative fueling reduces gut distress risk. Best for first-time racers or those with sensitive stomachs.
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {raceTimeline.map((item, idx) => {
                      const totalMinutes = raceGoalHours * 60 + raceGoalMins;
                      return (
                        <motion.div
                          key={idx}
                          initial={{opacity:0,x:-10}}
                          animate={{opacity:1,x:0}}
                          transition={{delay:idx*0.05}}
                          className="relative"
                        >
                          <div className="flex gap-2 sm:gap-4 items-start">
                            {/* Time marker */}
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-base ${
                                item.time === 0 ? 'bg-[#FFCE34] text-white shadow-lg' :
                                item.time === totalMinutes ? 'bg-emerald-500 text-white shadow-lg' :
                                'bg-[#24242A] border-2 border-orange-400 dark:border-orange-700 text-orange-300'
                              }`}>
                                {item.time}
                              </div>
                              <div className="text-[10px] sm:text-xs text-center mt-1 text-[#A9A9B8]">min</div>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 bg-[#2A2A35] rounded-lg border border-[#2A2A35] p-3 sm:p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div className="font-semibold text-base sm:text-lg text-[#FFFFFF]">{item.label}</div>
                                <div className="text-xs sm:text-sm text-[#A9A9B8] whitespace-nowrap ml-2">
                                  {item.time === 0 ? 'Start' : item.time === totalMinutes ? 'Finish' : `${Math.round((item.time / totalMinutes) * 100)}%`}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3">
                                <div className="bg-orange-950/40 rounded-lg p-2 sm:p-3">
                                  <div className="text-[9px] sm:text-xs text-[#A9A9B8] mb-1 leading-tight">Carbs</div>
                                  <div className="text-sm sm:text-lg font-bold text-[#FFCE34]">{item.carbs}</div>
                                </div>
                                <div className="bg-blue-950/40 rounded-lg p-2 sm:p-3">
                                  <div className="text-[9px] sm:text-xs text-[#A9A9B8] mb-1 leading-tight">Fluid</div>
                                  <div className="text-sm sm:text-lg font-bold text-blue-300">{item.fluid}</div>
                                </div>
                                <div className="bg-purple-950/40 rounded-lg p-2 sm:p-3">
                                  <div className="text-[9px] sm:text-xs text-[#A9A9B8] mb-1 leading-tight">Sodium</div>
                                  <div className="text-sm sm:text-lg font-bold text-purple-300">{item.sodium}</div>
                                </div>
                              </div>
                              
                              <div className="text-sm text-[#FFFFFF] italic">
                                💡 {item.notes}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  {/* Race Totals Summary */}
                  <div className="mt-6 p-6 bg-[#FFCE34] rounded-card text-white">
                    <div className="text-center mb-4">
                      <div className="text-lg font-semibold mb-2">📊 Race Totals - What You Need</div>
                      <div className="text-sm opacity-90">Total amounts for the entire race</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold mb-1">
                          {raceTimeline.reduce((sum, item) => {
                            const carbs = item.carbs.replace('g', '');
                            return sum + (parseInt(carbs) || 0);
                          }, 0)}g
                        </div>
                        <div className="text-sm opacity-80">Total Carbs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold mb-1">
                          {raceTimeline.reduce((sum, item) => {
                            const fluid = item.fluid.replace('ml', '');
                            return sum + (parseInt(fluid) || 0);
                          }, 0)}ml
                        </div>
                        <div className="text-sm opacity-80">Total Fluid</div>
                      </div>
                      <div className="text-center">
                        {raceHydration ? (
                          <>
                            <div className="text-2xl font-bold mb-1">
                              Lost {raceHydration.totalSweatLossMg}mg
                            </div>
                            <div className="text-xl font-semibold mb-1">
                              Replace {raceHydration.sodiumLowerReplace}–{raceHydration.sodiumUpperReplace}mg
                            </div>
                            <div className="text-sm opacity-80">Total Sodium</div>
                          </>
                        ) : (
                          <>
                            <div className="text-3xl font-bold mb-1">
                              {raceTimeline.reduce((sum, item) => {
                                const sodium = item.sodium.replace('mg', '');
                                return sum + (parseInt(sodium) || 0);
                              }, 0)}mg
                            </div>
                            <div className="text-sm opacity-80">Total Sodium</div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-orange-400/30">
                      <div className="text-sm text-center opacity-90">
                        💡 Prepare this in advance to avoid running out during your race
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    <div className="p-4 bg-gradient-to-r from-purple-950/40 to-[#24242A] border border-purple-800 rounded-lg">
                      <div className="text-sm text-[#FFFFFF]">
                        <strong>🧂 Sodium & Fluid:</strong> Based on your sweat rate ({raceHydration?.effectiveSweatRate} L/h) and race weather ({raceWeather?.temp}°C). 
                        All recommendations adjust with your {fuelStrategy} fuel strategy (×{strategyMultiplier[fuelStrategy]}). Timeline split into {totalHours < 4 ? '30-minute' : '60-minute'} buckets.
                      </div>
                    </div>
                    <div className="p-4 bg-gradient-to-r from-orange-950/40 to-[#24242A] border border-orange-800 rounded-lg">
                      <div className="text-sm text-[#FFFFFF]">
                        <strong>🌍 Weather-Adaptive:</strong> Fluid recommendations adjust for temperature. Hot days ({raceWeather?.temp > 25 ? '↑ Increased' : raceWeather?.temp < 15 ? '↓ Reduced' : 'Normal'} intake) to match your sweat rate.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Race Day Fueling Product Guide - New Solver-Based System */}
              {raceTimeline.length > 0 && (
                <Card>
                  <SectionTitle title="🥤 Race Day Fueling Planner" subtitle="Product Library & Optimization Solver" />
                  
                  {/* Targets vs Plan */}
                  <div className="mb-6 grid grid-cols-3 gap-4">
                    {['carbs', 'fluid', 'sodium'].map(metric => {
                      const target = raceTargets[metric] || 0;
                      const plan = planValues[metric] || 0;
                      const diff = plan - target;
                      const percent = target > 0 ? Math.round((diff / target) * 100) : 0;
                      const color = percent >= -5 && percent <= 10 ? 'green' : percent < -20 ? 'red' : 'orange';
                      
                      return (
                        <div key={metric} className="bg-[#2A2A35] rounded-card p-4 border-2 border-[#2A2A35]">
                          <div className="text-sm text-[#A9A9B8] mb-2 capitalize">{metric}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-[#FFFFFF]">
                              {metric === 'carbs' ? plan : metric === 'fluid' ? plan : plan}
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${color === 'green' ? 'bg-green-950/40 text-green-300' : color === 'red' ? 'bg-red-950/40 text-red-300' : 'bg-orange-950/40 text-orange-300'}`}>
                              {percent > 0 ? '+' : ''}{percent}%
                            </div>
                          </div>
                          <div className="text-xs text-[#A9A9B8] mt-1">
                            Target: {target}{metric === 'carbs' ? 'g' : metric === 'fluid' ? 'ml' : 'mg'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Product Mix Table with Steppers */}
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-xs sm:text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-[#2A2A35]">
                          <th className="text-left py-3 px-2 font-semibold text-[#FFFFFF]">Product</th>
                          <th className="text-center py-3 px-2 font-semibold text-[#FFFFFF]">Carbs/unit</th>
                          <th className="text-center py-3 px-2 font-semibold text-[#FFFFFF]">Fluid/unit</th>
                          <th className="text-center py-3 px-2 font-semibold text-[#FFFFFF]">Sodium/unit</th>
                          <th className="text-center py-3 px-2 font-semibold text-[#FFFFFF]">Quantity</th>
                          <th className="text-right py-3 px-2 font-semibold text-[#FFFFFF]">Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => {
                          const count = productCounts[p.id] || 0;
                          const carbs = p.carbs * count;
                          const fluid = p.fluid * count;
                          const sodium = p.sodium * count;
                          
                          return (
                            <tr key={p.id} className="border-b border-[#2A2A35] hover:bg-[#2A2A35]">
                              <td className="py-3 px-2 font-medium text-[#FFFFFF] break-words">{p.name}</td>
                              <td className="text-center py-3 px-2 text-[#A9A9B8]">{p.carbs}g</td>
                              <td className="text-center py-3 px-2 text-[#A9A9B8]">{p.fluid}ml</td>
                              <td className="text-center py-3 px-2 text-[#A9A9B8]">{p.sodium}mg</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1 sm:gap-2">
                                  <button
                                    onClick={() => setProductCounts(prev => ({...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1)}))}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[#2A2A35] text-[#FFFFFF] hover:bg-[#3A3A45] font-bold text-sm"
                                    aria-label={`Decrease ${p.name}`}
                                    tabIndex={0}
                                  >
                                    −
                                  </button>
                                  <div className="w-10 sm:w-12 text-center font-bold text-[#FFFFFF]">{count}</div>
                                  <button
                                    onClick={() => setProductCounts(prev => ({...prev, [p.id]: ((prev[p.id] || 0) + 1)}))}
                                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-[#2A2A35] text-[#FFFFFF] hover:bg-[#3A3A45] font-bold text-sm"
                                    aria-label={`Increase ${p.name}`}
                                    tabIndex={0}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="text-right py-3 px-2 text-[#A9A9B8] text-xs sm:text-sm break-words">
                                {carbs}g / {fluid}ml / {sodium}mg
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Auto-Optimize Button */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setProductCounts(optimalCounts)}
                      className="px-4 py-2 bg-[#FFCE34] text-white rounded-lg font-medium hover:from-orange-600 hover:to-orange-700 transition-all"
                      aria-label="Auto-optimize product mix"
                    >
                      Auto-Optimize Mix
                    </button>
                    <button
                      onClick={() => setProductCounts({})}
                      className="px-4 py-2 bg-[#2A2A35] text-[#FFFFFF] rounded-lg font-medium hover:bg-[#3A3A45] transition-all"
                    >
                      Clear All
                    </button>
                  </div>
                  
                  {/* Product Library Management */}
                  <div className="mt-6 pt-6 border-t border-[#2A2A35]">
                    <div className="flex justify-between items-center mb-4">
                      <SectionTitle title="📚 Product Library" subtitle="Manage your custom products" />
                      <button
                        onClick={() => {
                          const newId = Math.max(...products.map(p => p.id), 0) + 1;
                          setProducts([...products, { id: newId, name: 'New Product', carbs: 0, fluid: 0, sodium: 0, unit: 'piece' }]);
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all"
                        aria-label="Add new product"
                      >
                        + Add Product
                      </button>
                    </div>
                    
                    {/* Column Headers */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 pb-2 border-b border-[#2A2A35]">
                      <div className="col-span-3 font-semibold text-xs sm:text-sm text-[#FFFFFF]">Product</div>
                      <div className="col-span-2 font-semibold text-xs sm:text-sm text-[#FFFFFF]">Carbs (g)</div>
                      <div className="col-span-2 font-semibold text-xs sm:text-sm text-[#FFFFFF]">Fluid (ml)</div>
                      <div className="col-span-2 font-semibold text-xs sm:text-sm text-[#FFFFFF]">Sodium (mg)</div>
                      <div className="col-span-3"></div>
                    </div>
                    
                    <div className="space-y-3">
                      {products.map(p => (
                        <div key={p.id} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 p-3 bg-[#2A2A35] rounded-lg border border-[#2A2A35]">
                          <input
                            type="text"
                            value={p.name}
                            onChange={e => setProducts(prev => prev.map(prod => prod.id === p.id ? {...prod, name: e.target.value} : prod))}
                            className="col-span-12 sm:col-span-3 border border-[#2A2A35] bg-[#24242A] text-white rounded px-2 py-1 text-xs sm:text-sm"
                            placeholder="Product name"
                          />
                          <div className="col-span-12 sm:col-span-2">
                            <input
                              type="number"
                              value={p.carbs}
                              onChange={e => setProducts(prev => prev.map(prod => prod.id === p.id ? {...prod, carbs: parseInt(e.target.value) || 0} : prod))}
                              className="w-full border border-[#2A2A35] bg-[#24242A] text-white rounded px-2 py-1 text-xs sm:text-sm"
                              placeholder="Carbs (g)"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-2">
                            <input
                              type="number"
                              value={p.fluid}
                              onChange={e => setProducts(prev => prev.map(prod => prod.id === p.id ? {...prod, fluid: parseInt(e.target.value) || 0} : prod))}
                              className="w-full border border-[#2A2A35] bg-[#24242A] text-white rounded px-2 py-1 text-xs sm:text-sm"
                              placeholder="Fluid (ml)"
                            />
                          </div>
                          <div className="col-span-12 sm:col-span-2">
                            <input
                              type="number"
                              value={p.sodium}
                              onChange={e => setProducts(prev => prev.map(prod => prod.id === p.id ? {...prod, sodium: parseInt(e.target.value) || 0} : prod))}
                              className="w-full border border-[#2A2A35] bg-[#24242A] text-white rounded px-2 py-1 text-xs sm:text-sm"
                              placeholder="Sodium (mg)"
                            />
                          </div>
                          <button
                            onClick={() => setProducts(prev => prev.filter(prod => prod.id !== p.id))}
                            className="col-span-12 sm:col-span-3 px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600 transition-all"
                            aria-label={`Delete ${p.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <SectionTitle title="Fiber Caution Foods" subtitle="Smart food choices for race week" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-[#FFCE34]">✅ Best Options (Low Fiber)</h4>
                    <div className="space-y-2 text-sm text-[#FFFFFF]">
                      <div>🍚 White rice (cooked): 55g/cup</div>
                      <div>🍝 White pasta (cooked): 45g/cup</div>
                      <div>🍞 White bread (2 slices): 30g</div>
                      <div>🍌 Banana: 25g each</div>
                      <div>🧃 Sports drink: 35g/500ml</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-red-300">❌ Foods to Avoid</h4>
                    <div className="space-y-2 text-sm text-[#FFFFFF]">
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
              {/* Help Modal */}
              {showHydrationHelp && (
                <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Hydration Planning</h3>
                    <button
                      onClick={() => setShowHydrationHelp(false)}
                      className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                    <div>
                      <strong className="text-[#FFCE34]">1️⃣ Location & Weather:</strong>
                      <p>Enter your training location and week start date, then click "Fetch Weather" to get accurate temperature and humidity data for your calculations.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">2️⃣ Session Details:</strong>
                      <p>Enter your training duration and time of day. Longer sessions and hotter times require more hydration.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">3️⃣ Sweat Rate:</strong>
                      <p>Select your sweat rate category (Low to Very High). This affects how much fluid you lose during training.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">4️⃣ Sodium Loss:</strong>
                      <p>Choose your saltiness category (Low to Very High). Saltier sweat means you need more sodium replacement.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">5️⃣ Heat Acclimation:</strong>
                      <p>Select your heat adaptation level. Well-acclimated athletes lose less sodium and need less replacement.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">6️⃣ Daily Schedule:</strong>
                      <p>View your personalized hydration and calorie targets for each day of the week based on weather and training.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Location and Weather Section */}
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <SectionTitle title="Location & Weather" subtitle="Get forecast for your training week" />
                  <button
                    onClick={() => setShowHydrationHelp(!showHydrationHelp)}
                    className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all text-sm font-bold flex-shrink-0"
                    aria-label="Help"
                  >
                    ?
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div>
                    <Label>Week Start Date</Label>
                    <input
                      type="date"
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-4 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
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
                        className="flex-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-4 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && fetchWeather(location)}
                      />
                      <button
                        onClick={() => fetchWeather(location)}
                        disabled={loadingWeather || !location}
                        className="px-6 py-2 bg-[#FFCE34] text-white rounded-card font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingWeather ? 'Loading...' : 'Get Weather'}
                      </button>
                    </div>
                  </div>
                </div>
                {currentWeather && (
                  <div className="flex items-center gap-4 p-4 bg-[#24242A] rounded-card">
                    <div className="text-5xl">🌤️</div>
                    <div>
                      <div className="text-xl font-bold">{currentWeather.city}, {currentWeather.country}</div>
                      <div className="text-sm text-[#A9A9B8] capitalize">{currentWeather.description}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-3xl font-bold">{Math.round(currentWeather.temp)}°C</div>
                      <div className="text-sm text-[#A9A9B8]">Humidity: {currentWeather.humidity}%</div>
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
                  <span className="px-3 py-1 bg-[#FFCE34] text-white text-xs font-bold rounded-full">
                    PREMIUM
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Saltiness Category</Label>
                      <div className="group relative inline-block">
                        <div 
                          className="w-5 h-5 rounded-full bg-[#FFCE34] text-white text-xs font-bold cursor-pointer flex items-center justify-center hover:bg-[#FFD966] active:bg-orange-700 transition-colors"
                          onClick={() => setShowSaltinessTooltip(!showSaltinessTooltip)}
                        >
                          ?
                        </div>
                        <div className={`absolute left-0 bottom-full mb-2 w-80 bg-[#24242A] text-white text-xs rounded-lg shadow-xl p-3 transition-all duration-200 z-50 pointer-events-none ${showSaltinessTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
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
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={saltinessCategory}
                      onChange={(e) => setSaltinessCategory(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option value="Low" style={{ background: '#24242A', color: '#FFFFFF' }}>Low (500 mg/L)</option>
                      <option value="Medium" style={{ background: '#24242A', color: '#FFFFFF' }}>Medium (900 mg/L)</option>
                      <option value="High" style={{ background: '#24242A', color: '#FFFFFF' }}>High (1,300 mg/L)</option>
                      <option value="Very High" style={{ background: '#24242A', color: '#FFFFFF' }}>Very High (1,800 mg/L)</option>
                    </select>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Label>Heat Acclimation Status</Label>
                      <div className="group relative inline-block">
                        <div 
                          className="w-5 h-5 rounded-full bg-[#FFCE34] text-white text-xs font-bold cursor-pointer flex items-center justify-center hover:bg-[#FFD966] active:bg-orange-700 transition-colors"
                          onClick={() => setShowAcclimationTooltip(!showAcclimationTooltip)}
                        >
                          ?
                        </div>
                        <div className={`absolute left-0 bottom-full mb-2 w-80 bg-[#24242A] text-white text-xs rounded-lg shadow-xl p-3 transition-all duration-200 z-50 pointer-events-none ${showAcclimationTooltip ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
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
                      className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                      value={heatAcclimation}
                      onChange={(e) => setHeatAcclimation(e.target.value)}
                      style={{ color: '#FFFFFF' }}
                    >
                      <option value="Not acclimated" style={{ background: '#24242A', color: '#FFFFFF' }}>Not acclimated (1.00×)</option>
                      <option value="Partial acclimated" style={{ background: '#24242A', color: '#FFFFFF' }}>Partial (0.85×)</option>
                      <option value="Well acclimated" style={{ background: '#24242A', color: '#FFFFFF' }}>Well acclimated (0.70×)</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-orange-950/40 rounded-card border-2 border-orange-800">
                  <div className="text-sm font-semibold text-[#FFCE34] mb-2">⚙️ Auto-Calculated Settings</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-[#A9A9B8]">Intensity Modifier</div>
                      <div className="font-mono font-semibold text-[#FFCE34]">Sweat: {intensitySweatMultiplier.toFixed(2)}× Na: {intensityNaMultiplier.toFixed(2)}×</div>
                      <div className="text-[#A9A9B8] text-[10px] mt-1">From training log intensity</div>
                    </div>
                    <div>
                      <div className="text-[#A9A9B8]">Temperature Modifier</div>
                      <div className="font-mono font-semibold text-[#FFCE34]">{temperatureMultiplier.toFixed(2)}× @ {ambientC}°C</div>
                      <div className="text-[#A9A9B8] text-[10px] mt-1">From weather API</div>
                    </div>
                    <div>
                      <div className="text-[#A9A9B8]">Acclimation Modifier</div>
                      <div className="font-mono font-semibold text-[#FFCE34]">{acclimationMultiplier.toFixed(2)}× Na</div>
                      <div className="text-[#A9A9B8] text-[10px] mt-1">{heatAcclimation}</div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Weekly Hydration Schedule */}
                <Card>
                <SectionTitle title="Weekly Hydration Schedule" subtitle="Training sessions + resting fluid needs" />
                <div className="space-y-4">
                  {weeklyHydrationSchedule.map((day, index) => (
                    <div key={day.day} className={`border rounded-card p-4 ${day.hasTraining ? 'border-emerald-800 bg-emerald-900/20' : 'border-[#2A2A35]'}`}>
                      <div className="mb-3">
                        <div className="font-bold text-lg">{day.day}</div>
                        {day.forecastDate && (
                          <div className="text-sm text-[#A9A9B8]">{day.forecastDate}</div>
                        )}
                      </div>
                      
                      {day.hasTraining ? (
                        <>
                          {/* Training Sessions */}
                          {day.sessions.map((session, idx) => (
                            <div key={idx} className="mb-3 pb-3 border-b border-orange-800 last:border-0 last:pb-0 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-semibold text-[#FFCE34]">
                                  {session.timeOfDay} Session • {session.type} • {session.duration} min
                                </div>
                                <div className="text-xs text-[#A9A9B8]">
                                  {session.temp}°C • {session.humidity}% humidity
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-[#A9A9B8] mb-1">Rate</div>
                                  <div className="font-semibold text-orange-300">
                                    <span className="text-[#FFFFFF]">Fluid:</span> {session.fluidPerHour} ml/h
                                  </div>
                                  <div className="font-semibold text-orange-300">
                                    <span className="text-[#FFFFFF]">Sodium:</span> {session.sodiumPerHour} mg/h
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[#A9A9B8] mb-1">Session Total</div>
                                  <div className="font-semibold text-orange-300">
                                    <span className="text-[#FFFFFF]">Fluid:</span> {session.totalFluid} ml
                                  </div>
                                  <div className="font-semibold text-orange-300">
                                    <span className="text-[#FFFFFF]">Sodium:</span> Lost {session.totalSweatLossMg} mg / Replace {session.sodiumLowerReplace}–{session.sodiumUpperReplace} mg
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Daily Summary */}
                          <div className="mt-3 pt-3 border-t-2 border-[#2A2A35]">
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="text-[#A9A9B8] mb-1">Training Total</div>
                                <div className="font-bold text-[#FFCE34]">
                                  <span className="text-[#FFFFFF] text-xs font-normal">Fluid:</span> {day.totalTrainingFluid} ml
                                </div>
                                <div className="text-xs text-[#A9A9B8]">
                                  <span className="font-semibold">Sodium:</span> Lost {day.totalTrainingSweatLossMg} mg / Replace {day.totalTrainingLowerReplace}–{day.totalTrainingUpperReplace} mg
                                </div>
                              </div>
                              <div>
                                <div className="text-[#A9A9B8] mb-1">Total Fluid Intake (24h)</div>
                                <div className="font-bold text-[#FFCE34]">
                                  <span className="text-[#FFFFFF] text-xs font-normal">Fluid:</span> {day.dailyResting} ml
                                </div>
                                <div className="text-xs text-[#A9A9B8]">Background fluid</div>
                              </div>
                              <div>
                                <div className="text-[#A9A9B8] mb-1">Daily Total</div>
                                <div className="font-bold text-xl text-[#FFCE34]">
                                  <span className="text-[#FFFFFF] text-sm font-normal">Fluid:</span> {day.totalDaily} ml
                                </div>
                                <div className="text-xs text-[#A9A9B8]">All fluids combined</div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-[#A9A9B8]">
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
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
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
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                        value={sessionMin} 
                        onChange={e => setSessionMin(Number(e.target.value))}
                        min={15}
                        max={480}
                      />
                    </div>

                    <div>
                      <Label>Intensity</Label>
                      <select 
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]"
                        value={"easy"}
                        style={{ color: '#FFFFFF' }}
                      >
                        <option value="easy" style={{ background: '#24242A', color: '#FFFFFF' }}>Aerobic / Easy</option>
                        <option value="tempo" style={{ background: '#24242A', color: '#FFFFFF' }}>Tempo / Threshold</option>
                        <option value="vo2" style={{ background: '#24242A', color: '#FFFFFF' }}>VO₂ / Intervals</option>
                        <option value="strength" style={{ background: '#24242A', color: '#FFFFFF' }}>Strength</option>
                      </select>
                    </div>

                    <div>
                      <Label>Ambient temperature (°C)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                        value={ambientC} 
                        onChange={e => setAmbientC(Number(e.target.value))}
                        min={-10}
                        max={45}
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 p-3 bg-orange-950/40 border border-orange-800 rounded-lg">
                      <div className="text-sm font-semibold text-[#FFCE34] mb-1">ℹ️ Hydration Settings</div>
                      <div className="text-xs text-[#FFCE34]">
                        Sweat rate category is set in the Daily tab. Intensity automatically matches your training log.
                      </div>
                    </div>

                    <div>
                      <Label>Estimated sweat sodium (mg/L)</Label>
                      <input 
                        type="number" 
                        className="w-full mt-1 border border-[#2A2A35] bg-[#24242A] rounded-card px-3 py-2 text-[#FFFFFF] focus:ring-2 focus:ring-[#FFCE34]" 
                        value={Math.round(sweatNaMgPerL)} 
                        onChange={e => {}}
                        readOnly
                        min={300}
                        max={1500}
                      />
                      <p className="text-xs text-[#A9A9B8] mt-1">Auto-calculated from ambient temp. Typical 500–1000 mg/L.</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="px-3 py-1 text-xs font-semibold bg-[#2A2A35] text-[#FFFFFF] rounded-lg">Env index: {Math.round(envIndex)}</span>
                    <span className="px-3 py-1 text-xs font-semibold bg-emerald-950/40 text-emerald-300 rounded-lg">Fluid rate: {fluidPerHour} ml/h</span>
                    <span className="px-3 py-1 text-xs font-semibold bg-orange-950/40 text-orange-300 rounded-lg">Sodium: {recSodiumPerHr} mg/h</span>
                  </div>
                </Card>

                {/* Output Section */}
                <div className="space-y-6">
                  <Card>
                    <SectionTitle title="Session Plan" subtitle="Targets per hour and totals for the session" />
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-card border border-[#2A2A35] p-4">
                        <div className="text-xs text-[#A9A9B8] mb-1">Per hour</div>
                        <div className="text-2xl font-bold text-[#FFCE34]">{fluidPerHour} ml</div>
                        <div className="text-sm text-[#A9A9B8] mt-1">Sodium: {recSodiumPerHr} mg</div>
                      </div>
                      <div className="rounded-card border border-[#2A2A35] p-4">
                        <div className="text-xs text-[#A9A9B8] mb-1">Total this session</div>
                        <div className="text-2xl font-bold text-[#FFCE34]">{totalFluidMl} ml</div>
                        <div className="text-sm text-[#A9A9B8] mt-1">
                          Sodium: Lost {totalSweatLossMg} mg / Replace {sodiumLowerReplace}–{sodiumUpperReplace} mg
                        </div>
                      </div>
                    </div>

                    <div className="rounded-card border border-[#2A2A35] p-4 bg-emerald-900/20">
                      <div className="text-sm font-semibold text-[#FFCE34] mb-2">Drink Sodium Concentration</div>
                      <div className="text-sm text-[#FFFFFF]">
                        Your drink should contain approximately <span className="font-bold text-[#FFCE34]">{drinkNaMgPerL} mg/L</span> sodium to meet your needs.
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <SectionTitle title="Notes & Safeguards" />
                    <ul className="text-sm text-[#FFFFFF] space-y-2">
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
                  <div className="text-center p-3 bg-[#24242A] rounded-lg">
                    <div className="text-xs text-[#A9A9B8]">Weight</div>
                    <div className="text-lg font-bold text-[#FFCE34]">{weightKg} kg</div>
                  </div>
                  <div className="text-center p-3 bg-[#24242A] rounded-lg">
                    <div className="text-xs text-[#A9A9B8]">Height</div>
                    <div className="text-lg font-bold text-[#FFCE34]">{heightCm} cm</div>
                  </div>
                  <div className="text-center p-3 bg-[#24242A] rounded-lg">
                    <div className="text-xs text-[#A9A9B8]">BMR</div>
                    <div className="text-lg font-bold text-[#FFCE34]">{bmr} kcal</div>
                  </div>
                  <div className="text-center p-3 bg-[#24242A] rounded-lg">
                    <div className="text-xs text-[#A9A9B8]">Base Activity</div>
                    <div className="text-lg font-bold text-[#FFCE34]">{nonTraining} kcal</div>
                  </div>
                </div>
                <p className="text-xs text-[#A9A9B8]">
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
                  <SectionTitle title="Daily Calories" subtitle="Total calories today (averaged over weekly distance)" />
                  <div className="space-y-2">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => (
                      <div key={day} className="flex justify-between items-center p-2 bg-[#24242A] rounded-lg">
                        <span className="font-medium capitalize">{day}</span>
                        <div className="text-right">
                          <div className="font-bold text-[#FFCE34]">
                            {dailyTotalCalories[index]} kcal
                          </div>
                          <div className="text-xs text-[#A9A9B8]">
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
                    <div className="text-3xl font-bold text-[#FFCE34] mb-2">
                      {weeklyTotalCalories} kcal
                    </div>
                    <div className="text-sm text-[#A9A9B8]">
                      Average: {Math.round(weeklyTotalCalories / 7)} kcal/day
                    </div>
                    <div className="text-xs text-[#A9A9B8] mt-2">
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
              {/* Help Modal */}
              {showTrainingHelp && (
                <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Training Log</h3>
                    <button
                      onClick={() => setShowTrainingHelp(false)}
                      className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                    <div>
                      <strong className="text-[#FFCE34]">1️⃣ Log Your Sessions:</strong>
                      <p>For each day, enter your training duration (minutes), type (Run, Bike, Swim, Strength, Cross-Train, Rest), intensity (Aerobic, Threshold, VO2max), and time of day.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">2️⃣ Double Sessions:</strong>
                      <p>Check "Add Second Session" to log two workouts in one day (e.g., morning run + afternoon strength).</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">3️⃣ Daily Totals:</strong>
                      <p>Each day shows your base calories (non-training), training calories, and macro targets (Carbs, Protein, Fat).</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">4️⃣ View Reports:</strong>
                      <p>Check the Reports tab to see your weekly intensity distribution, training volume, and coaching analysis.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">💡 Tip:</strong>
                      <p>Consistent logging helps track your training load and optimize your nutrition accordingly.</p>
                    </div>
                  </div>
                </div>
              )}
              
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <SectionTitle title="Daily Training Log" subtitle="Track your sessions and nutrition" />
                  <button
                    onClick={() => setShowTrainingHelp(!showTrainingHelp)}
                    className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all text-sm font-bold flex-shrink-0"
                    aria-label="Help"
                  >
                    ?
                  </button>
                </div>
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
              {/* Help Modal */}
              {showCoachHelp && (
                <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Coach Dashboard</h3>
                    <button
                      onClick={() => setShowCoachHelp(false)}
                      className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                    <div>
                      <strong className="text-[#FFCE34]">1️⃣ Athlete Profile:</strong>
                      <p>View your current athlete profile showing weight, height, BMR, and base activity level at the top of the page.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">2️⃣ Manage Athletes:</strong>
                      <p>Add up to 5 athletes to track their individual nutrition and training programs. Click "+ Add Athlete" to create profiles.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">3️⃣ Training Programs:</strong>
                      <p>Build customized training programs for each athlete based on their goals, fitness level, and schedule.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">4️⃣ Nutrition Plans:</strong>
                      <p>Create personalized nutrition plans tailored to each athlete's training load, body composition goals, and dietary preferences.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">5️⃣ Progress Tracking:</strong>
                      <p>Monitor athlete progress over time with detailed reports and analytics.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">💡 Note:</strong>
                      <p>This feature is coming soon. For now, focus on your own training in the Training Log tab.</p>
                    </div>
                  </div>
                </div>
              )}
              
              <AthleteProfile 
                weightKg={weightKg}
                heightCm={heightCm}
                bmr={bmr}
                baseActivity={nonTraining}
              />
              
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <SectionTitle title="Coach Dashboard" subtitle="Manage athletes and training programs" />
                  <button
                    onClick={() => setShowCoachHelp(!showCoachHelp)}
                    className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all text-sm font-bold flex-shrink-0"
                    aria-label="Help"
                  >
                    ?
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Athletes (0/5)</h3>
                    <button className="px-4 py-2 bg-[#FFCE34] text-white rounded-lg hover:from-orange-600 hover:to-orange-700">
                      + Add Athlete
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-[#2A2A35] rounded-lg p-8 text-center">
                    <div className="text-4xl mb-3">🏋️</div>
                    <h4 className="font-semibold text-[#FFFFFF] mb-2">No athletes yet</h4>
                    <p className="text-sm text-[#A9A9B8]">Add up to 5 athletes to track their nutrition and training</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {tab === "reports" && (
            <motion.div key="reports" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              {/* Help Modal */}
              {showReportsHelp && (
                <div className="mb-6 p-4 sm:p-6 bg-[#24242A] border-2 border-[#FFCE34] rounded-card space-y-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg sm:text-xl font-bold text-[#FFFFFF]">📚 How to Use Reports</h3>
                    <button
                      onClick={() => setShowReportsHelp(false)}
                      className="text-[#A9A9B8] hover:text-[#FFFFFF] text-2xl font-bold flex-shrink-0 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs sm:text-sm text-[#FFFFFF] break-words">
                    <div>
                      <strong className="text-[#FFCE34]">1️⃣ Weekly Summary:</strong>
                      <p>View your training snapshot showing daily calories, training time, and energy breakdown. See your weekly totals and averages.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">2️⃣ Intensity Distribution Analysis:</strong>
                      <p>Comprehensive analysis including:</p>
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><strong>Grade:</strong> Overall week quality (A-D)</li>
                        <li><strong>Polarization Score:</strong> Ratio of easy to hard training</li>
                        <li><strong>Time in Zones:</strong> Breakdown of aerobic, threshold, VO2max, and strength</li>
                        <li><strong>Hard-Day Placement:</strong> Visual schedule showing intensity distribution</li>
                        <li><strong>Coaching Recommendations:</strong> Personalized tips to improve your training structure</li>
                      </ul>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">3️⃣ Daily Hydration Schedule:</strong>
                      <p>View your daily hydration and calorie targets with weather-based adjustments for each day of the week.</p>
                    </div>
                    
                    <div>
                      <strong className="text-[#FFCE34]">💡 Tip:</strong>
                      <p>Use the intensity distribution analysis to ensure balanced training with proper recovery spacing.</p>
                    </div>
                  </div>
                </div>
              )}
              
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] mb-1">Weekly Summary</h2>
                    <p className="text-xs sm:text-sm text-[#A9A9B8]">Compare your weekly calorie targets</p>
                  </div>
                  <button
                    onClick={() => setShowReportsHelp(!showReportsHelp)}
                    className="w-8 h-8 rounded-full bg-[#FFCE34] text-white flex items-center justify-center hover:bg-[#FFD966] transition-all text-sm font-bold flex-shrink-0"
                    aria-label="Help"
                  >
                    ?
                  </button>
                </div>
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

              {/* Intensity Distribution - Advanced Analysis */}
              {(() => {
                const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const dayNamesShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                
                // Collect all sessions with data
                const zoneMinutes = { aerobic: 0, threshold: 0, vo2max: 0, strength: 0 };
                const zoneCounts = { aerobic: 0, threshold: 0, vo2max: 0, strength: 0 };
                const hardDays = [];
                let trainingDays = 0;
                const dayLabels = [];
                
                dayNames.forEach((day, idx) => {
                  const dayLabel = dayNamesShort[idx];
                  const session = weeklySessions[day];
                  let hasTraining = false;
                  
                  if (session && session.duration > 0) {
                    hasTraining = true;
                    const min = session.duration;
                    const type = session.type?.toLowerCase();
                    
                    if (type === 'strength') {
                      zoneMinutes.strength += min;
                      zoneCounts.strength++;
                      hardDays.push({ day: idx, label: dayLabel, type: 'strength' });
                    } else if (session.intensity) {
                      const intensity = session.intensity.toLowerCase();
                      zoneMinutes[intensity] += min;
                      zoneCounts[intensity]++;
                      if (intensity === 'threshold' || intensity === 'vo2max') {
                        hardDays.push({ day: idx, label: dayLabel, type: intensity });
                      }
                    }
                  }
                  
                  if (session && session.doubleSession && session.secondSession && session.secondSession.duration > 0) {
                    hasTraining = true;
                    const min = session.secondSession.duration;
                    const type = session.secondSession.type?.toLowerCase();
                    
                    if (type === 'strength') {
                      zoneMinutes.strength += min;
                      zoneCounts.strength++;
                      hardDays.push({ day: idx, label: dayLabel, type: 'strength' });
                    } else if (session.secondSession.intensity) {
                      const intensity = session.secondSession.intensity.toLowerCase();
                      zoneMinutes[intensity] += min;
                      zoneCounts[intensity]++;
                      if (intensity === 'threshold' || intensity === 'vo2max') {
                        hardDays.push({ day: idx, label: dayLabel, type: intensity });
                      }
                    }
                  }
                  
                  dayLabels.push({ day: idx, label: dayLabel, hasTraining });
                  if (hasTraining) trainingDays++;
                });
                
                const totalMinutes = zoneMinutes.aerobic + zoneMinutes.threshold + zoneMinutes.vo2max;
                const totalAll = totalMinutes + zoneMinutes.strength;
                
                // Calculate percentages
                const zonePercents = totalMinutes > 0 ? {
                  aerobic: Math.round((zoneMinutes.aerobic / totalMinutes) * 100),
                  threshold: Math.round((zoneMinutes.threshold / totalMinutes) * 100),
                  vo2max: Math.round((zoneMinutes.vo2max / totalMinutes) * 100)
                } : { aerobic: 0, threshold: 0, vo2max: 0 };
                
                // Polarization Score
                const ps = (zoneMinutes.threshold + zoneMinutes.vo2max) > 0 
                  ? zoneMinutes.aerobic / (zoneMinutes.threshold + zoneMinutes.vo2max) 
                  : 0;
                
                // Intensity Density
                const intensityDensity = trainingDays > 0 
                  ? Math.round((zoneMinutes.threshold + zoneMinutes.vo2max) / trainingDays) 
                  : 0;
                
                // Hard-day spacing
                hardDays.sort((a, b) => a.day - b.day);
                let hasBackToBack = false;
                let spacingInfo = "";
                if (hardDays.length > 1) {
                  const gaps = [];
                  for (let i = 1; i < hardDays.length; i++) {
                    const gap = hardDays[i].day - hardDays[i-1].day;
                    gaps.push(gap);
                    if (gap === 0) hasBackToBack = true;
                  }
                  
                  if (hasBackToBack) {
                    // Find the specific back-to-back
                    const btIdx = gaps.findIndex(g => g === 0);
                    if (btIdx >= 0) {
                      spacingInfo = `Back-to-back detected on ${hardDays[btIdx].label}→${hardDays[btIdx+1].label} ⚠️`;
                    }
                  } else {
                    spacingInfo = "No back-to-back hard days ✅";
                  }
                } else if (hardDays.length === 0) {
                  spacingInfo = "No hard days scheduled";
                } else {
                  spacingInfo = "Single hard day ✅";
                }
                
                // Grade calculation
                let score = 0;
                
                // Aerobic share (30 pts)
                if (zonePercents.aerobic >= 70 && zonePercents.aerobic <= 85) {
                  score += 30;
                } else if ((zonePercents.aerobic >= 60 && zonePercents.aerobic <= 69) || 
                          (zonePercents.aerobic >= 86 && zonePercents.aerobic <= 90)) {
                  score += 20;
                } else {
                  score += 10;
                }
                
                // Hard-day count (25 pts)
                const hardDayCount = hardDays.filter(d => d.type !== 'strength').length;
                if (hardDayCount >= 2 && hardDayCount <= 3) {
                  score += 25;
                } else if (hardDayCount === 1 || hardDayCount === 4) {
                  score += 15;
                } else {
                  score += 5;
                }
                
                // Hard-day spacing (20 pts)
                if (!hasBackToBack && hardDayCount > 0) {
                  score += 20;
                } else if (hasBackToBack) {
                  score += 10;
                }
                
                // VO2 share (10 pts)
                const vo2Percent = totalMinutes > 0 ? Math.round((zoneMinutes.vo2max / totalMinutes) * 100) : 0;
                if (vo2Percent >= 5 && vo2Percent <= 12) {
                  score += 10;
                } else {
                  score += 5;
                }
                
                // Strength sessions (10 pts)
                if (zoneCounts.strength >= 1 && zoneCounts.strength <= 2) {
                  score += 10;
                } else {
                  score += 5;
                }
                
                // Completion (5 pts)
                if (trainingDays > 0) {
                  score += 5;
                }
                
                // Grade mapping
                let grade = 'D';
                let gradeNumber = 0;
                if (score >= 85) {
                  grade = 'A';
                  gradeNumber = Math.min(100, 100 - (100 - score) * 0.5);
                } else if (score >= 75) {
                  grade = 'B';
                  gradeNumber = 75 + (score - 75);
                } else if (score >= 65) {
                  grade = 'C';
                  gradeNumber = 65 + (score - 65);
                } else {
                  gradeNumber = score;
                }
                
                gradeNumber = Math.round(gradeNumber);
                
                // Verdict
                let verdict = "";
                if (score >= 85) {
                  verdict = "Well-structured polarized week with excellent intensity distribution.";
                } else if (score >= 75) {
                  verdict = "Balanced polarized week with good spacing.";
                } else if (score >= 65) {
                  verdict = "Decent balance but could improve intensity distribution.";
                } else {
                  verdict = "Week needs restructuring for better balance.";
                }
                
                // Coaching recommendations
                const recommendations = [];
                
                if (zonePercents.aerobic < 65) {
                  recommendations.push({ type: 'warning', text: `Raise easy volume. Current: ${zonePercents.aerobic}%. Add one 40–60 min aerobic session.` });
                }
                
                if (ps < 2.0 || hardDayCount >= 4) {
                  recommendations.push({ type: 'warning', text: "Too much intensity. Cap at 2–3 hard days per week." });
                }
                
                if (vo2Percent < 5) {
                  recommendations.push({ type: 'info', text: "VO2max training missing. Insert 6–8 × 2 min @ VO2 with full recovery if speed is a goal." });
                }
                
                if (zoneCounts.strength === 0) {
                  recommendations.push({ type: 'info', text: "Add 1 lower-body strength session for durability." });
                }
                
                if (hasBackToBack) {
                  recommendations.push({ type: 'warning', text: "Move one hard session +1 day to improve recovery." });
                }
                
                if (ps > 5.0) {
                  recommendations.push({ type: 'info', text: "Week is easy. Consider adding more intensity." });
                }
                
                return (
                  <Card>
                    <SectionTitle title="Intensity Distribution Analysis" subtitle="Advanced breakdown of training intensities" />
                    <div className="space-y-6">
                      {/* Grade Card */}
                      <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-950/50 rounded-card p-6 border-2 border-emerald-800">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-lg sm:text-xl font-bold text-emerald-100 mb-1">
                              Grade {grade} / {gradeNumber}
                            </div>
                            <div className="text-sm text-emerald-300">{verdict}</div>
                          </div>
                          <div className="text-6xl font-bold text-emerald-400">{grade}</div>
                        </div>
                      </div>
                      
                      {/* Polarization Score */}
                      <div className="bg-[#24242A] rounded-card p-4 border border-[#2A2A35]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-[#FFFFFF]">
                            Polarization Score: {ps.toFixed(1)}
                          </div>
                          <div className="text-xs text-[#A9A9B8]">
                            {ps >= 2.5 && ps <= 4.0 ? 'Ideal' : ps < 2.0 ? 'Too Intense' : 'Too Easy'}
                          </div>
                        </div>
                        <div className="h-2 bg-[#2A2A35] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                            style={{ width: `${Math.min(100, (ps / 6) * 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-[#A9A9B8] mt-1">
                          Target: 2.5–4.0 (easy minutes / hard minutes)
                        </div>
                      </div>
                      
                      {/* Stacked Time-in-Zone Bars */}
                      <div>
                        <div className="text-sm font-semibold text-[#FFFFFF] mb-3">Time in Zones</div>
                        <div className="space-y-3">
                          {/* Aerobic */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-blue-300 font-medium">Aerobic</span>
                              <span className="text-[#A9A9B8]">{zoneMinutes.aerobic} min ({zonePercents.aerobic}%)</span>
                            </div>
                            <div className="h-6 bg-[#2A2A35] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-400 to-blue-500"
                                style={{ width: `${zonePercents.aerobic}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Threshold */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#FFCE34] font-medium">Threshold</span>
                              <span className="text-[#A9A9B8]">{zoneMinutes.threshold} min ({zonePercents.threshold}%)</span>
                            </div>
                            <div className="h-6 bg-[#2A2A35] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-400 to-orange-500"
                                style={{ width: `${zonePercents.threshold}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* VO2max */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-red-300 font-medium">VO2max</span>
                              <span className="text-[#A9A9B8]">{zoneMinutes.vo2max} min ({zonePercents.vo2max}%)</span>
                            </div>
                            <div className="h-6 bg-[#2A2A35] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-red-400 to-red-500"
                                style={{ width: `${zonePercents.vo2max}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Strength */}
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-purple-300 font-medium">Strength</span>
                              <span className="text-[#A9A9B8]">{zoneMinutes.strength} min • {zoneCounts.strength} sessions</span>
                            </div>
                            <div className="h-6 bg-[#2A2A35] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-400 to-purple-500"
                                style={{ width: zoneMinutes.strength > 0 ? `${Math.min(100, (zoneMinutes.strength / totalAll) * 100)}%` : '0%' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hard-Day Placement Strip */}
                      <div>
                        <div className="text-sm font-semibold text-[#FFFFFF] mb-2">Hard-Day Placement</div>
                        <div className="flex gap-1 mb-2">
                          {dayNamesShort.map(label => {
                            const hardDay = hardDays.find(d => d.label === label);
                            const isHard = !!hardDay;
                            const isRed = hardDay && (hardDay.type === 'threshold' || hardDay.type === 'vo2max');
                            const isPurple = hardDay && hardDay.type === 'strength';
                            
                            return (
                              <div key={label} className="flex-1 flex flex-col items-center p-2 bg-[#24242A] rounded-lg border-2 border-transparent">
                                <div className="text-xs font-semibold text-[#FFFFFF] mb-2">{label}</div>
                                {isHard && (
                                  <div className={`w-6 h-6 rounded-full ${isRed ? 'bg-red-500' : 'bg-purple-500'} shadow-sm`} />
                                )}
                                {!isHard && (
                                  <div className="w-6 h-6 rounded-full bg-[#3A3A45]" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-xs text-[#A9A9B8] mb-2">{spacingInfo}</div>
                        <div className="text-xs text-[#A9A9B8] dark:text-[#A9A9B8] flex gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            <span>Threshold/VO2</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-purple-500 rounded-full" />
                            <span>Strength</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Metrics Summary */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#24242A] rounded-lg p-3 border border-[#2A2A35]">
                          <div className="text-xs text-[#A9A9B8] mb-1">Hard Days</div>
                          <div className="text-lg font-bold text-emerald-300">{hardDayCount}</div>
                        </div>
                        <div className="bg-[#24242A] rounded-lg p-3 border border-[#2A2A35]">
                          <div className="text-xs text-[#A9A9B8] mb-1">Intensity Density</div>
                          <div className="text-lg font-bold text-[#FFCE34]">{intensityDensity} min/day</div>
                        </div>
                        <div className="bg-[#24242A] rounded-lg p-3 border border-[#2A2A35]">
                          <div className="text-xs text-[#A9A9B8] mb-1">Training Days</div>
                          <div className="text-lg font-bold text-blue-300">{trainingDays}</div>
                        </div>
                        <div className="bg-[#24242A] rounded-lg p-3 border border-[#2A2A35]">
                          <div className="text-xs text-[#A9A9B8] mb-1">Total Volume</div>
                          <div className="text-lg font-bold text-[#FFFFFF]">{totalAll} min</div>
                        </div>
                      </div>
                      
                      {/* Coaching Recommendations */}
                      {recommendations.length > 0 && (
                        <div>
                          <div className="text-sm font-semibold text-[#FFFFFF] mb-2">Coaching Recommendations</div>
                          <div className="space-y-2">
                            {recommendations.map((rec, idx) => (
                              <div 
                                key={idx} 
                                className={`flex items-start gap-2 p-3 rounded-lg border ${
                                  rec.type === 'warning' 
                                    ? 'bg-orange-950/40 border-orange-800' 
                                    : 'bg-blue-950/40 border-blue-800'
                                }`}
                              >
                                <span className="text-sm">{rec.type === 'warning' ? '⚠️' : '💡'}</span>
                                <span className="text-xs text-[#FFFFFF]">{rec.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })()}

              {/* Daily Hydration Schedule */}
              <Card>
                <SectionTitle title="Daily Hydration & Calories Summary" subtitle="Training + resting calories with hydration targets" />
                <div className="space-y-4">
                  {weeklyHydrationSchedule.map((day, index) => {
                    const dailyCalories = dailyTotalCalories[index];
                    return (
                      <div key={index} className="border border-[#2A2A35] rounded-card p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                          <div className="flex-1">
                            <div className="font-bold text-base sm:text-lg">{day.day}</div>
                            <div className="text-xs text-[#A9A9B8]">
                              {day.forecastDate}
                              {day.hasTraining && ` • ${day.totalTrainingMins} min training`}
                            </div>
                          </div>
                          <div className="text-left sm:text-right flex-shrink-0">
                            <div className="font-bold text-lg sm:text-xl text-[#FFCE34]">
                              {dailyCalories} kcal
                            </div>
                            <div className="text-xs text-[#A9A9B8]">
                              {day.totalDaily} ml fluid
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                          {/* Energy Breakdown */}
                          <div className="bg-[#24242A] rounded-lg p-3 sm:p-4 border-2 border-orange-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-[#FFCE34] mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              ⚡ Energy
                            </div>
                            <div className="font-semibold text-[#FFFFFF]">
                              <div className="text-base sm:text-lg font-bold">Total: {dailyCalories} kcal</div>
                              <div className="text-xs text-[#A9A9B8] mt-0.5 sm:mt-1">
                                Training: {day.hasTraining ? dailyTrainingCalories[index] : 0} kcal
                              </div>
                            </div>
                          </div>

                          {/* Hydration Breakdown */}
                          <div className="bg-[#24242A] rounded-lg p-3 sm:p-4 border-2 border-blue-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-blue-300 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              💧 Hydration
                            </div>
                            <div className="font-semibold text-[#FFFFFF]">
                              <div className="text-base sm:text-lg font-bold">Total: {day.totalDaily} ml</div>
                              <div className="text-xs text-[#A9A9B8] mt-0.5 sm:mt-1">
                                Training: {day.totalTrainingFluid} ml
                              </div>
                            </div>
                          </div>

                          {/* Sodium */}
                          <div className="bg-[#24242A] rounded-lg p-3 sm:p-4 border-2 border-purple-200 dark:border-purple-800">
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-purple-300 mb-1.5 sm:mb-2 flex items-center gap-1 sm:gap-2">
                              🧂 Sodium
                            </div>
                            <div className="font-semibold text-[#FFFFFF]">
                              <div className="text-sm font-bold">
                                {day.hasTraining ? (
                                  <>Lost: {day.totalTrainingSweatLossMg} mg<br/>Replace: {day.totalTrainingLowerReplace}–{day.totalTrainingUpperReplace} mg</>
                                ) : (
                                  <>Rest day</>
                                )}
                              </div>
                              <div className="text-xs text-[#A9A9B8] mt-0.5 sm:mt-1">
                                {day.hasTraining ? 'During session' : 'No training'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Fuel Status Boxes */}
                        <div className="mt-4">
                          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-[#FFFFFF] mb-2">
                            Daily Calories
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          <div className="border-2 border-red-500 bg-red-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-red-300 mb-0.5 sm:mb-1 leading-tight">Under</div>
                            <div className="text-xs sm:text-sm font-bold text-red-200">
                              {Math.round(dailyCalories * 0.85)} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-red-300 mt-0.5">&lt;85%</div>
                          </div>
                          <div className="border-2 border-green-500 bg-green-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-green-300 mb-0.5 sm:mb-1 leading-tight">Optimal</div>
                            <div className="text-xs sm:text-sm font-bold text-green-200">
                              {dailyCalories} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-green-300 mt-0.5">100%</div>
                          </div>
                          <div className="border-2 border-orange-500 bg-orange-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-[#FFCE34] mb-0.5 sm:mb-1 leading-tight">Over</div>
                            <div className="text-xs sm:text-sm font-bold text-[#FFCE34]">
                              {Math.round(dailyCalories * 1.1)} kcal
                            </div>
                            <div className="text-[9px] sm:text-xs text-[#FFCE34] mt-0.5">&gt;110%</div>
                          </div>
                          </div>
                        </div>

                        {/* Hydration Status Boxes */}
                        <div className="mt-4">
                          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-[#FFFFFF] mb-2">
                            Daily Hydration
                          </div>
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                          <div className="border-2 border-red-500 bg-red-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-red-300 mb-0.5 sm:mb-1 leading-tight">Under</div>
                            <div className="text-xs sm:text-sm font-bold text-red-200">
                              {Math.round(day.totalDaily * 0.85)} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-red-300 mt-0.5">&lt;85%</div>
                          </div>
                          <div className="border-2 border-green-500 bg-green-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-green-300 mb-0.5 sm:mb-1 leading-tight">Optimal</div>
                            <div className="text-xs sm:text-sm font-bold text-green-200">
                              {day.totalDaily} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-green-300 mt-0.5">100%</div>
                          </div>
                          <div className="border-2 border-orange-500 bg-orange-950/40 rounded-lg p-1.5 sm:p-2 text-center">
                            <div className="text-[10px] sm:text-xs font-semibold text-[#FFCE34] mb-0.5 sm:mb-1 leading-tight">Over</div>
                            <div className="text-xs sm:text-sm font-bold text-[#FFCE34]">
                              {Math.round(day.totalDaily * 1.1)} ml
                            </div>
                            <div className="text-[9px] sm:text-xs text-[#FFCE34] mt-0.5">&gt;110%</div>
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

        <div className="text-xs text-[#A9A9B8] mt-6">
          Disclaimer: Educational tool; individual needs vary. Consult a sports dietitian for medical conditions.
        </div>
      </main>
    </div>
  );
}

function KV({ label, value, big }){
  return (
    <div className={`flex justify-between items-center ${big?"text-lg sm:text-xl lg:text-2xl font-bold text-[#FFCE34]":"text-sm sm:text-base lg:text-lg"}`}>
      <span className="text-slate-600 dark:text-slate-300 font-semibold text-left pr-2">{label}</span>
      <span className="font-bold text-[#FFCE34] text-right whitespace-nowrap">{value}</span>
    </div>
  );
}
