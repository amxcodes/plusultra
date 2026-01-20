import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommunityService } from '../../lib/community';
import { rateLimiter } from '../../lib/rateLimiter';
import { supabase } from '../../lib/supabase';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn()
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            single: vi.fn(),
        })),
        rpc: vi.fn()
    }
}));

vi.mock('../../lib/rateLimiter', () => ({
    rateLimiter: {
        check: vi.fn()
    },
    RATE_LIMITS: {
        CREATE_REQUEST: { cooldownMs: 1000, maxBurst: 1 },
        SUBMIT_REPLY: { cooldownMs: 1000, maxBurst: 1 },
        VOTE_REPLY: { cooldownMs: 1000, maxBurst: 1 }
    }
}));

describe('CommunityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createRequest', () => {
        it('should throw if user is not logged in', async () => {
            // Mock no user
            (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });

            await expect(CommunityService.createRequest('123', 'movie', 'Test', '/path.jpg'))
                .rejects.toThrow('Must be logged in to request');
        });

        it('should call rate limiter', async () => {
            (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } } });

            // Mock supabase insert success
            const mockChain = {
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'r1' }, error: null })
            };
            (supabase.from as any).mockReturnValue(mockChain);

            await CommunityService.createRequest('123', 'movie', 'Test', '/path.jpg');

            expect(rateLimiter.check).toHaveBeenCalledWith('createRequest', expect.any(Number), expect.any(Number));
        });
    });

    describe('submitReply', () => {
        it('should validate URLs', async () => {
            (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } } });

            await expect(CommunityService.submitReply('r1', '123', 'not-a-url'))
                .rejects.toThrow(/Invalid link format/);

            // Valid URL should proceed (mocking successful db call)
            const mockChain = {
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'rep1' }, error: null })
            };
            (supabase.from as any).mockReturnValue(mockChain);
            (supabase.from as any).mockImplementation((table: string) => {
                if (table === 'movie_requests') {
                    return {
                        update: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockResolvedValue({ error: null })
                    }
                }
                return mockChain;
            });

            await expect(CommunityService.submitReply('r1', '123', 'https://example.com')).resolves.not.toThrow();
        });
    });

    describe('detectLinkType', () => {
        it('should identify link types correctly', () => {
            expect(CommunityService.detectLinkType('magnet:?xt=urn:btih:...')).toBe('magnet');
            expect(CommunityService.detectLinkType('https://drive.google.com/file')).toBe('gdrive');
            expect(CommunityService.detectLinkType('https://mega.nz/file')).toBe('mega');
            expect(CommunityService.detectLinkType('https://youtube.com/watch')).toBe('stream');
            expect(CommunityService.detectLinkType('https://unknown.com')).toBe('other');
        });
    });
});
