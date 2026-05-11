type TrailerCountry = {
    code: string;
    label: string;
    accent: string;
};

type TrailerSource = {
    countryCode: string;
    name: string;
    handle?: string;
    channelId?: string;
};

export type LatestTrailerItem = {
    id: string;
    videoId: string;
    title: string;
    url: string;
    embedUrl: string;
    thumbnailUrl: string;
    publishedAt: string;
    channelTitle: string;
    channelId: string;
    sourceName: string;
    countryCode: string;
    countryLabel: string;
    countryAccent: string;
};

export type LatestTrailerGroup = {
    country: TrailerCountry;
    trailers: LatestTrailerItem[];
};

type HandlerResponse = {
    status: number;
    headers: Record<string, string>;
    body: string;
};

const COUNTRIES: TrailerCountry[] = [
    { code: 'US', label: 'United States', accent: '#8dd9ff' },
    { code: 'IN', label: 'India', accent: '#ffcf7a' },
    { code: 'ML', label: 'Malayalam', accent: '#73e6a6' },
    { code: 'HI', label: 'Hindi', accent: '#ffd166' },
    { code: 'TA', label: 'Tamil', accent: '#ff8a8a' },
    { code: 'TE', label: 'Telugu', accent: '#91c7ff' },
    { code: 'KA', label: 'Kannada', accent: '#d6a4ff' },
    { code: 'KR', label: 'Korea', accent: '#ff8fb8' },
    { code: 'JP', label: 'Japan', accent: '#b8ff8d' },
    { code: 'GB', label: 'United Kingdom', accent: '#c8b6ff' },
    { code: 'FR', label: 'France', accent: '#9ee6d5' },
];

