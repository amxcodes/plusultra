import { supabase } from '../lib/supabase';

export interface HealthStatus {
    service: string;
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    error?: string;
    lastChecked: number;
}

export class HealthService {
    /**
     * Check database connectivity
     */
    static async checkDatabase(): Promise<HealthStatus> {
        const startTime = Date.now();
        const lastChecked = startTime;

        try {
            const { error } = await supabase
                .from('profiles')
                .select('id')
                .limit(1);

            const responseTime = Date.now() - startTime;

            if (error) {
                return {
                    service: 'Database',
                    status: 'down',
                    responseTime,
                    error: error.message,
                    lastChecked
                };
            }

            return {
                service: 'Database',
                status: responseTime < 200 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked
            };
        } catch (error: any) {
            return {
                service: 'Database',
                status: 'down',
                responseTime: Date.now() - startTime,
                error: error.message || 'Unknown error',
                lastChecked
            };
        }
    }

    /**
     * Check authentication service
     */
    static async checkAuth(): Promise<HealthStatus> {
        const startTime = Date.now();
        const lastChecked = startTime;

        try {
            const { data, error } = await supabase.auth.getSession();
            const responseTime = Date.now() - startTime;

            if (error) {
                return {
                    service: 'Authentication',
                    status: 'down',
                    responseTime,
                    error: error.message,
                    lastChecked
                };
            }

            return {
                service: 'Authentication',
                status: responseTime < 200 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked
            };
        } catch (error: any) {
            return {
                service: 'Authentication',
                status: 'down',
                responseTime: Date.now() - startTime,
                error: error.message || 'Unknown error',
                lastChecked
            };
        }
    }

    /**
     * Check critical RPC functions used for viewing/session tracking.
     */
    static async checkRPC(): Promise<HealthStatus> {
        const startTime = Date.now();
        const lastChecked = startTime;

        try {
            const { error } = await supabase.rpc('heartbeat_view_session', {
                p_session_id: '_health_check_',
                p_tmdb_id: '_health_check_',
                p_media_type: 'movie',
                p_provider_id: 'health',
                p_title: 'Health Check',
                p_genres: [],
                p_heartbeat_seconds: 30
            });

            const responseTime = Date.now() - startTime;

            // If function doesn't exist, we get a specific error
            if (error && error.message.includes('undefined_function')) {
                return {
                    service: 'RPC Functions',
                    status: 'down',
                    responseTime,
                    error: 'heartbeat_view_session function not found',
                    lastChecked
                };
            }

            // Any other error is OK (function exists and was called)
            return {
                service: 'RPC Functions',
                status: responseTime < 300 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked
            };
        } catch (error: any) {
            // If error is 404 or "function not found", mark as down
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                return {
                    service: 'RPC Functions',
                    status: 'down',
                    responseTime: Date.now() - startTime,
                    error: 'RPC endpoint not accessible',
                    lastChecked
                };
            }

            return {
                service: 'RPC Functions',
                status: 'degraded',
                responseTime: Date.now() - startTime,
                error: error.message,
                lastChecked
            };
        }
    }

    /**
     * Check Supabase Storage
     */
    static async checkStorage(): Promise<HealthStatus> {
        const startTime = Date.now();
        const lastChecked = startTime;

        try {
            // Try to list buckets
            const { data, error } = await supabase.storage.listBuckets();
            const responseTime = Date.now() - startTime;

            if (error) {
                return {
                    service: 'Storage',
                    status: 'down',
                    responseTime,
                    error: error.message,
                    lastChecked
                };
            }

            return {
                service: 'Storage',
                status: responseTime < 200 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked
            };
        } catch (error: any) {
            return {
                service: 'Storage',
                status: 'down',
                responseTime: Date.now() - startTime,
                error: error.message || 'Unknown error',
                lastChecked
            };
        }
    }

    /**
     * Check Realtime connections
     */
    static async checkRealtime(): Promise<HealthStatus> {
        const startTime = Date.now();
        const lastChecked = startTime;

        try {
            // Check if realtime is initialized
            const channel = supabase.channel('health_check');

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);

                channel.subscribe((status) => {
                    clearTimeout(timeout);
                    if (status === 'SUBSCRIBED') {
                        resolve();
                    } else {
                        reject(new Error(`Subscription failed: ${status}`));
                    }
                });
            });

            supabase.removeChannel(channel);
            const responseTime = Date.now() - startTime;

            return {
                service: 'Realtime',
                status: responseTime < 500 ? 'healthy' : 'degraded',
                responseTime,
                lastChecked
            };
        } catch (error: any) {
            return {
                service: 'Realtime',
                status: 'degraded',
                responseTime: Date.now() - startTime,
                error: error.message || 'Realtime not available',
                lastChecked
            };
        }
    }

    /**
     * Run all health checks
     */
    static async checkAll(): Promise<HealthStatus[]> {
        const results = await Promise.all([
            this.checkDatabase(),
            this.checkAuth(),
            this.checkRPC(),
            this.checkStorage(),
            this.checkRealtime()
        ]);

        return results;
    }

    /**
     * Get overall system status
     */
    static getOverallStatus(checks: HealthStatus[]): 'healthy' | 'degraded' | 'down' {
        const hasDown = checks.some(c => c.status === 'down');
        const hasDegraded = checks.some(c => c.status === 'degraded');

        if (hasDown) return 'down';
        if (hasDegraded) return 'degraded';
        return 'healthy';
    }
}
