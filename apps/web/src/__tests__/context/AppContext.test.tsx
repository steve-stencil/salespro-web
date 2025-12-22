/**
 * Unit tests for AppContext.
 */
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AppProvider, useAppContext, APP_INFO } from '../../context/AppContext';

import type { ReactNode } from 'react';

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper(initialRoute = '/') {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        <AppProvider>{children}</AppProvider>
      </MemoryRouter>
    );
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AppContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('useAppContext', () => {
    it('should throw error when used outside AppProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAppContext());
      }).toThrow('useAppContext must be used within an AppProvider');

      consoleSpy.mockRestore();
    });

    it('should provide context values when used inside AppProvider', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.activeApp).toBeDefined();
      expect(result.current.setActiveApp).toBeInstanceOf(Function);
      expect(result.current.getAppInfo).toBeInstanceOf(Function);
      expect(result.current.apps).toBeDefined();
    });
  });

  describe('activeApp detection', () => {
    it('should default to web app on root path', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.activeApp).toBe('web');
    });

    it('should detect mobile app from /mobile routes', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/mobile/contracts'),
      });

      expect(result.current.activeApp).toBe('mobile');
    });

    it('should detect mobile app from /mobile/drafts route', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/mobile/drafts'),
      });

      expect(result.current.activeApp).toBe('mobile');
    });

    it('should detect web app from /dashboard route', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/dashboard'),
      });

      expect(result.current.activeApp).toBe('web');
    });

    it('should detect web app from /users route', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/users'),
      });

      expect(result.current.activeApp).toBe('web');
    });
  });

  describe('setActiveApp', () => {
    it('should update activeApp when called', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setActiveApp('mobile');
      });

      expect(result.current.activeApp).toBe('mobile');
    });

    it('should persist to localStorage when called', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setActiveApp('mobile');
      });

      expect(localStorage.getItem('salespro:lastActiveApp')).toBe('mobile');
    });
  });

  describe('localStorage persistence', () => {
    it('should restore last active app from localStorage on root path', () => {
      localStorage.setItem('salespro:lastActiveApp', 'mobile');

      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.activeApp).toBe('mobile');
    });

    it('should prefer route-based detection over localStorage', () => {
      localStorage.setItem('salespro:lastActiveApp', 'mobile');

      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper('/dashboard'),
      });

      expect(result.current.activeApp).toBe('web');
    });
  });

  describe('getAppInfo', () => {
    it('should return web app info', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper(),
      });

      const webInfo = result.current.getAppInfo('web');

      expect(webInfo.id).toBe('web');
      expect(webInfo.name).toBe('Dashboard');
      expect(webInfo.rootPath).toBe('/dashboard');
    });

    it('should return mobile app info', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper(),
      });

      const mobileInfo = result.current.getAppInfo('mobile');

      expect(mobileInfo.id).toBe('mobile');
      expect(mobileInfo.name).toBe('Contracts');
      expect(mobileInfo.rootPath).toBe('/mobile/contracts');
    });
  });

  describe('apps list', () => {
    it('should return all available apps', () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.apps).toHaveLength(2);
      expect(result.current.apps).toEqual(Object.values(APP_INFO));
    });
  });
});
