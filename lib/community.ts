import { supabase } from './supabase';

export interface MovieRequest {
    id: string;
    tmdb_id: string;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string;
    status: 'pending' | 'fulfilled';
    created_at: string;
    reply_count?: number; // Virtual count
}

export interface RequestReply {
    id: string;
    request_id: string;
    content: string;
    link_type: 'gdrive' | 'mega' | 'magnet' | 'stream' | 'other';
    instructions?: string;
    upvotes: number;
    created_at: string;
    // user_vote is tricky to fetch efficiently in listing, but can be done via lateral join or separate call
    user_vote?: number;
}

export const CommunityService = {

    // --- Request Management ---

    async getRequests(filter: 'open' | 'fulfilled' | 'all' = 'open') {
        let query = supabase
            .from('movie_requests')
            .select(`
                *,
                replies:request_replies(count)
            `)
            .order('created_at', { ascending: false });

        if (filter === 'open') {
            // "Open" means status is pending. 
            // Alternatively, we could define open as having no valid replies yet, but explicit status is faster.
            query = query.eq('status', 'pending');
        } else if (filter === 'fulfilled') {
            query = query.eq('status', 'fulfilled');
        }
        // If filter is 'all', apply no status filter

        const { data, error } = await query;
        if (error) throw error;

        return data.map((d: any) => ({
            ...d,
            reply_count: d.replies?.[0]?.count || 0
        })) as MovieRequest[];
    },

    async createRequest(
        tmdbId: string,
        mediaType: 'movie' | 'tv',
        title: string,
        posterPath: string
    ) {
        // Prevent duplicates for same media type + ID
        const { data: existing } = await supabase
            .from('movie_requests')
            .select('id')
            .eq('tmdb_id', tmdbId)
            .eq('media_type', mediaType)
            .maybeSingle();

        if (existing) {
            throw new Error('This movie has already been requested!');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Must be logged in to request');

        const { data, error } = await supabase
            .from('movie_requests')
            .insert({
                tmdb_id: tmdbId.toString(),
                media_type: mediaType,
                title,
                poster_path: posterPath,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;
        return data as MovieRequest;
    },

    async deleteRequest(requestId: string) {
        const { error } = await supabase
            .from('movie_requests')
            .delete()
            .eq('id', requestId);

        if (error) throw error;
    },

    async updateRequestStatus(requestId: string, status: 'pending' | 'fulfilled') {
        const { error } = await supabase
            .from('movie_requests')
            .update({ status })
            .eq('id', requestId);

        if (error) throw error;
    },

    // --- Reply / Link Management ---

    async getLinksForMovie(tmdbId: string) {
        // Fetch all replies for this movie (across any requests that match this TMDB ID, though usually 1:1)
        // We join with request_replies directly on tmdb_id for speed (redundant column paid off here!)
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('request_replies')
            .select(`
                *,
                votes:reply_votes(vote)
            `)
            .eq('tmdb_id', tmdbId.toString())
            .order('upvotes', { ascending: false }); // Best links first

        if (error) throw error;

        // Process user vote if logged in
        return data.map((d: any) => ({
            ...d,
            user_vote: user ? (d.votes?.find((v: any) => v.user_id === user.id)?.vote || 0) : 0
        })) as RequestReply[];
    },

    async submitReply(requestId: string, tmdbId: string, content: string, instructions?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Must be logged in to reply');

        const linkType = this.detectLinkType(content);

        const { data, error } = await supabase
            .from('request_replies')
            .insert({
                request_id: requestId,
                tmdb_id: tmdbId.toString(), // Store specifically for player lookups
                content,
                link_type: linkType,
                instructions,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        // Auto-update request status to 'fulfilled'
        await supabase
            .from('movie_requests')
            .update({ status: 'fulfilled' })
            .eq('id', requestId);

        return data;
    },

    // --- Voting ---

    async voteReply(replyId: string, vote: 1 | -1) {
        const { data, error } = await supabase.rpc('handle_reply_vote', {
            p_reply_id: replyId,
            p_vote: vote
        });

        if (error) throw error;
        return data as number; // New total upvotes
    },

    // --- Helpers ---

    detectLinkType(url: string): 'gdrive' | 'mega' | 'magnet' | 'stream' | 'other' {
        const lower = url.toLowerCase();
        if (lower.startsWith('magnet:')) return 'magnet';
        if (lower.includes('drive.google.com')) return 'gdrive';
        if (lower.includes('mega.nz')) return 'mega';
        if (lower.includes('youtube.com') || lower.includes('vimeo') || lower.includes('.m3u8')) return 'stream';
        return 'other';
    }
};
