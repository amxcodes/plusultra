import { beforeEach, describe, expect, it } from 'vitest';
import {
    getRememberMePreference,
    REMEMBER_ME_PREFERENCE_KEY,
    setRememberMePreference,
    supabaseAuthStorage,
} from '../../lib/authStorage';

describe('authStorage', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    it('defaults remember me to enabled', () => {
        expect(getRememberMePreference()).toBe(true);
    });

    it('stores auth in localStorage when remember me is enabled', () => {
        setRememberMePreference(true);
        supabaseAuthStorage.setItem('sb-test', 'token');

        expect(window.localStorage.getItem('sb-test')).toBe('token');
        expect(window.sessionStorage.getItem('sb-test')).toBeNull();
    });

    it('stores auth in sessionStorage when remember me is disabled', () => {
        setRememberMePreference(false);
        supabaseAuthStorage.setItem('sb-test', 'token');

        expect(window.sessionStorage.getItem('sb-test')).toBe('token');
        expect(window.localStorage.getItem('sb-test')).toBeNull();
    });

    it('falls back to session storage when remember me is enabled', () => {
        window.sessionStorage.setItem('sb-test', 'token');

        expect(supabaseAuthStorage.getItem('sb-test')).toBe('token');
    });

    it('persists the remember me preference in localStorage', () => {
        setRememberMePreference(false);
        expect(window.localStorage.getItem(REMEMBER_ME_PREFERENCE_KEY)).toBe('false');
    });
});
