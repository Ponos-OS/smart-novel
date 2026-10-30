import '@testing-library/jest-dom/vitest';
import * as matchers from 'jest-extended';
import { expect, vi } from 'vitest';

expect.extend(matchers);

// Mock getBoundingClientRect for Range objects (needed for DOM selection tests)
Range.prototype.getBoundingClientRect = vi.fn(() => ({
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  top: 0,
  right: 100,
  bottom: 20,
  left: 0,
  toJSON: () => {},
}));

// jsdom lacks what Radix primitives use for pointer handling and scrolling.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
