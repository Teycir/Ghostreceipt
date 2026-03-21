/**
 * @jest-environment jsdom
 */
import { announceToScreenReader, trapFocus } from '@/lib/accessibility';

describe('Accessibility Utilities', () => {
  describe('announceToScreenReader', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should create announcement element with correct attributes', () => {
      announceToScreenReader('Test message');

      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeTruthy();
      expect(announcement?.getAttribute('aria-live')).toBe('polite');
      expect(announcement?.getAttribute('aria-atomic')).toBe('true');
      expect(announcement?.textContent).toBe('Test message');
    });

    it('should remove announcement after timeout', (done) => {
      jest.useFakeTimers();
      announceToScreenReader('Test message');

      jest.advanceTimersByTime(1100);

      const announcement = document.querySelector('[role="status"]');
      expect(announcement).toBeNull();
      
      jest.useRealTimers();
      done();
    });
  });

  describe('trapFocus', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="container">
          <button id="first">First</button>
          <button id="middle">Middle</button>
          <button id="last">Last</button>
        </div>
      `;
    });

    it('should focus first element on initialization', () => {
      const container = document.getElementById('container') as HTMLElement;
      trapFocus(container);

      expect(document.activeElement?.id).toBe('first');
    });

    it('should trap focus within container', () => {
      const container = document.getElementById('container') as HTMLElement;
      const cleanup = trapFocus(container);

      const lastButton = document.getElementById('last') as HTMLElement;
      lastButton.focus();

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      container.dispatchEvent(tabEvent);

      cleanup();
    });

    it('should cleanup event listeners', () => {
      const container = document.getElementById('container') as HTMLElement;
      const cleanup = trapFocus(container);

      const removeEventListenerSpy = jest.spyOn(container, 'removeEventListener');
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });
});
