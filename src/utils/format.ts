// Utility functions for formatting numbers with smart unit conversion

export const formatMl = (ml: number): string => {
  if (ml >= 1000) {
    return `${(ml / 1000).toFixed(1)} L`;
  }
  return `${ml} ml`;
};

export const formatMg = (mg: number): string => {
  if (mg >= 1000) {
    return `${Math.round(mg / 1000)} g`;
  }
  return `${mg} mg`;
};

export const formatG = (g: number): string => {
  return `${Math.round(g)} g`;
};

