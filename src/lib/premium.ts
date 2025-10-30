// src/lib/premium.ts
import { currentUser } from './auth';

// Check if the current user has premium access
export async function isPremium(): Promise<boolean> {
  const user = currentUser();
  if (!user) return false;

  try {
    const response = await fetch(`/.netlify/functions/check-premium?userId=${user.id}`);
    const data = await response.json();
    return data.isPremium || false;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
}

// Get premium status for a specific user ID
export async function getPremiumStatus(userId: string): Promise<any> {
  try {
    const response = await fetch(`/.netlify/functions/check-premium?userId=${userId}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting premium status:', error);
    return { isPremium: false };
  }
}

