import React from 'react';

interface AthleteProfileProps {
  weightKg: number;
  heightCm: number;
  bmr: number;
  baseActivity: number;
}

const AthleteProfile: React.FC<AthleteProfileProps> = ({ weightKg, heightCm, bmr, baseActivity }) => {
  return (
    <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
          Athlete Profile
        </h2>
        <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 mt-1">
          Basic info for calorie and macro calculations
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Weight</div>
          <div className="text-lg font-bold" style={{ color: '#006C3A' }}>{weightKg} kg</div>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Height</div>
          <div className="text-lg font-bold" style={{ color: '#006C3A' }}>{heightCm} cm</div>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">BMR</div>
          <div className="text-lg font-bold" style={{ color: '#006C3A' }}>{bmr} kcal</div>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="text-xs text-slate-600 dark:text-slate-400">Base Activity</div>
          <div className="text-lg font-bold" style={{ color: '#006C3A' }}>{baseActivity} kcal</div>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
        Note: Update your weight, height, and activity level in the Daily tab to adjust calculations.
      </p>
    </div>
  );
};

export default AthleteProfile;
