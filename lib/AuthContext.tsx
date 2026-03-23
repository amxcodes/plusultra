
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cache, CACHE_KEYS } from './cache'
import { setUserContext, clearUserContext } from './sentry'
import { APP_PRESENCE_HEARTBEAT_SECONDS, PresenceService, clearPresenceSessionId } from '../services/presence'

// Define the shape of our Profile
type Profile = {
    id: string
    username: string
    avatar_url: string
    role: 'user' | 'admin' | 'moderator'
    can_stream?: boolean
}

type AuthContextType = {
    session: Session | null
    user: User | null
    profile: Profile | null
    loading: boolean
    isAdmin: boolean
    refreshProfile: () => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const isEndingPresenceRef = useRef(false)

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) fetchProfile(session.user.id)
            else setLoading(false)
        })

        // 2. Listen for auth changes with explicit event handling
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] Auth state changed:', event);

            switch (event) {
                case 'SIGNED_IN':
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) fetchProfile(session.user.id);
                    break;

                case 'SIGNED_OUT':
                    // Clear all state and cache
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    cache.clearAll();
                    clearUserContext(); // Clear Sentry user context
                    clearPresenceSessionId();
                    setLoading(false);
                    break;

                case 'TOKEN_REFRESHED':
                    // Silent update, session is still valid
                    setSession(session);
                    break;

                case 'USER_UPDATED':
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        cache.invalidate(CACHE_KEYS.USER_PROFILE, true);
                        fetchProfile(session.user.id);
                    }
                    break;

                default:
                    // Handle any other events generically
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        fetchProfile(session.user.id);
                    } else {
                        setProfile(null);
                        setLoading(false);
                    }
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // 3. Realtime subscription for profile changes (e.g., admin grants streaming permission)
    useEffect(() => {
        if (!user?.id) return;

        console.log('[Auth] Setting up realtime subscription for user:', user.id);

        const channel = supabase
            .channel(`profile-changes-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    console.log('[Auth] Profile updated via realtime:', payload.new);

                    // Validate payload structure before using
                    const newProfile = payload.new;
                    const validRoles = ['user', 'admin', 'moderator'];

                    if (
                        newProfile &&
                        typeof newProfile === 'object' &&
                        typeof newProfile.id === 'string' &&
                        typeof newProfile.username === 'string' &&
                        typeof newProfile.role === 'string' &&
                        validRoles.includes(newProfile.role)
                    ) {
                        // Sanitize optional fields
                        const sanitizedProfile: Profile = {
                            id: newProfile.id,
                            username: newProfile.username,
                            avatar_url: typeof newProfile.avatar_url === 'string' ? newProfile.avatar_url : '',
                            role: newProfile.role as Profile['role'],
                            can_stream: typeof newProfile.can_stream === 'boolean' ? newProfile.can_stream : false
                        };

                        // Invalidate cache and update profile
                        cache.invalidate(CACHE_KEYS.USER_PROFILE, true);
                        setProfile(sanitizedProfile);
                    } else {
                        console.warn('[Auth] Received malformed profile update, ignoring:', newProfile);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Auth] Realtime subscription status:', status);
            });

        return () => {
            console.log('[Auth] Cleaning up realtime subscription');
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        const sendHeartbeat = () => {
            if (document.visibilityState !== 'visible' || !navigator.onLine) {
                return;
            }

            void PresenceService.trackHeartbeat();
        };

        sendHeartbeat();

        const interval = window.setInterval(sendHeartbeat, APP_PRESENCE_HEARTBEAT_SECONDS * 1000);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat();
            }
        };
        const handleFocus = () => {
            sendHeartbeat();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.id]);

    const fetchProfile = async (userId: string, retryCount = 0) => {
        const MAX_RETRIES = 3;

        try {
            // Check cache first (sessionStorage, 5 min TTL)
            const cachedProfile = cache.get<Profile>(CACHE_KEYS.USER_PROFILE, true);
            if (cachedProfile) {
                setProfile(cachedProfile);
                setLoading(false);
                return;
            }

            // Fetch from database
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, role, can_stream') // Include streaming permission
                .eq('id', userId)
                .single()

            if (error) {
                throw error; // Trigger retry logic
            }

            // Success - set profile and loading false
            const profileData = data as Profile;
            setProfile(profileData);
            setUserContext(profileData.id, profileData.username); // Set Sentry user context
            cache.set(CACHE_KEYS.USER_PROFILE, profileData, 5, true);
            setLoading(false); // Always set loading false on success
        } catch (err) {
            console.error(`Error fetching profile (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err);

            // Retry with exponential backoff
            if (retryCount < MAX_RETRIES - 1) {
                const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
                console.log(`[Auth] Retrying profile fetch in ${delay}ms...`);
                setTimeout(() => fetchProfile(userId, retryCount + 1), delay);
                return; // Don't set loading false - retry in progress
            }

            // All retries exhausted - set loading false
            console.error('[Auth] All retry attempts failed for profile fetch');
            setLoading(false);
        }
    }

    const signOut = async () => {
        if (!isEndingPresenceRef.current) {
            isEndingPresenceRef.current = true
            try {
                await PresenceService.endSession()
            } finally {
                isEndingPresenceRef.current = false
            }
        }
        await supabase.auth.signOut()
        setProfile(null)
        setUser(null)
        setSession(null)
        // Clear all cached data on logout
        cache.clearAll()
    }

    const refreshProfile = async () => {
        // Invalidate cache and force refresh
        cache.invalidate(CACHE_KEYS.USER_PROFILE, true)
        if (user) await fetchProfile(user.id)
    }

    const value = {
        session,
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        refreshProfile,
        signOut
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
