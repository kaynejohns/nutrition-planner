import React from 'react';

interface DailyCaloriesProps {
  dailyRestCalories: number;
  dailyTrainingCalories: number[];
  weightKg: number;
  carbsPerKg: number;
  proteinPerKg: number;
  fatPerKg: number;
}

const DailyCalories: React.FC<DailyCaloriesProps> = ({
  dailyRestCalories,
  dailyTrainingCalories,
  weightKg,
  carbsPerKg,
  proteinPerKg,
  fatPerKg
}) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const calculateMacros = (calories: number, carbsMultiplier: number) => {
    const carbs = Math.round(weightKg * carbsMultiplier);
    const protein = Math.round(weightKg * proteinPerKg);
    const fat = Math.round((calories - (carbs * 4) - (protein * 4)) / 9);
    return { carbs, protein, fat };
  };
  
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#FFFFFF] mb-1 uppercase tracking-tight">DAILY CALORIES</h2>
        <p className="text-sm text-[#A9A9B8]">Total calories per day (resting + training)</p>
      </div>
      
      <div className="space-y-3">
        {days.map((day, index) => {
          const trainingKcal = dailyTrainingCalories[index] || 0;
          const totalKcal = dailyRestCalories + trainingKcal;
          
          const underfuelKcal = Math.round(totalKcal * 0.85);
          const optimalKcal = totalKcal;
          const overfuelKcal = Math.round(totalKcal * 1.10);
          
          const underfuelMacros = calculateMacros(underfuelKcal, 5.0);
          const optimalMacros = calculateMacros(optimalKcal, carbsPerKg);
          const overfuelMacros = calculateMacros(overfuelKcal, 8.0);
          
          return (
            <div key={day} className="bg-[#24242A] border border-[#2A2A35] rounded-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#FFFFFF]">{day}</h3>
                <div className="flex gap-3 text-sm">
                  <span className="text-[#A9A9B8]">Rest: {dailyRestCalories} kcal</span>
                  <span className="text-emerald-300">Training: {trainingKcal} kcal</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Underfueling */}
                <div className="bg-red-900/20 border border-red-800 rounded-card p-3">
                  <div className="text-xs font-semibold text-red-300 mb-1">Underfueling (&lt;85%)</div>
                  <div className="text-lg font-bold text-red-300 mb-2">{underfuelKcal} kcal</div>
                  <div className="space-y-1 text-xs text-[#A9A9B8]">
                    <div>C: {underfuelMacros.carbs}g</div>
                    <div>P: {underfuelMacros.protein}g</div>
                    <div>F: {underfuelMacros.fat}g</div>
                  </div>
                </div>
                
                {/* Optimal */}
                <div className="bg-green-900/20 border border-green-800 rounded-card p-3">
                  <div className="text-xs font-semibold text-green-300 mb-1">Optimal (100%)</div>
                  <div className="text-lg font-bold text-green-300 mb-2">{optimalKcal} kcal</div>
                  <div className="space-y-1 text-xs text-[#A9A9B8]">
                    <div>C: {optimalMacros.carbs}g</div>
                    <div>P: {optimalMacros.protein}g</div>
                    <div>F: {optimalMacros.fat}g</div>
                  </div>
                </div>
                
                {/* Overfueling */}
                <div className="bg-amber-900/20 border border-amber-800 rounded-card p-3">
                  <div className="text-xs font-semibold text-amber-300 mb-1">Overfueling (&gt;110%)</div>
                  <div className="text-lg font-bold text-amber-300 mb-2">{overfuelKcal} kcal</div>
                  <div className="space-y-1 text-xs text-[#A9A9B8]">
                    <div>C: {overfuelMacros.carbs}g</div>
                    <div>P: {overfuelMacros.protein}g</div>
                    <div>F: {overfuelMacros.fat}g</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailyCalories;

