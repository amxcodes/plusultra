/**
 * Sentry Error Monitoring Configuration
 * Captures and reports errors to Sentry dashboard
 */

import * as Sentry from '@sentry/react';

// Only initialize in production to avoid polluting dev environment
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export const initSentry = () => {
    if (!SENTRY_DSN) {
        console.log('[Sentry] DSN not configured, error monitoring disabled');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE, // 'development' or 'production'

        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

        // Error Sampling
        sampleRate: 1.0, // Capture 100% of errors

        // Release tracking (set via build pipeline)
        release: import.meta.env.VITE_APP_VERSION || 'dev',

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true, // Privacy: mask all text in replays
                blockAllMedia: true, // Privacy: block media in replays
            }),
        ],

        // Session Replay sampling
        replaysSessionSampleRate: 0.1, // 10% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

        // Filter out noisy errors
        ignoreErrors: [
            // Network errors (expected in flaky connections)
            'AbortError',
            'NetworkError',
            'Failed to fetch',
            // Third-party extension errors
            /^chrome-extension:\/\//,
            /^moz-extension:\/\//,
        ],

        // Before sending, sanitize sensitive data
        beforeSend(event) {
            // Remove user email from breadcrumbs if present
            if (event.user) {
                delete event.user.email;
            }
            return event;
        },
    });

    console.log('[Sentry] Initialized error monitoring');
};

// Helper to capture errors with context
export const captureError = (error: Error, context?: Record<string, any>) => {
    if (!SENTRY_DSN) {
        console.error('[Error]', error, context);
        return;
    }

    Sentry.withScope((scope) => {
        if (context) {
            Object.entries(context).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }
        Sentry.captureException(error);
    });
};

// Set user context when authenticated
export const setUserContext = (userId: string, username?: string) => {
    if (!SENTRY_DSN) return;

    Sentry.setUser({
        id: userId,
        username: username,
    });
};

// Clear user context on logout
export const clearUserContext = () => {
    if (!SENTRY_DSN) return;
    Sentry.setUser(null);
};

// Re-export Sentry for advanced usage
export { Sentry };