const SOURCES: TrailerSource[] = [
    { countryCode: 'US', name: 'Warner Bros. Pictures', handle: '@warnerbrospictures' },
    { countryCode: 'US', name: 'Universal Pictures', handle: '@universalpictures' },
    { countryCode: 'US', name: 'Paramount Pictures', handle: '@paramountpictures' },
    { countryCode: 'US', name: 'Sony Pictures', handle: '@sonypictures' },
    { countryCode: 'US', name: '20th Century Studios', handle: '@20thcenturystudios' },
    { countryCode: 'US', name: 'Lionsgate Movies', handle: '@lionsgate' },
    { countryCode: 'US', name: 'Marvel Entertainment', handle: '@marvel' },
    { countryCode: 'US', name: 'DC', handle: '@dcofficial' },
    { countryCode: 'US', name: 'Walt Disney Studios', handle: '@disney' },
    { countryCode: 'US', name: 'Pixar', handle: '@pixar' },
    { countryCode: 'US', name: 'DreamWorks', handle: '@dreamworks' },
    { countryCode: 'US', name: 'Illumination', handle: '@illumination' },
    { countryCode: 'US', name: 'A24', handle: '@a24' },
    { countryCode: 'US', name: 'NEON', handle: '@neonrated' },
    { countryCode: 'US', name: 'MGM', handle: '@mgm' },
    { countryCode: 'US', name: 'Focus Features', handle: '@focusfeatures' },
    { countryCode: 'US', name: 'Searchlight Pictures', handle: '@searchlightpictures' },
    { countryCode: 'US', name: 'Amazon MGM Studios', handle: '@amazonmgmstudios' },
    { countryCode: 'US', name: 'Apple TV', handle: '@appletv' },
    { countryCode: 'US', name: 'Netflix', handle: '@netflix' },
    { countryCode: 'US', name: 'Hulu', handle: '@hulu' },
    { countryCode: 'US', name: 'HBO Max', handle: '@hbomax' },
    { countryCode: 'US', name: 'Peacock', handle: '@peacock' },
    { countryCode: 'US', name: 'Shudder', handle: '@shudder' },
    { countryCode: 'US', name: 'IFC Films', handle: '@ifcfilms' },
    { countryCode: 'US', name: 'RLJE Films', handle: '@rljefilms' },

    { countryCode: 'IN', name: 'T-Series', handle: '@tseries' },
    { countryCode: 'IN', name: 'YRF', handle: '@yrf' },
    { countryCode: 'IN', name: 'Dharma Productions', handle: '@dharmamovies' },
    { countryCode: 'IN', name: 'Zee Studios', handle: '@zeestudiosofficial' },
    { countryCode: 'IN', name: 'Sun TV', handle: '@suntv' },
    { countryCode: 'IN', name: 'Hombale Films', handle: '@hombalefilms' },
    { countryCode: 'IN', name: 'Red Chillies Entertainment', handle: '@redchilliesent' },
    { countryCode: 'IN', name: 'Excel Movies', handle: '@excelmovies' },
    { countryCode: 'IN', name: 'Jio Studios', handle: '@jiostudios' },
    { countryCode: 'IN', name: 'Viacom18 Studios', handle: '@viacom18studios' },
    { countryCode: 'IN', name: 'Pen Movies', handle: '@penmovies' },
    { countryCode: 'IN', name: 'Tips Films', handle: '@tipsfilms' },
    { countryCode: 'IN', name: 'Saregama Music', handle: '@saregamamusic' },
    { countryCode: 'IN', name: 'Eros Now', handle: '@erosnow' },
    { countryCode: 'IN', name: 'Shemaroo', handle: '@shemaroo' },
    { countryCode: 'IN', name: 'AA Films', handle: '@aafilms' },
    { countryCode: 'IN', name: 'Panorama Studios', handle: '@panoramastudios' },
    { countryCode: 'IN', name: 'Sony Music India', handle: '@sonymusicindia' },
    { countryCode: 'IN', name: 'Sony LIV', handle: '@sonyliv' },
    { countryCode: 'IN', name: 'Netflix India', handle: '@netflixindiaofficial' },
    { countryCode: 'IN', name: 'Prime Video India', handle: '@primevideoin' },
    { countryCode: 'IN', name: 'DisneyPlus Hotstar', handle: '@disneyplushotstar' },
    { countryCode: 'IN', name: 'ZEE5', handle: '@zee5' },

    { countryCode: 'HI', name: 'T-Series', handle: '@tseries' },
    { countryCode: 'HI', name: 'YRF', handle: '@yrf' },
    { countryCode: 'HI', name: 'Dharma Productions', handle: '@dharmamovies' },
    { countryCode: 'HI', name: 'Red Chillies Entertainment', handle: '@redchilliesent' },
    { countryCode: 'HI', name: 'Zee Studios', handle: '@zeestudiosofficial' },
    { countryCode: 'HI', name: 'Jio Studios', handle: '@jiostudios' },
    { countryCode: 'HI', name: 'Viacom18 Studios', handle: '@viacom18studios' },
    { countryCode: 'HI', name: 'Excel Movies', handle: '@excelmovies' },
    { countryCode: 'HI', name: 'Pen Movies', handle: '@penmovies' },
    { countryCode: 'HI', name: 'Tips Films', handle: '@tipsfilms' },
    { countryCode: 'HI', name: 'Eros Now', handle: '@erosnow' },

    { countryCode: 'ML', name: 'Saina Movies', handle: '@sainamovies' },
    { countryCode: 'ML', name: 'Manorama Music Songs', handle: '@manoramamusicsongs' },
    { countryCode: 'ML', name: 'Muzik247', handle: '@muzik247' },
    { countryCode: 'ML', name: 'Goodwill Entertainments', handle: '@goodwillentertainments' },
    { countryCode: 'ML', name: 'Friday Film House', handle: '@fridayfilmhouse' },
    { countryCode: 'ML', name: 'Aashirvad Cinemas', handle: '@aashirvadcinemasofficial' },
    { countryCode: 'ML', name: 'Magic Frames', handle: '@magicframesofficial' },
    { countryCode: 'ML', name: '123Musix', handle: '@123musix' },
    { countryCode: 'ML', name: 'Millennium Audios', handle: '@millenniumaudios' },
    { countryCode: 'ML', name: 'Central Pictures', handle: '@centralpictures' },
    { countryCode: 'ML', name: 'Anwar Rasheed Entertainment', handle: '@anwarrasheedentertainment' },

    { countryCode: 'TA', name: 'Sun TV', handle: '@suntv' },
    { countryCode: 'TA', name: 'Sun Pictures', handle: '@sunpictures' },
    { countryCode: 'TA', name: 'Lyca Productions', handle: '@lycaproductions' },
    { countryCode: 'TA', name: 'Think Music India', handle: '@thinkmusicofficial' },
    { countryCode: 'TA', name: 'Sony Music South', handle: '@sonymusicsouth' },
    { countryCode: 'TA', name: 'Saregama Tamil', handle: '@saregamatamil' },
    { countryCode: 'TA', name: 'Mango Music Tamil', handle: '@mangomusictamil' },
    { countryCode: 'TA', name: 'Studio Green', handle: '@studiogreen' },
    { countryCode: 'TA', name: 'AGS Entertainment', handle: '@agsentertainment' },
    { countryCode: 'TA', name: 'Dream Warrior Pictures', handle: '@dreamwarriorpictures' },
    { countryCode: 'TA', name: 'Seven Screen Studio', handle: '@sevenscreenstudio' },
    { countryCode: 'TA', name: 'Lahari Music Tamil', handle: '@laharimusictamil' },

    { countryCode: 'TE', name: 'Mythri Movie Makers', handle: '@mythriofficial' },
    { countryCode: 'TE', name: 'Hombale Films', handle: '@hombalefilms' },
    { countryCode: 'TE', name: 'Geetha Arts', handle: '@geethaarts' },
    { countryCode: 'TE', name: 'UV Creations', handle: '@uvcreations' },
    { countryCode: 'TE', name: 'Sri Venkateswara Creations', handle: '@srivenkateswaracreations' },
    { countryCode: 'TE', name: 'Vyjayanthi Movies', handle: '@vyjayanthimovies' },
    { countryCode: 'TE', name: 'Sithara Entertainments', handle: '@sitharaentertainments' },
    { countryCode: 'TE', name: 'People Media Factory', handle: '@peoplemediafactory' },
    { countryCode: 'TE', name: 'Aditya Music', handle: '@adityamusicindia' },
    { countryCode: 'TE', name: 'Lahari Music', handle: '@laharimusic' },
    { countryCode: 'TE', name: 'Mango Music', handle: '@mangomusic' },
    { countryCode: 'TE', name: 'T-Series Telugu', handle: '@tseriestelugu' },

    { countryCode: 'KA', name: 'Hombale Films', handle: '@hombalefilms' },
    { countryCode: 'KA', name: 'Anand Audio', handle: '@anandaudio' },
    { countryCode: 'KA', name: 'Lahari Music Kannada', handle: '@laharimusickannada' },
    { countryCode: 'KA', name: 'PRK Audio', handle: '@prkaudio' },
    { countryCode: 'KA', name: 'D Beats', handle: '@dbeatsmusicworld' },
    { countryCode: 'KA', name: 'Ashwini Recording Company', handle: '@ashwinirecordingcompany' },
    { countryCode: 'KA', name: 'Paramvah Studios', handle: '@paramvahstudios' },
    { countryCode: 'KA', name: 'KRG Connects', handle: '@krgconnects' },

    { countryCode: 'KR', name: 'CJ ENM Movie', handle: '@cjenmmovie' },
    { countryCode: 'KR', name: 'Lotte Entertainment', handle: '@lotteent.movie' },
    { countryCode: 'KR', name: 'Plus M Entertainment', handle: '@plusm_entertainment' },
    { countryCode: 'JP', name: 'Toho Movie', handle: '@tohomovie' },
    { countryCode: 'JP', name: 'Warner Bros. Japan', handle: '@warnerbrosjapan' },
    { countryCode: 'JP', name: 'Sony Pictures Japan', handle: '@sonypicturesjp' },
    { countryCode: 'GB', name: 'Warner Bros. UK', handle: '@warnerbrosuk' },
    { countryCode: 'GB', name: 'Universal Pictures UK', handle: '@universalpicturesuk' },
    { countryCode: 'GB', name: 'StudioCanal UK', handle: '@studiocanaluk' },
    { countryCode: 'GB', name: 'Pathe UK', handle: '@patheuk' },
    { countryCode: 'FR', name: 'Gaumont', handle: '@gaumont' },
    { countryCode: 'FR', name: 'Pathe France', handle: '@pathefilms' },
    { countryCode: 'FR', name: 'StudioCanal France', handle: '@studiocanalfr' },
];

const jsonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=900, s-maxage=1800',
};

const decodeXml = (value: string) => value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const getTag = (entry: string, tag: string) => {
    const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? decodeXml(match[1].trim()) : '';
};

const getAttr = (entry: string, tag: string, attr: string) => {
    const match = entry.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, 'i'));
    return match ? decodeXml(match[1]) : '';
};

const isTrailerTitle = (title: string) => {
    const normalized = title.toLowerCase();
    const hasTrailerSignal = /\b(official\s+)?(trailer|teaser)\b/.test(normalized);
    if (!hasTrailerSignal) return false;

    const blockedSignals = [
        /\b(song|lyric|lyrics|lyrical|music video|audio|jukebox|soundtrack|album)\b/,
        /\b(making|behind the scenes|bts|interview|event|launch|success meet|press meet)\b/,
        /\b(reaction|review|breakdown|explained|public response|fan theory)\b/,
        /\b(announcement|motion poster|first look|character promo|dialogue promo|tv spot)\b/,
        /\b(full movie|full episode|scene|clip|deleted scene|sneak peek)\b/,
    ];

    return !blockedSignals.some(pattern => pattern.test(normalized));
};

const isFreshEnough = (publishedAt: string, maxAgeDays: number) => {
    const publishedTime = new Date(publishedAt).getTime();
    if (!Number.isFinite(publishedTime)) return false;

    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    return Date.now() - publishedTime <= maxAgeMs;
};

