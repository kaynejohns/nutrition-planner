import React from 'react';

interface WeeklySummaryProps {
  dailyCalories: number[];
  dailyTrainingCalories: number[];
  weightKg: number;
  carbsPerKg: number;
  proteinPerKg: number;
  fatPerKg: number;
}

const WeeklySummary: React.FC<WeeklySummaryProps> = ({
  dailyCalories,
  dailyTrainingCalories,
  weightKg,
  carbsPerKg,
  proteinPerKg,
  fatPerKg
}) => {
  const weekTotal = dailyCalories.reduce((sum, cal) => sum + cal, 0);
  const avgDaily = Math.round(weekTotal / 7);
  const totalTraining = dailyTrainingCalories.reduce((sum, cal) => sum + cal, 0);
  
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Weekly Summary</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">Training load and fueling overview</p>
      </div>
      
      {/* Weekly Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Total Calories</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{weekTotal.toLocaleString()} kcal</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Avg Daily</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{avgDaily} kcal</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Training Load</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalTraining} kcal</div>
        </div>
      </div>
      
      {/* Daily Calorie Breakdown with Underfuel/Optimal/Overfuel */}
      <div>
        <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-slate-100">Daily Fueling Scenarios</h3>
        <div className="space-y-2">
          {days.map((day, index) => {
            const totalCal = dailyCalories[index];
            const underfuel = Math.round(totalCal * 0.85);
            const optimal = totalCal;
            const overfuel = Math.round(totalCal * 1.10);
            
            const underfuelCarbs = Math.round(weightKg * 5);
            const optimalCarbs = Math.round(weightKg * carbsPerKg);
            const overfuelCarbs = Math.round(weightKg * 8);
            
            return (
              <div key={day} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                <div className="font-semibold mb-2 text-slate-800 dark:text-slate-200">{day}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {/* Underfueling */}
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                    <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Underfueling</div>
                    <div className="text-xs text-red-600 dark:text-red-400 mb-1">{underfuel} kcal</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">C: {underfuelCarbs}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">P: {Math.round(weightKg * proteinPerKg)}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">F: {Math.round(((underfuel - (underfuelCarbs * 4) - (Math.round(weightKg * proteinPerKg) * 4)) / 9))}g</div>
                  </div>
                  
                  {/* Optimal */}
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                    <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Optimal</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">{optimal} kcal</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">C: {optimalCarbs}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">P: {Math.round(weightKg * proteinPerKg)}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">F: {Math.round(((optimal - (optimalCarbs * 4) - (Math.round(weightKg * proteinPerKg) * 4)) / 9))}g</div>
                  </div>
                  
                  {/* Overfueling */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                    <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Overfueling</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">{overfuel} kcal</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">C: {overfuelCarbs}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">P: {Math.round(weightKg * proteinPerKg)}g</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">F: {Math.round(((overfuel - (overfuelCarbs * 4) - (Math.round(weightKg * proteinPerKg) * 4)) / 9))}g</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklySummary;
