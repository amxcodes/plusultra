import { describe, expect, it } from 'vitest';
import { getTurnstileClientErrorMessage } from '../../lib/env';

describe('env helpers', () => {
    it('maps invalid site key errors to actionable copy', () => {
        expect(getTurnstileClientErrorMessage('400020')).toContain('invalid');
        expect(getTurnstileClientErrorMessage('110100')).toContain('invalid');
    });

    it('maps unauthorized hostname errors to actionable copy', () => {
        expect(getTurnstileClientErrorMessage('110200')).toContain('domain is not authorized');
    });

    it('falls back to a generic message for unknown client errors', () => {
        expect(getTurnstileClientErrorMessage('999999')).toContain('999999');
    });
});
