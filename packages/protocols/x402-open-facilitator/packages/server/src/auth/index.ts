import { auth } from './config.js';

// Re-export for use
export { auth };
export default auth;

let initialized = false;

export function initializeAuth(_dbPath?: string): void {
  if (initialized) return;
  initialized = true;
  console.log('✅ Better Auth initialized');
}

export function getAuth(): typeof auth {
  return auth;
}
