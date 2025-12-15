/**
 * Custom hook to access auth context.
 * Must be used within an AuthProvider.
 */
import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

import type { AuthContextType } from '../types/auth';

/**
 * Hook to access auth context.
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
