// src/lib/auth.ts
import netlifyIdentity from 'netlify-identity-widget';

export function initIdentity() {
  if (typeof window !== 'undefined') {
    netlifyIdentity.on('init', user => console.log('Identity init', user));
    netlifyIdentity.on('login', () => window.location.reload());
    netlifyIdentity.on('logout', () => window.location.reload());
    netlifyIdentity.init();
  }
}

export function currentUser() {
  // returns null if logged out
  // @ts-ignore
  return window?.netlifyIdentity?.currentUser() || null;
}

export async function requireLogin(): Promise<any> {
  // @ts-ignore
  const id = window?.netlifyIdentity;
  if (!id?.currentUser()) {
    id?.open('login');
    await new Promise<void>(resolve => id?.on('login', () => resolve()));
  }
  return id?.currentUser();
}

export function checkPremium(): boolean {
  const user = currentUser();
  return user?.app_metadata?.isPremium || 
         user?.app_metadata?.roles?.includes('premium') || 
         false;
}

