import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";

// ---------- UI primitives ----------
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl shadow-lg ring-1 ring-slate-200/50 dark:ring-slate-700/50 p-4 sm:p-6 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-4 sm:mb-6">
    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 drop-shadow-sm">{title}</h2>
    {subtitle && <p className="text-sm sm:text-base lg:text-lg text-sky-700 dark:text-sky-300 mt-1">{subtitle}</p>}
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
      className="flex-1 accent-emerald-600 h-6 sm:h-8 rounded-lg" 
      {...props}
    />
    <div className="flex items-center gap-2 w-full sm:w-40">
      <input 
        type="number" 
        value={value} 
        onChange={(e)=>onChange(Number(e.target.value))} 
        className="flex-1 sm:w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 text-base sm:text-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
        min={min}
        max={max}
        step={step}
      />
      {suffix && <span className="text-sm sm:text-base text-emerald-700 dark:text-emerald-300 font-semibold whitespace-nowrap">{suffix}</span>}
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
  const [tab, setTab] = useState("daily"); // daily | race | hydration

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

  const carbRange = [Math.round(carbLow * weightKg), Math.round(carbHigh * weightKg)];
  const proteinG = Math.round(protein * weightKg);
  const fatG = Math.round(fat * weightKg);

  const carbKcalMid = Math.round(((carbRange[0] + carbRange[1]) / 2) * 4);
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const macroTotalKcal = carbKcalMid + proteinKcal + fatKcal;
  const scale = macroTotalKcal > targetCalories ? targetCalories / macroTotalKcal : 1;

  const carbGFinal = Math.round(((carbRange[0] + carbRange[1]) / 2) * scale);
  const proteinGFinal = proteinG;
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
  const [sweatRate, setSweatRate] = useState(0.8); // L/h typical; editable
  const fluidPerHour = useMemo(()=> clamp(sweatRate, 0.4, 1.2), [sweatRate]);
  const sodiumMgPerL = useMemo(()=> 500 + Math.max(0, ambientC-15)*20, [ambientC]); // rough heuristic
  const fluidNeeded = useMemo(()=> (sessionMin/60)*fluidPerHour, [sessionMin, fluidPerHour]);
  const sodiumNeeded = useMemo(()=> Math.round(fluidNeeded * sodiumMgPerL), [fluidNeeded, sodiumMgPerL]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/50 dark:border-slate-700/50 print:hidden shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg" />
              <div>
                <div className="text-lg sm:text-xl font-bold leading-tight text-slate-900 dark:text-slate-100">Nutrition Planner</div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Running fuel calculator</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={()=>setDark(v=>!v)} 
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {dark ? "☀️ Light" : "🌙 Dark"}
              </button>
              <button 
                onClick={copyShareLink} 
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm"
              >
                📋 Share
              </button>
              <button 
                onClick={downloadCSV} 
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                📊 CSV
              </button>
              <button 
                onClick={exportPDF} 
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                📄 PDF
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 sm:pb-4">
          <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {[
              {id:"daily",label:"Daily"},
              {id:"race",label:"Race Week"},
              {id:"hydration",label:"Hydration"},
            ].map(t => (
              <button 
                key={t.id} 
                onClick={()=>setTab(t.id)} 
                className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all ${
                  tab===t.id
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm" 
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {t.label}
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
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="Training Load" subtitle="Multi-sport training & adjustments" />
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
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
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm" 
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
                      <KV label="Carbohydrate" value={`${carbGFinal} g (${carbKcal} kcal)`} />
                      <KV label="Protein" value={`${proteinGFinal} g (${proteinKcalFinal} kcal)`} />
                      <KV label="Fat" value={`${fatGFinal} g (${fatKcalFinal} kcal)`} />
                      <hr className="my-2" />
                      <KV label="Total macro kcal" value={`${carbKcal + proteinKcalFinal + fatKcalFinal} kcal`} />
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
                <SectionTitle title="Race Week Checklist" subtitle="Taper fuelling and day-by-day plan" />
                <ul className="list-disc pl-4 text-sm space-y-3 text-slate-700 dark:text-slate-300">
                  <li><span className="font-semibold text-emerald-700 dark:text-emerald-300">Mon–Wed:</span> Maintain calories; carbs ~6–7 g/kg; normal protein/fat. Hydrate to pale yellow urine.</li>
                  <li><span className="font-semibold text-emerald-700 dark:text-emerald-300">Thu–Fri:</span> Carbs ~7–9 g/kg; reduce fibre; spread across 4–6 meals; sip electrolytes.</li>
                  <li><span className="font-semibold text-emerald-700 dark:text-emerald-300">Race-eve dinner:</span> Simple carbs + lean protein; avoid heavy fats/fibre; 500–750 ml fluids.</li>
                  <li><span className="font-semibold text-emerald-700 dark:text-emerald-300">Race morning:</span> 2–3 h pre: 1–3 g/kg carbs + 20–25 g protein; 15–20 min pre: small sip (100–200 ml).</li>
                  <li><span className="font-semibold text-emerald-700 dark:text-emerald-300">Post-race:</span> 1.0–1.2 g/kg carbs in 1–2 h; 25–30 g protein; 1000–1500 mg sodium over the afternoon.</li>
                </ul>
              </Card>
              <Card>
                <SectionTitle title="Pre-Race Meal Builder" />
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">Bagel + honey</div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">Rice bowl + eggs</div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">Oats + banana + whey</div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Aim 1–3 g/kg carbs 2–3 h pre-race; keep fat/fibre low.</p>
              </Card>
            </motion.div>
          )}

          {tab === "hydration" && (
            <motion.div key="hydration" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4 sm:space-y-6">
              <Card>
                <SectionTitle title="Session Hydration Calculator" subtitle="Estimate fluid & sodium needs" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <InputRow label="Session duration"><NumberInput value={sessionMin} onChange={setSessionMin} min={30} max={180} step={5} suffix="min" /></InputRow>
                  <InputRow label="Ambient temp"><NumberInput value={ambientC} onChange={setAmbientC} min={5} max={35} step={1} suffix="°C" /></InputRow>
                  <InputRow label="Estimated sweat rate"><NumberInput value={sweatRate} onChange={setSweatRate} min={0.4} max={1.6} step={0.1} suffix="L/h" /></InputRow>
                </div>
              </Card>
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <SectionTitle title="Fluid Plan" />
                  <p className="text-sm text-slate-700 dark:text-slate-300">Drink about <span className="font-bold text-emerald-700 dark:text-emerald-300">{fluidPerHour.toFixed(1)} L/h</span>. For this session (~{sessionMin} min), target <span className="font-bold text-emerald-700 dark:text-emerald-300">{fluidNeeded.toFixed(2)} L</span> total.</p>
                </Card>
                <Card>
                  <SectionTitle title="Sodium Plan" />
                  <p className="text-sm text-slate-700 dark:text-slate-300">Use drinks/chews providing roughly <span className="font-bold text-emerald-700 dark:text-emerald-300">{sodiumMgPerL} mg/L</span>. For this session, total around <span className="font-bold text-emerald-700 dark:text-emerald-300">{sodiumNeeded} mg</span>.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Heuristic only; personalise using weigh-in/out testing when possible.</p>
                </Card>
              </div>
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
    <div className={`flex justify-between items-center ${big?"text-lg sm:text-xl lg:text-2xl font-bold text-emerald-700 dark:text-emerald-300":"text-sm sm:text-base lg:text-lg"}`}>
      <span className="text-slate-600 dark:text-slate-300 font-semibold text-left pr-2">{label}</span>
      <span className="font-bold text-emerald-700 dark:text-emerald-300 text-right whitespace-nowrap">{value}</span>
    </div>
  );
}
