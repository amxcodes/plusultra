
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cache, CACHE_KEYS } from './cache'

// Define the shape of our Profile
type Profile = {
    id: string
    username: string
    avatar_url: string
    role: 'user' | 'admin' | 'moderator'
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

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) fetchProfile(session.user.id)
            else setLoading(false)
        })

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user.id)
            } else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchProfile = async (userId: string) => {
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
                .select('id, username, avatar_url, role') // Only fetch needed fields
                .eq('id', userId)
                .single()

            if (error) {
                console.error('Error fetching profile:', error)
            } else {
                const profileData = data as Profile;
                setProfile(profileData);
                // Cache for 5 minutes in sessionStorage
                cache.set(CACHE_KEYS.USER_PROFILE, profileData, 5, true);
            }
        } catch (err) {
            console.error('Unexpected error fetching profile:', err)
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
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