const resolveChannelId = async (source: TrailerSource): Promise<string | null> => {
    if (source.channelId) return source.channelId;
    if (!source.handle) return null;

    const url = `https://www.youtube.com/${encodeURIComponent(source.handle).replace('%40', '@')}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 PlusUltraTrailerResolver/1.0',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });

    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{20,})"/) ||
        html.match(/\/channel\/(UC[a-zA-Z0-9_-]{20,})/);

    return match?.[1] || null;
};

const fetchSourceFeed = async (
    source: TrailerSource,
    country: TrailerCountry,
    maxAgeDays: number
): Promise<LatestTrailerItem[]> => {
    const channelId = await resolveChannelId(source);
    if (!channelId) return [];

    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 PlusUltraTrailerFeed/1.0',
            'Accept': 'application/rss+xml, application/xml, text/xml',
        },
    });

    if (!response.ok) return [];
    const xml = await response.text();
    const entries = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)).map(match => match[1]);

    return entries
        .map((entry): LatestTrailerItem | null => {
            const videoId = getTag(entry, 'yt:videoId');
            const title = getTag(entry, 'title');
            const publishedAt = getTag(entry, 'published');
            const channelTitle = getTag(entry, 'name') || source.name;
            const thumbnailUrl = getAttr(entry, 'media:thumbnail', 'url') ||
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            if (!videoId || !title || !publishedAt || !isTrailerTitle(title) || !isFreshEnough(publishedAt, maxAgeDays)) {
                return null;
            }

            return {
                id: `${country.code}-${videoId}`,
                videoId,
                title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                embedUrl: `https://www.youtube.com/embed/${videoId}`,
                thumbnailUrl,
                publishedAt,
                channelTitle,
                channelId,
                sourceName: source.name,
                countryCode: country.code,
                countryLabel: country.label,
                countryAccent: country.accent,
            };
        })
        .filter((item): item is LatestTrailerItem => Boolean(item));
};

export const handleLatestTrailers = async (query: {
    countries?: string;
    limit?: string;
    maxAgeDays?: string;
} = {}): Promise<HandlerResponse> => {
    const requestedCountries = new Set(
        (query.countries || '')
            .split(',')
            .map(code => code.trim().toUpperCase())
            .filter(Boolean)
    );
    const limit = Math.max(1, Math.min(parseInt(query.limit || '8', 10) || 8, 16));
    const maxAgeDays = Math.max(14, Math.min(parseInt(query.maxAgeDays || '180', 10) || 180, 365));
    const countries = COUNTRIES.filter(country => (
        requestedCountries.size === 0 || requestedCountries.has(country.code)
    ));

    const groups = await Promise.all(countries.map(async (country) => {
        const sources = SOURCES.filter(source => source.countryCode === country.code);
        const results = await Promise.allSettled(
            sources.map(source => fetchSourceFeed(source, country, maxAgeDays))
        );

        const trailers = results
            .flatMap(result => result.status === 'fulfilled' ? result.value : [])
            .filter((item, index, all) => all.findIndex(candidate => candidate.videoId === item.videoId) === index)
            .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
            .slice(0, limit);

        return { country, trailers };
    }));

    return {
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
            groups: groups.filter(group => group.trailers.length > 0),
            source: 'youtube-official-channel-rss',
            generatedAt: new Date().toISOString(),
        }),
    };
};
