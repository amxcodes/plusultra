import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { cache } from '../../lib/cache';
import * as Sentry from '../../lib/sentry';
import React from 'react';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            signOut: vi.fn()
        },
        rpc: vi.fn(),
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn()
        })),
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn()
        })),
        removeChannel: vi.fn()
    }
}));

vi.mock('../../lib/cache', () => ({
    cache: {
        get: vi.fn(),
        set: vi.fn(),
        clearAll: vi.fn(),
        invalidate: vi.fn()
    },
    CACHE_KEYS: { USER_PROFILE: 'user_profile' }
}));

vi.mock('../../lib/sentry', () => ({
    setUserContext: vi.fn(),
    clearUserContext: vi.fn()
}));

vi.mock('../../services/presence', () => ({
    APP_PRESENCE_HEARTBEAT_SECONDS: 30,
    PresenceService: {
        trackHeartbeat: vi.fn(),
        endSession: vi.fn().mockResolvedValue(undefined)
    },
    clearPresenceSessionId: vi.fn()
}));

vi.mock('../../lib/network', () => ({
    isLikelyNetworkError: vi.fn(() => false),
    isNavigatorOnline: vi.fn(() => true)
}));

// Test component to consume context
const TestComponent = () => {
    const { user, profile, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    return (
        <div>
            <div data-testid="user-id">{user?.id}</div>
            <div data-testid="profile-username">{profile?.username}</div>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (cache.get as any).mockReturnValue(null);
        (supabase.rpc as any).mockReturnValue({
            single: vi.fn().mockResolvedValue({
                data: {
                    id: 'u123',
                    username: 'testuser',
                    avatar_url: '',
                    role: 'user',
                    can_stream: false
                },
                error: null
            })
        });
    });

    it('should show loading initially', () => {
        (supabase.auth.getSession as any).mockReturnValue(new Promise(() => { })); // Never resolves
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should initialize with no user if session is null', async () => {
        (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null });

        await act(async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );
        });

        await waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        expect(screen.getByTestId('user-id')).toBeEmptyDOMElement();
    });

    it('should initialize with user and fetch profile', async () => {
        const mockUser = { id: 'u123', email: 'test@test.com' };
        (supabase.auth.getSession as any).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null
        });

        await act(async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );
        });

        await waitFor(() => {
            expect(screen.getByTestId('user-id')).toHaveTextContent('u123');
            expect(screen.getByTestId('profile-username')).toHaveTextContent('testuser');
        });

        expect(Sentry.setUserContext).toHaveBeenCalledWith('u123', 'testuser');
    });

    it('should handle logout', async () => {
        // Setup mock for initial login
        const mockUser = { id: 'u123' };
        (supabase.auth.getSession as any).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null
        });

        let authStateCallback: any;
        (supabase.auth.onAuthStateChange as any).mockImplementation((cb: any) => {
            authStateCallback = cb;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
        });

        await act(async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );
        });

        // Trigger logout event
        await act(async () => {
            authStateCallback('SIGNED_OUT', null);
        });

        expect(cache.clearAll).toHaveBeenCalled();
        expect(Sentry.clearUserContext).toHaveBeenCalled();
        expect(screen.getByTestId('user-id')).toBeEmptyDOMElement();
    });
});
