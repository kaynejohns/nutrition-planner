import React from 'react';

interface DailyMacros {
  carbs: number;
  protein: number;
  fat: number;
  totalCalories: number;
  macroCalories: number;
}

interface WeeklySummaryProps {
  dailyCalories: number[];
  dailyTrainingCalories: number[];
  weightKg: number;
  carbsPerKg: number;
  proteinPerKg: number;
  fatPerKg: number;
  // Training data
  dailyTrainingTime?: number[];
  trainingDays?: number;
  doubleDays?: number;
  // Macro data
  dailyMacros?: DailyMacros[];
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({
  dailyCalories,
  dailyTrainingCalories,
  weightKg,
  carbsPerKg,
  proteinPerKg,
  fatPerKg,
  dailyTrainingTime = [0, 60, 0, 45, 0, 120, 90],
  trainingDays = 5,
  doubleDays = 2,
  dailyMacros = []
}) => {
  const weekTotal = dailyCalories.reduce((sum, cal) => sum + cal, 0);
  const avgDaily = Math.round(weekTotal / 7);
  const totalTraining = dailyTrainingCalories.reduce((sum, cal) => sum + cal, 0);
  const totalResting = weekTotal - totalTraining;
  const totalTrainingTime = dailyTrainingTime.reduce((sum, min) => sum + min, 0);
  const peakDay = Math.max(...dailyCalories);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Calculate weekly macro totals
  const weeklyMacros = dailyMacros.reduce((acc, macros) => ({
    carbs: acc.carbs + macros.carbs,
    protein: acc.protein + macros.protein,
    fat: acc.fat + macros.fat,
  }), { carbs: 0, protein: 0, fat: 0 });
  
  const avgDailyCarbs = Math.round(weeklyMacros.carbs / 7);
  const avgDailyProtein = Math.round(weeklyMacros.protein / 7);
  const avgDailyFat = Math.round(weeklyMacros.fat / 7);
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] mb-1 uppercase tracking-tight">WEEKLY SUMMARY</h2>
        <p className="text-xs sm:text-sm text-[#A9A9B8]">Compare your weekly calorie targets</p>
      </div>
      
      {/* Training Snapshot */}
      <div>
        <h3 className="text-base sm:text-lg font-bold mb-3 text-[#FFFFFF] uppercase">Training Snapshot</h3>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="grid grid-cols-7 gap-2 mb-4 min-w-[560px]">
            {dayNames.map((day, index) => {
              const hasTraining = dailyTrainingCalories[index] > 0;
              return (
                <div key={day} className="bg-[#24242A] border border-[#2A2A35] rounded-card p-2 text-center">
                  <div className="text-xs font-semibold text-[#FFFFFF] mb-1">{day}</div>
                  <div className="text-xs text-[#A9A9B8] mb-1">
                    {hasTraining ? 'Key' : 'Rest'}
                  </div>
                  <div className="text-xs text-emerald-400 font-medium">
                    {dailyCalories[index]} kcal
                  </div>
                  <div className="text-xs text-[#A9A9B8]">
                    T: {dailyTrainingCalories[index]} kcal
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Total Training Time</div>
            <div className="text-lg font-bold text-emerald-300">{totalTrainingTime} min</div>
          </div>
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Training Days</div>
            <div className="text-lg font-bold text-emerald-300">{trainingDays} days</div>
          </div>
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Double Days</div>
            <div className="text-lg font-bold text-emerald-300">{doubleDays} days</div>
          </div>
        </div>
      </div>
      
      {/* Training Load & Distribution */}
      <div>
        <h3 className="text-base sm:text-lg font-bold mb-3 text-[#FFFFFF] uppercase">Weekly Energy Summary</h3>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Weekly Total</div>
            <div className="text-lg font-bold text-emerald-300">{weekTotal.toLocaleString()} kcal</div>
          </div>
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Daily Average</div>
            <div className="text-lg font-bold text-emerald-300">{avgDaily} kcal</div>
          </div>
          <div className="bg-[#24242A] rounded-card p-3 border border-[#2A2A35]">
            <div className="text-xs text-[#A9A9B8] mb-1">Peak Day</div>
            <div className="text-lg font-bold text-emerald-300">{peakDay} kcal</div>
          </div>
        </div>
        
        {/* Breakdown */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-900/20 border border-blue-800 rounded-card p-3">
            <div className="text-xs text-[#A9A9B8] mb-1">Resting Energy (Non-Training)</div>
            <div className="text-2xl font-bold text-blue-300">{totalResting.toLocaleString()} kcal</div>
            <div className="text-xs text-[#A9A9B8] mt-1">Average: {Math.round(totalResting / 7)} kcal/day</div>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-card p-3">
            <div className="text-xs text-[#A9A9B8] mb-1">Training Energy</div>
            <div className="text-2xl font-bold text-emerald-300">{totalTraining.toLocaleString()} kcal</div>
            <div className="text-xs text-[#A9A9B8] mt-1">Average: {Math.round(totalTraining / 7)} kcal/day</div>
          </div>
        </div>
        
        {/* Weekly Macro Summary */}
        {dailyMacros.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[#FFFFFF] mb-3 uppercase">Weekly Macros</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="bg-orange-900/20 border border-orange-800 rounded-card p-3">
                <div className="text-xs text-[#A9A9B8] mb-1">Weekly Total Carbs</div>
                <div className="text-xl font-bold text-orange-300">{weeklyMacros.carbs.toLocaleString()}g</div>
                <div className="text-xs text-[#A9A9B8] mt-1">Avg: {avgDailyCarbs}g/day</div>
              </div>
              <div className="bg-purple-900/20 border border-purple-800 rounded-card p-3">
                <div className="text-xs text-[#A9A9B8] mb-1">Weekly Total Protein</div>
                <div className="text-xl font-bold text-purple-300">{weeklyMacros.protein.toLocaleString()}g</div>
                <div className="text-xs text-[#A9A9B8] mt-1">Avg: {avgDailyProtein}g/day</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-card p-3">
                <div className="text-xs text-[#A9A9B8] mb-1">Weekly Total Fat</div>
                <div className="text-xl font-bold text-yellow-300">{weeklyMacros.fat.toLocaleString()}g</div>
                <div className="text-xs text-[#A9A9B8] mt-1">Avg: {avgDailyFat}g/day</div>
              </div>
            </div>
          </div>
        )}
        
        {/* TRIMP-style bars per day */}
        <div className="space-y-2">
          {dayNames.map((day, index) => {
            const maxLoad = Math.max(...dailyCalories);
            const load = dailyCalories[index];
            const width = maxLoad > 0 ? (load / maxLoad) * 100 : 0;
            
            return (
              <div key={day} className="flex items-center gap-2">
                <div className="w-12 text-xs font-medium text-[#FFFFFF]">{day}</div>
                <div className="flex-1 h-6 bg-[#2A2A35] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="w-16 text-xs text-right text-[#A9A9B8]">{load} kcal</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklySummary;
