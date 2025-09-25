import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";
<div className="p-3 bg-emerald-600 text-white rounded-lg">Tailwind OK</div>

// ---------- UI primitives ----------
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/90 dark:bg-slate-900/80 backdrop-blur rounded-2xl shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 ${className}`}>
    {children}
  </div>
);
const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-3">
    <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
  </div>
);
const Label = ({ children }) => (
  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{children}</label>
);
// slider + number input aligned in one row
const NumberInput = ({ value, onChange, min = 0, max = 9999, step = 1, suffix = "", ...props }) => (
  <div className="flex items-center gap-3 w-full">
    <input type="range" value={value} min={min} max={max} step={step} onChange={(e)=>onChange(Number(e.target.value))} className="flex-1 accent-emerald-600" {...props}/>
    <div className="flex items-center gap-1 w-28">
      <input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))} className="w-full border dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-100"/>
      {suffix && <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{suffix}</span>}
    </div>
  </div>
);
// label left, control right (for aligned rows)
const InputRow = ({ label, children }) => (
  <div className="flex items-center gap-4">
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
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// ---------- Shareable URL params ----------
const paramMap = [
  "sex","age","weightKg","heightCm","weeklyKm","activityFactor","dayType","goal","carbLow","carbHigh","protein","fat","dark"
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

  const dayAdj = useMemo(()=> dayType === "key" ? 250 : dayType === "recovery" ? -200 : 0,[dayType]);
  const goalAdj = useMemo(()=> goal === "performance" ? 100 : goal === "slight_loss" ? -200 : 0,[goal]);

  const targetCalories = clamp(Math.round(nonTraining + runKcal + dayAdj + goalAdj), 1800, 6000);

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
    const url = encodeState({ sex, age, weightKg, heightCm, weeklyKm, activityFactor, dayType, goal, carbLow, carbHigh, protein, fat, dark });
    await navigator.clipboard.writeText(url);
    alert("Shareable link copied:\n" + url);
  };
  const downloadCSV = () => {
    const rows = [["Sex","Age","Weight_kg","Height_cm","Weekly_km","Activity_factor","Day_type","Goal","Target_kcal","Carb_g","Protein_g","Fat_g","Pre_CHO_gkg","Post_CHO_gkg"],[sex,age,weightKg,heightCm,weeklyKm,activityFactor,dayType,goal,targetCalories,carbGFinal,proteinGFinal,fatGFinal,preCho,postCho]];
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
    setWeeklyKm(60); setActivityFactor(1.45); setDayType("key"); setGoal("performance");
    setCarbLow(5); setCarbHigh(8); setProtein(1.8); setFat(1.1); setDark(false); setTab("daily");
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-600" />
            <div>
              <div className="text-xl font-bold leading-tight">Nutrition Planner</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Running fuel calculator</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setDark(v=>!v)} className="px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700">{dark ? "Light" : "Dark"}</button>
            <button onClick={copyShareLink} className="px-3 py-1 rounded-xl bg-emerald-600 text-white">Copy Link</button>
            <button onClick={downloadCSV} className="px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700">Download CSV</button>
            <button onClick={exportPDF} className="px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700">Export PDF</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-3">
          <div className="inline-flex rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {[
              {id:"daily",label:"Daily"},
              {id:"race",label:"Race Week"},
              {id:"hydration",label:"Hydration"},
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 text-sm ${tab===t.id?"bg-slate-900 text-white dark:bg-slate-800":"bg-white dark:bg-slate-900 text-slate-600"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8 print:px-8">
        <AnimatePresence mode="wait">
          {tab === "daily" && (
            <motion.div key="daily" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}}>
              {/* Inputs */}
              <div className="grid xl:grid-cols-2 gap-6 mb-6">
                <Card>
                  <SectionTitle title="Athlete" subtitle="Basics for BMR and per-kg macros" />
                  <div className="space-y-4">
                    <InputRow label="Sex">
                      <div className="flex gap-2">
                        {["male","female"].map(s=>(
                          <button key={s} onClick={()=>setSex(s)} className={`px-3 py-1 rounded-xl border ${sex===s?"bg-slate-900 dark:bg-slate-800 text-white":"bg-white dark:bg-slate-900"}`}>{s}</button>
                        ))}
                      </div>
                    </InputRow>
                    <InputRow label="Age"><NumberInput value={age} onChange={setAge} min={14} max={80} /></InputRow>
                    <InputRow label="Weight"><NumberInput value={weightKg} onChange={setWeightKg} min={35} max={140} step={0.5} suffix="kg" /></InputRow>
                    <InputRow label="Height"><NumberInput value={heightCm} onChange={setHeightCm} min={120} max={220} step={0.5} suffix="cm" /></InputRow>
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="Training Load" subtitle="Running energy & day/goal adjustments" />
                  <div className="space-y-4">
                    <InputRow label="Weekly Volume"><NumberInput value={weeklyKm} onChange={setWeeklyKm} min={20} max={160} step={1} suffix="km / week" /></InputRow>
                    <InputRow label="Activity Factor (non-training)"><NumberInput value={activityFactor} onChange={setActivityFactor} min={1.2} max={1.8} step={0.01} /></InputRow>
                    <div className="text-xs text-slate-500 -mt-2">Sedentary ~1.3, active job ~1.6.</div>
                    <InputRow label="Day Type">
                      <div className="flex gap-2 flex-wrap">
                        {[{id:"key",label:"Key"},{id:"normal",label:"Normal"},{id:"recovery",label:"Recovery"}].map(d=> (
                          <button key={d.id} onClick={()=>setDayType(d.id)} className={`px-3 py-1 rounded-xl border ${dayType===d.id?"bg-emerald-600 text-white":"bg-white dark:bg-slate-900"}`}>{d.label}</button>
                        ))}
                      </div>
                    </InputRow>
                    <InputRow label="Goal">
                      <div className="flex gap-2 flex-wrap">
                        {[{id:"performance",label:"Performance"},{id:"maintain_weight",label:"Maintain"},{id:"slight_loss",label:"Slight loss"}].map(g=> (
                          <button key={g.id} onClick={()=>setGoal(g.id)} className={`px-3 py-1 rounded-xl border ${goal===g.id?"bg-blue-600 text-white":"bg-white dark:bg-slate-900"}`}>{g.label}</button>
                        ))}
                      </div>
                    </InputRow>
                  </div>
                </Card>

                <Card className="xl:col-span-2">
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
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:0.05}}>
                  <Card>
                    <SectionTitle title="Daily Energy" />
                    <div className="space-y-1 text-sm">
                      <KV label="BMR (Mifflin–St Jeor)" value={`${bmr} kcal`} />
                      <KV label="Non-training movement" value={`${nonTraining} kcal`} />
                      <KV label="Running energy (avg/day)" value={`${runKcal} kcal`} />
                      <KV label="Day adjustment" value={`${dayAdj>0?"+":""}${dayAdj} kcal`} />
                      <KV label="Goal adjustment" value={`${goalAdj>0?"+":""}${goalAdj} kcal`} />
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
                      <li>Hydration: 500–750 ml/h in heat + electrolytes</li>
                    </ul>
                  </Card>
                </motion.div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-8">
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
                        <div key={i} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                          <div className="font-medium mb-1">{m.title}</div>
                          <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
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
                    <ul className="list-disc pl-5 text-sm space-y-1 text-slate-700 dark:text-slate-300">
                      <li>Carb periodisation: push to upper range on key days / long runs.</li>
                      <li>Protein ~0.3 g/kg per feeding × 4–5 meals to optimise MPS.</li>
                      <li>Fats mostly from olive oil, nuts, avocado, fatty fish.</li>
                      <li>Supplements: Vitamin D, Omega-3, Caffeine (3–6 mg/kg pre-key), Creatine (3–5 g/day).</li>
                      <li>Monitor iron/ferritin each block if training hard.</li>
                      <li>Red flags: unintended weight loss, low mood, persistent fatigue → increase calories.</li>
                    </ul>
                    <div className="mt-3 flex gap-2 print:hidden">
                      <button onClick={resetAll} className="px-3 py-1 rounded-xl border border-slate-300 dark:border-slate-700">Reset</button>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          )}

          {tab === "race" && (
            <motion.div key="race" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4">
              <Card>
                <SectionTitle title="Race Week Checklist" subtitle="Taper fuelling and day-by-day plan" />
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li><b>Mon–Wed:</b> Maintain calories; carbs ~6–7 g/kg; normal protein/fat. Hydrate to pale yellow urine.</li>
                  <li><b>Thu–Fri:</b> Carbs ~7–9 g/kg; reduce fibre; spread across 4–6 meals; sip electrolytes.</li>
                  <li><b>Race-eve dinner:</b> Simple carbs + lean protein; avoid heavy fats/fibre; 500–750 ml fluids.</li>
                  <li><b>Race morning:</b> 2–3 h pre: 1–3 g/kg carbs + 20–25 g protein; 15–20 min pre: small sip (100–200 ml).</li>
                  <li><b>Post-race:</b> 1.0–1.2 g/kg carbs in 1–2 h; 25–30 g protein; 1000–1500 mg sodium over the afternoon.</li>
                </ul>
              </Card>
              <Card>
                <SectionTitle title="Pre-Race Meal Builder" />
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="border rounded-xl p-3">Bagel + honey</div>
                  <div className="border rounded-xl p-3">Rice bowl + eggs</div>
                  <div className="border rounded-xl p-3">Oats + banana + whey</div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Aim 1–3 g/kg carbs 2–3 h pre-race; keep fat/fibre low.</p>
              </Card>
            </motion.div>
          )}

          {tab === "hydration" && (
            <motion.div key="hydration" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.25}} className="space-y-4">
              <Card>
                <SectionTitle title="Session Hydration Calculator" subtitle="Estimate fluid & sodium needs" />
                <div className="grid md:grid-cols-3 gap-4">
                  <InputRow label="Session duration"><NumberInput value={sessionMin} onChange={setSessionMin} min={30} max={180} step={5} suffix="min" /></InputRow>
                  <InputRow label="Ambient temp"><NumberInput value={ambientC} onChange={setAmbientC} min={5} max={35} step={1} suffix="°C" /></InputRow>
                  <InputRow label="Estimated sweat rate"><NumberInput value={sweatRate} onChange={setSweatRate} min={0.4} max={1.6} step={0.1} suffix="L/h" /></InputRow>
                </div>
              </Card>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <SectionTitle title="Fluid Plan" />
                  <p className="text-sm">Drink about <b>{fluidPerHour.toFixed(1)} L/h</b>. For this session (~{sessionMin} min), target <b>{fluidNeeded.toFixed(2)} L</b> total.</p>
                </Card>
                <Card>
                  <SectionTitle title="Sodium Plan" />
                  <p className="text-sm">Use drinks/chews providing roughly <b>{sodiumMgPerL} mg/L</b>. For this session, total around <b>{sodiumNeeded} mg</b>.</p>
                  <p className="text-xs text-slate-500 mt-1">Heuristic only; personalise using weigh-in/out testing when possible.</p>
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
    <div className={`flex justify-between ${big?"text-base":"text-sm"}`}>
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
