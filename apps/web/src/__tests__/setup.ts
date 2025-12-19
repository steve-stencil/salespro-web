import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env['NODE_ENV'] = 'test';

// Mock Vite environment
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: false,
    PROD: true,
    SSR: false,
  },
  writable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver - use class-based mock for better compatibility
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;
