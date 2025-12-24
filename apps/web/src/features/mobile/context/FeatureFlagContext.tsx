/**
 * Feature flag context for LaunchDarkly integration.
 * Provides feature flags throughout the app with offline fallback.
 */
import { createContext, useContext, useState, useEffect } from 'react';

import { DEFAULT_FEATURE_FLAGS } from '../types/feature-flags';

import type {
  ContractFeatureFlags,
  LaunchDarklyContext,
} from '../types/feature-flags';
import type { ReactNode } from 'react';

type FeatureFlagContextValue = {
  flags: ContractFeatureFlags;
  isLoading: boolean;
  isReady: boolean;
  /**
   * Check if a specific flag is enabled.
   */
  isEnabled: (flagKey: keyof ContractFeatureFlags) => boolean;
  /**
   * Update user context for flag evaluation.
   */
  identify: (context: LaunchDarklyContext) => Promise<void>;
};

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

type FeatureFlagProviderProps = {
  children: ReactNode;
  /**
   * LaunchDarkly client-side SDK key.
   * Falls back to VITE_LAUNCHDARKLY_CLIENT_ID env var.
   */
  clientSideId?: string;
};

/**
 * Provider component for feature flags.
 * Initializes LaunchDarkly client and provides flag values.
 */
export function FeatureFlagProvider({
  children,
  clientSideId,
}: FeatureFlagProviderProps): React.ReactElement {
  const [flags] = useState<ContractFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Initialize LaunchDarkly on mount
  useEffect(() => {
    const initializeLaunchDarkly = (): void => {
      try {
        const sdkKey =
          clientSideId ?? import.meta.env['VITE_LAUNCHDARKLY_CLIENT_ID'];

        if (!sdkKey) {
          // No SDK key - use defaults
          console.warn(
            'No LaunchDarkly client ID configured, using default flags',
          );
          setIsReady(true);
          setIsLoading(false);
          return;
        }

        // TODO: Initialize LaunchDarkly React SDK when ready
        // For now, use default flags
        setIsReady(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize LaunchDarkly:', error);
        // Fall back to defaults on error
        setIsReady(true);
        setIsLoading(false);
      }
    };

    initializeLaunchDarkly();
  }, [clientSideId]);

  /**
   * Check if a specific flag is enabled.
   */
  const isEnabled = (flagKey: keyof ContractFeatureFlags): boolean => {
    return flags[flagKey];
  };

  /**
   * Update user context for flag evaluation.
   */
  const identify = (_context: LaunchDarklyContext): Promise<void> => {
    // TODO: Implement LaunchDarkly identify when SDK is integrated
    // This will re-evaluate flags for the new user context
    return Promise.resolve();
  };

  const value: FeatureFlagContextValue = {
    flags,
    isLoading,
    isReady,
    isEnabled,
    identify,
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flags.
 * @throws Error if used outside of FeatureFlagProvider.
 */
export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error(
      'useFeatureFlags must be used within a FeatureFlagProvider',
    );
  }
  return context;
}
