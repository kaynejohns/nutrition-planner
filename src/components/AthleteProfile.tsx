import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => (
  <div className="text-center p-3 bg-[#24242A] rounded-card border border-[#2A2A35]">
    <div className="text-xs text-[#A9A9B8] mb-1">{label}</div>
    <div className="text-lg sm:text-xl font-bold text-emerald-300">{value}</div>
  </div>
);

interface AthleteProfileProps {
  weightKg: number;
  heightCm: number;
  bmr: number;
  baseActivity: number;
}

const AthleteProfile: React.FC<AthleteProfileProps> = ({ weightKg, heightCm, bmr, baseActivity }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#FFFFFF] mb-1 uppercase tracking-tight">ATHLETE PROFILE</h2>
        <p className="text-sm text-[#A9A9B8]">Basic info for calorie and macro calculations</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Weight" value={`${weightKg} kg`} />
        <StatCard label="Height" value={`${heightCm} cm`} />
        <StatCard label="BMR" value={`${bmr} kcal`} />
        <StatCard label="Base Activity" value={`${baseActivity} kcal`} />
      </div>
      
      <p className="text-xs text-[#A9A9B8]">
        Note: Update your weight, height, and activity level in the Daily tab to adjust calculations.
      </p>
    </div>
  );
};

export default AthleteProfile;
