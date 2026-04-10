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
            (supabase.rpc as any).mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'r1' }, error: null })
            });

            await CommunityService.createRequest('123', 'movie', 'Test', '/path.jpg');

            expect(rateLimiter.check).toHaveBeenCalledWith('createRequest', expect.any(Number), expect.any(Number));
            expect(supabase.rpc).toHaveBeenCalledWith('create_movie_request_secure', {
                p_tmdb_id: '123',
                p_media_type: 'movie',
                p_title: 'Test',
                p_poster_path: '/path.jpg',
            });
        });
    });

    describe('submitReply', () => {
        it('should validate URLs', async () => {
            (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } } });

            await expect(CommunityService.submitReply('r1', '123', 'not-a-url'))
                .rejects.toThrow(/Invalid link format/);

            (supabase.rpc as any).mockImplementation((fnName: string) => {
                if (fnName === 'submit_request_reply_secure') {
                    return {
                        single: vi.fn().mockResolvedValue({ data: { id: 'rep1' }, error: null })
                    };
                }

                return {
                    single: vi.fn().mockResolvedValue({ data: null, error: null })
                };
            });

            await expect(CommunityService.submitReply('r1', '123', 'https://example.com')).resolves.not.toThrow();

            expect(supabase.rpc).toHaveBeenCalledWith('submit_request_reply_secure', {
                p_request_id: 'r1',
                p_tmdb_id: '123',
                p_content: 'https://example.com',
                p_instructions: null,
            });
        });

        it('should pass instructions through the secure RPC', async () => {
            (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'u1' } } });
            (supabase.rpc as any).mockImplementation((fnName: string) => {
                if (fnName === 'submit_request_reply_secure') {
                    return {
                        single: vi.fn().mockResolvedValue({ data: { id: 'rep1' }, error: null })
                    };
                }

                return {
                    single: vi.fn().mockResolvedValue({ data: null, error: null })
                };
            });

            await expect(
                CommunityService.submitReply('r1', '123', 'https://example.com', 'Mirror link')
            ).resolves.not.toThrow();

            expect(supabase.rpc).toHaveBeenCalledWith('submit_request_reply_secure', {
                p_request_id: 'r1',
                p_tmdb_id: '123',
                p_content: 'https://example.com',
                p_instructions: 'Mirror link',
            });
        });
    });

    describe('voteReply', () => {
        it('should call the vote RPC', async () => {
            (supabase.rpc as any).mockResolvedValue({ data: 4, error: null });

            await expect(CommunityService.voteReply('reply-1', 1)).resolves.toBe(4);

            expect(rateLimiter.check).toHaveBeenCalledWith('voteReply', expect.any(Number), expect.any(Number));
            expect(supabase.rpc).toHaveBeenCalledWith('handle_reply_vote', {
                p_reply_id: 'reply-1',
                p_vote: 1
            });
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
