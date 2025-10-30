export type Macros = { carbs_g: number; protein_g: number; fat_g: number };

export const sumMacros = (a: Macros, b: Macros): Macros => ({
  carbs_g: a.carbs_g + b.carbs_g,
  protein_g: a.protein_g + b.protein_g,
  fat_g: a.fat_g + b.fat_g,
});

export const scaleMacros = (m: Macros, factor: number): Macros => ({
  carbs_g: Math.round(m.carbs_g * factor),
  protein_g: Math.round(m.protein_g * factor),
  fat_g: Math.round(m.fat_g * factor),
});

export const macrosFromKcalDefault = (kcal: number): Macros => {
  const carbsK = kcal * 0.50;
  const proteinK = kcal * 0.20;
  const fatK = kcal * 0.30;
  return {
    carbs_g: Math.round(carbsK / 4),
    protein_g: Math.round(proteinK / 4),
    fat_g: Math.round(fatK / 9),
  };
};

