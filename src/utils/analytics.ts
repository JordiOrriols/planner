/**
 * Umami Analytics Utility
 *
 * This module provides a centralized way to track events with Umami analytics.
 * @see https://umami.is/docs/track-events
 */

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

export type AnalyticsEventData = Record<string, string | number | boolean>;

/**
 * Track an event with Umami analytics
 * @param eventId - The unique identifier for the event (e.g., "button_click_save")
 * @param eventData - Optional additional data to send with the event
 */
export function trackEvent(eventId: string, eventData?: AnalyticsEventData): void {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(eventId, eventData);
  } else if (import.meta.env.DEV) {
    // Log in development mode when Umami is not available
    console.debug("[Analytics]", eventId, eventData);
  }
}

/**
 * Track a button click event
 * @param eventId - The unique identifier for the button event
 * @param additionalData - Optional additional data to send with the event
 */
export function trackButtonClick(eventId: string, additionalData?: AnalyticsEventData): void {
  trackEvent(eventId, {
    type: "button_click",
    ...additionalData,
  });
}
