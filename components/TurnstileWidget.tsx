import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

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
        const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
        const isDesktop = Boolean(window.desktop?.isDesktop);
        const desktopTurnstileDisabled = isDesktop && import.meta.env.VITE_DESKTOP_DISABLE_TURNSTILE === 'true';
        const containerRef = useRef<HTMLDivElement | null>(null);
        const widgetIdRef = useRef<string | null>(null);
        const desktopRequestIdRef = useRef<string | null>(null);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
        const [desktopStatus, setDesktopStatus] = useState<'idle' | 'waiting' | 'verified'>('idle');

        useImperativeHandle(ref, () => ({
            reset: () => {
                onTokenChange(null);
                setLoadError(null);
                setLastErrorCode(null);
                setDesktopStatus('idle');
                desktopRequestIdRef.current = null;
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current);
                }
            }
        }), [onTokenChange]);

        useEffect(() => {
            if (isDesktop || desktopTurnstileDisabled) {
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
                            setLoadError(`Security check failed${formattedCode ? ` (${formattedCode})` : ''}. Try refreshing the widget or using a different browser/network.`);
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
        }, [action, desktopTurnstileDisabled, isDesktop, onTokenChange, siteKey]);

        useEffect(() => {
            if (!isDesktop || !window.desktop || desktopTurnstileDisabled) {
                return;
            }

            const unsubscribe = window.desktop.onTurnstileToken((payload) => {
                if (!desktopRequestIdRef.current || payload.requestId !== desktopRequestIdRef.current) {
                    return;
                }

                desktopRequestIdRef.current = null;
                onTokenChange(payload.token);
                setLoadError(null);
                setLastErrorCode(null);
                setDesktopStatus('verified');
            });

            return () => {
                unsubscribe();
            };
        }, [desktopTurnstileDisabled, isDesktop, onTokenChange]);

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

        if (isDesktop) {
            return (
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={async () => {
                            if (!window.desktop) return;
                            onTokenChange(null);
                            setLoadError(null);
                            setLastErrorCode(null);
                            setDesktopStatus('waiting');
                            desktopRequestIdRef.current = null;

                            const result = await window.desktop.startTurnstileCheck({ action, siteKey });
                            if (!result.ok || !result.requestId) {
                                setDesktopStatus('idle');
                                setLoadError(result.message || 'Security check failed to open in the browser.');
                                return;
                            }

                            desktopRequestIdRef.current = result.requestId;
                        }}
                        className={`w-full rounded-md border px-3 py-2 text-sm font-medium transition-colors ${desktopStatus === 'verified'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
                    >
                        {desktopStatus === 'waiting'
                            ? 'Waiting for browser verification...'
                            : desktopStatus === 'verified'
                                ? 'Security check complete'
                                : 'Open security check in browser'}
                    </button>
                    {loadError && (
                        <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                            {loadError}
                        </p>
                    )}
                    {desktopStatus === 'waiting' && !loadError && (
                        <p className="text-[11px] text-zinc-400 bg-white/5 border border-white/10 rounded-md px-3 py-2">
                            The security check opened in your default browser. Complete it there, then return to the desktop app.
                        </p>
                    )}
                    {desktopStatus === 'verified' && (
                        <button
                            type="button"
                            onClick={() => {
                                onTokenChange(null);
                                setLoadError(null);
                                setLastErrorCode(null);
                                setDesktopStatus('idle');
                                desktopRequestIdRef.current = null;
                            }}
                            className="text-[11px] text-white/80 hover:text-white underline underline-offset-2"
                        >
                            Run security check again
                        </button>
                    )}
                </div>
            );
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
