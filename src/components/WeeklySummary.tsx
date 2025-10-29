import React from 'react';

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
  doubleDays = 2
}) => {
  const weekTotal = dailyCalories.reduce((sum, cal) => sum + cal, 0);
  const avgDaily = Math.round(weekTotal / 7);
  const totalTraining = dailyTrainingCalories.reduce((sum, cal) => sum + cal, 0);
  const totalResting = weekTotal - totalTraining;
  const totalTrainingTime = dailyTrainingTime.reduce((sum, min) => sum + min, 0);
  const peakDay = Math.max(...dailyCalories);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Weekly Summary</h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Compare your weekly calorie targets</p>
      </div>
      
      {/* Training Snapshot */}
      <div>
        <h3 className="text-base sm:text-lg font-bold mb-3 text-slate-900 dark:text-slate-100">Training Snapshot</h3>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="grid grid-cols-7 gap-2 mb-4 min-w-[560px]">
            {dayNames.map((day, index) => {
              const hasTraining = dailyTrainingCalories[index] > 0;
              return (
                <div key={day} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{day}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {hasTraining ? 'Key' : 'Rest'}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {dailyCalories[index]} kcal
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    T: {dailyTrainingCalories[index]} kcal
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Training Time</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{totalTrainingTime} min</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Training Days</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{trainingDays} days</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Double Days</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{doubleDays} days</div>
          </div>
        </div>
      </div>
      
      {/* Training Load & Distribution */}
      <div>
        <h3 className="text-base sm:text-lg font-bold mb-3 text-slate-900 dark:text-slate-100">Weekly Energy Summary</h3>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Weekly Total</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{weekTotal.toLocaleString()} kcal</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Daily Average</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{avgDaily} kcal</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Peak Day</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{peakDay} kcal</div>
          </div>
        </div>
        
        {/* Breakdown */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Resting Energy (Non-Training)</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalResting.toLocaleString()} kcal</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Average: {Math.round(totalResting / 7)} kcal/day</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Training Energy</div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalTraining.toLocaleString()} kcal</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Average: {Math.round(totalTraining / 7)} kcal/day</div>
          </div>
        </div>
        
        {/* TRIMP-style bars per day */}
        <div className="space-y-2">
          {dayNames.map((day, index) => {
            const maxLoad = Math.max(...dailyCalories);
            const load = dailyCalories[index];
            const width = maxLoad > 0 ? (load / maxLoad) * 100 : 0;
            
            return (
              <div key={day} className="flex items-center gap-2">
                <div className="w-12 text-xs font-medium text-slate-700 dark:text-slate-300">{day}</div>
                <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="w-16 text-xs text-right text-slate-600 dark:text-slate-400">{load} kcal</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklySummary;
