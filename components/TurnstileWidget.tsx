import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { env, getTurnstileClientErrorMessage } from '../lib/env';

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: Record<string, any>) => string;
            remove: (widgetId: string) => void;
            reset: (widgetId?: string) => void;
        };
    }
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export type TurnstileWidgetHandle = {
    reset: () => void;
};

interface TurnstileWidgetProps {
    onTokenChange: (token: string | null) => void;
    action?: string;
}

const loadTurnstileScript = () => {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.turnstile) return Promise.resolve();

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
        return new Promise<void>((resolve, reject) => {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once: true });
        });
    }

    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Turnstile failed to load'));
        document.head.appendChild(script);
    });
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
    ({ onTokenChange, action = 'auth' }, ref) => {
        const siteKey = env.turnstileSiteKey;
        const desktopTurnstileDisabled = Boolean(window.desktop?.isDesktop) && env.desktopDisableTurnstile;
        const containerRef = useRef<HTMLDivElement | null>(null);
        const widgetIdRef = useRef<string | null>(null);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

        useImperativeHandle(ref, () => ({
            reset: () => {
                onTokenChange(null);
                setLoadError(null);
                setLastErrorCode(null);
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            }
        }), [onTokenChange]);

        useEffect(() => {
            if (desktopTurnstileDisabled) {
                return;
            }
            if (!siteKey || !containerRef.current) return;

            let isCancelled = false;

            const renderWidget = async () => {
                try {
                    await loadTurnstileScript();
                    if (isCancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

                    widgetIdRef.current = window.turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        theme: 'dark',
                        action,
                        retry: 'auto',
                        'retry-interval': 8000,
                        callback: (token: string) => onTokenChange(token),
                        'expired-callback': () => onTokenChange(null),
                        'timeout-callback': () => onTokenChange(null),
                        'error-callback': (errorCode: string | number) => {
                            onTokenChange(null);
                            const formattedCode = String(errorCode);
                            console.error('Turnstile error:', formattedCode);
                            setLastErrorCode(formattedCode);
                            setLoadError(getTurnstileClientErrorMessage(formattedCode));
                        },
                    });
                } catch (error) {
                    if (!isCancelled) {
                        console.error(error);
                        setLoadError('Security check failed to load. Please reload and try again.');
                    }
                }
            };

            void renderWidget();

            return () => {
                isCancelled = true;
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.remove(widgetIdRef.current);
                    widgetIdRef.current = null;
                }
            };
        }, [action, desktopTurnstileDisabled, onTokenChange, siteKey]);

        if (desktopTurnstileDisabled) {
            return (
                <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                    Desktop auth is using the app-side verification path instead of Cloudflare Turnstile.
                </div>
            );
        }

        if (!siteKey) {
            return null;
        }

        return (
            <div className="space-y-2">
                <div ref={containerRef} className="min-h-[65px]" />
                {loadError && (
                    <div className="space-y-2">
                        <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                            {loadError}
                        </p>
                        <div className="flex items-center justify-between gap-3">
                            {lastErrorCode && (
                                <span className="text-[10px] text-zinc-500">
                                    Turnstile code: <code>{lastErrorCode}</code>
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setLoadError(null);
                                    setLastErrorCode(null);
                                    onTokenChange(null);
                                    if (widgetIdRef.current && window.turnstile) {
                                        window.turnstile.reset(widgetIdRef.current);
                                    }
                                }}
                                className="text-[11px] text-white/80 hover:text-white underline underline-offset-2"
                            >
                                Retry security check
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
);

TurnstileWidget.displayName = 'TurnstileWidget';
