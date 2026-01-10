Rive Stream
Biggest Streaming API
We offer free streaming links for movies and episodes that can be effortlessly integrated into your website through our embed links, API

Movie
Tv Show
533535
https://rivestream.org/embed?type=movie&id=533535

API Documentaion
Rive API give you the lowdown on all the methods, request formats, and both required and optional parameters.

1. Movie Embed
TmdbId is required from The Movie Database API.

Endpoint
https://rivestream.org/embed?type=movie&id={tmdbId}
Examples
https://rivestream.org/embed?type=movie&id=533535
https://rivestream.org/embed?type=movie&id=278
Code Examples
<iframe src="https://rivestream.org/embed?type=movie&id=533535" allowfullscreen ></iframe>
2. Tv Show Embed
TmdbId is required from The Movie Database API. season and episode number should not be empty.

Endpoint
https://rivestream.org/embed?type=tv&id={tmdbId}&season={season}&episode={episode}
Examples
https://rivestream.org/embed?type=tv&id=1396&season=1&episode=1
https://rivestream.org/embed?type=tv&id=1399&season=1&episode=1
Code Examples
<iframe src="https://rivestream.org/embed?type=tv&id=1396&season=1&episode=1" allowfullscreen ></iframe>
Torrent API
Your complete guide to streaming high-quality movies and TV shows using torrents. Includes details on available methods, request formats, and parameters to retrieve and stream torrent-backed video content seamlessly.

1. Movie Embed
TmdbId is required from The Movie Database API.

Endpoint
https://rivestream.org/embed/torrent?type=movie&id={tmdbId}
Examples
https://rivestream.org/embed/torrent?type=movie&id=533535
https://rivestream.org/embed/torrent?type=movie&id=278
Code Examples
<iframe src="https://rivestream.org/embed/torrent?type=movie&id=533535" allowfullscreen ></iframe>
2. Tv Show Embed
TmdbId is required from The Movie Database API. season and episode number should not be empty.

Endpoint
https://rivestream.org/embed/torrent?type=tv&id={tmdbId}&season={season}&episode={episode}
Examples
https://rivestream.org/embed/torrent?type=tv&id=1396&season=1&episode=1
https://rivestream.org/embed/torrent?type=tv&id=1399&season=1&episode=1
Code Examples
<iframe src="https://rivestream.org/embed/torrent?type=tv&id=1396&season=1&episode=1" allowfullscreen ></iframe>
Aggregator API
Stream movies and TV shows from multiple aggregator servers. This API documentation details all methods, request formats, and parameters required to access and integrate streams from various reliable sources.

1. Movie Embed
TmdbId is required from The Movie Database API.

Endpoint
https://rivestream.org/embed/agg?type=movie&id={tmdbId}
Examples
https://rivestream.org/embed/agg?type=movie&id=533535
https://rivestream.org/embed/agg?type=movie&id=278
Code Examples
<iframe src="https://rivestream.org/embed/agg?type=movie&id=533535" allowfullscreen ></iframe>
2. Tv Show Embed
TmdbId is required from The Movie Database API. season and episode number should not be empty.

Endpoint
https://rivestream.org/embed/agg?type=tv&id={tmdbId}&season={season}&episode={episode}
Examples
https://rivestream.org/embed/agg?type=tv&id=1396&season=1&episode=1
https://rivestream.org/embed/agg?type=tv&id=1399&season=1&episode=1
Code Examples
<iframe src="https://rivestream.org/embed/agg?type=tv&id=1396&season=1&episode=1" allowfullscreen ></iframe>
Download API
Download movies and TV shows from multiple aggregator servers. This API documentation details all methods, request formats, and parameters required to access and download streams from various reliable sources.

1. Movie Download
TmdbId is required from The Movie Database API.

Endpoint
https://rivestream.org/download?type=movie&id={tmdbId}
Examples
https://rivestream.org/download?type=movie&id=533535
https://rivestream.org/download?type=movie&id=278
Code Examples
<iframe src="https://rivestream.org/download?type=movie&id=533535" allowfullscreen ></iframe>
2. Tv Show Download
TmdbId is required from The Movie Database API. season and episode number should not be empty.

Endpoint
https://rivestream.org/download?type=tv&id={tmdbId}&season={season}&episode={episode}
Examples
https://rivestream.org/download?type=tv&id=1396&season=1&episode=1
https://rivestream.org/download?type=tv&id=1399&season=1&episode=1
Code Examples
<iframe src="https://rivestream.org/download?type=tv&id=1396&season=1&episode=1" allowfullscreen ></iframe>
Feautes
Deliver an optimized UI/UX
We’ve loaded up on essential features, all fine-tuned to make sure you get the best user experience possible. Every detail is optimized to keep things smooth and awesome for you

Responsive
The player is responsive and can work on every Desktop, Mobile, Tablet without problem.

Auto Update
Content added every day, updated automatically

Highest Quality
Latest available quality and the fastest

Fast Streaming
The player includes a list of fastest streaming servers, users can easily optional.

Huge Library
We have been delivering contents from various other sources with better and faster streaming service

Rive
Discord
developer@rivestream.org
2026 RIVE. All Rights Reserved. 


Video Streaming API
With NO Ads
We offer free streaming links for movies and episodes that can be
effortlessly integrated into your website through our embed links.

Movie Player
Series Player
TMDB

Deliver an optimized User Experience
There are plenty of essential features optimized to provide the best user experience.

Auto Update
Links are automatically updated with new or better quality as soon as they are available online.
Responsive
The player is responsive and can work on every Desktop, Mobile, Tablet without problem.
High Quality
The quality of the links is the latest available, most are 1080p.
Fast Streaming Servers
The player includes a list of fastest streaming servers, users can easily optional.
API Documentation
Detailed representation of the API endpoints for P-Stream Embed includes comprehensive information regarding the available methods, request formats, required parameters and optional parameters.
Example:
https://iframe.pstream.mov/embed/tmdb-movie-{tmdb_id}

Or:
https://iframe.pstream.mov/media/tmdb-movie-{tmdb_id}

Example:
https://iframe.pstream.mov/embed/tmdb-tv-{tmdb_id}/{season_number}/{episode_number}

Example with IDs:
https://iframe.pstream.mov/media/tmdb-tv-{tmdb_id}/{season_tmdb_id}/{episode_tmdb_id}

Note: The /media/ format requires TMDB IDs for season and episode, while the /embed/ format uses season and episode numbers.

Example:
https://iframe.pstream.mov/media/tmdb-movie-{tmdb_id}?t=00:45&theme=default&language=en&logo=true&downloads=true&has-watchparty=true&language-order=en,hi,fr,de,nl,pt&allinone=true&scale=0.9&backlink=https://pstream.mov&fedapi=true&interface-settings=true&tips=true

Time Stamp Parameter t=08:47
Time code in HH:MM:SS format

Tells the player when to start the video
Theme Parameter theme=default
Player theme (default: default)

Available themes: Default, Classic, Blue, Teal, Red, Gray, Green, Mocha, Pink
Language Parameter language=en
Player interface language (default: en)

Available languages: en (English), de (German), fr (French), es (Spanish), it (Italian), pt (Portuguese), ru (Russian), many more... (2 character ISO 639-1 language code)
Logo Parameter logo=true
Show/hide player logo (default: true)

Set to false to hide the player logo
Downloads Parameter downloads=true
Enable/disable downloads menu (default: true)

Set to false to hide the downloads menu
Watch Party Parameter has-watchparty=true
Enable/disable watch party feature (default: true)

Set to false to hide the watch party menu
Language Order Parameter language-order=en,hi,fr,de,nl,pt
Set subtitle language priority order (default: en,hi,fr,de,nl,pt)

Comma-separated list of language codes (e.g., fr,de,en,ru,he)
All In One Parameter allinone=true
Enable/disable episode selector, next episode button, and info button (default: false)

Set to true to show these features
Scale Parameter scale=0.9
Set the scale of the interface (default: 1)

Set to a value between 0 and 2
Backlink Parameter backlink=https://yoursite.com
Backlink URL (default: "" = hidden)

Show the backlink within the player and redirect to your site
Enable FED API Parameter fedapi=true
"Setup FED API" button visiblility (default: true)

Show or hide the "Setup FED API" button in the source selection view
Enable Debrid Parameter debrid=true
"Setup Debrid" button visiblility (default: true)

Show or hide the "Setup Debrid" button in the source selection view
Interface settings Parameter interface-setting=true
Hide or show interface settings (default: true)

Show or hide the theme and language settings in the player
Tips Parameter tips=true
Hide or show tips (default: true)

Show or hide interface usage tips in the player while scraping
The player can communicate with your website through postMessage events. The player sends time updates that can be used to track playback progress or integrate with your analytics. Here's how to listen for these events:

Basic Implementation:
// Listen for messages from the player iframe
window.addEventListener("message", (event) => {
  // Verify the message is from our player domain
  if (event.origin !== "https://iframe.pstream.mov") return;
  
  // Handle time update events
  if (event.data.type === "playerTimeUpdate") {
    console.log("Current time:", event.data.time);
    console.log("Total duration:", event.data.duration);
  }
  
  // Handle episode change events
  if (event.data.type === "episodeChanged") {
    console.log("Changed from S" + event.data.oldSeasonNumber + 
                "E" + event.data.oldEpisodeNumber + 
                " to S" + event.data.seasonNumber + 
                "E" + event.data.episodeNumber);
    
    // You can use this to update your UI or track viewing history
  }
});

Available Events:
playerTimeUpdate
Fired when the playback time changes. Updates are throttled to every 1 second to prevent excessive message passing.

{
	type: "playerTimeUpdate",
	time: number,      // Current time in seconds
	duration: number   // Total duration in seconds
	tmdbId: string,    // TMDB ID
	imdbId: string     // IMDB ID
}
episodeChanged
Fired when the user changes episodes within a TV series. This event provides both the new episode/season information and the previous values.

{
	type: "episodeChanged",
	episodeNumber: number,    // New episode number
	seasonNumber: number,     // New season number
	tmdbId: string,           // TMDB ID of the show
	imdbId: string,           // IMDB ID of the show
	oldEpisodeNumber: number, // Previous episode number
	oldSeasonNumber: number   // Previous season number
}
Implementation Details:
Time updates are throttled to prevent excessive message passing
The time value is always between 0 and the total duration
Updates are sent both during normal playback and when seeking
Episode change events are fired whenever a user switches episodes within a series
The event is sent to the parent window using window.parent.postMessage()


Quick Start Guide
Get started with Vidora in minutes. Choose your content type and copy the code below.

Implementation Guide
Movie Implementation
Use the movie ID from TMDB or IMDb. For example, 299534 (TMDB) or tt4154796 (IMDb) is for "Avengers: Endgame".

https://vidora.su/movie/[tmdbId]?parameters
<iframe
  src="https://vidora.su/movie/299534?autoplay=true&colour=00ff9d&backbutton=https://vidora.su/&logo=https://vidora.su/logo.png"
  width="100%"
  height="100%"
  allowfullscreen
></iframe>
Combining Parameters
Use & to combine multiple parameters. Works with both TMDB and IMDb IDs:

https://vidora.su/movie/299534?autoplay=true&colour=00ff9d&backbutton=https://vidora.su/&logo=https://vidora.su/logo.png
https://vidora.su/movie/tt4154796?autoplay=true&colour=00ff9d&backbutton=https://vidora.su/&logo=https://vidora.su/logo.png
Available Parameters
Customization Options
Parameter	Description	Type	Default	Example
autoplay	Automatically start playback when the player loads	boolean	false	?autoplay=true
colour	Custom theme color for the player (hex without #)	string	00ff9d	?colour=00ff9d
autonextepisode	Automatically play next episode (TV shows only)	boolean	true	?autonextepisode=true
backbutton	URL to navigate to when back button is clicked (optional)	string	https://vidora.su/	?backbutton=https://google.com
logo	URL of the logo to display in the player (optional)	string		?logo=https://example.com/logo.png
pausescreen	Show information overlay when video is paused	boolean	true	?pausescreen=true
idlecheck	Check if user is still watching after specified minutes (0 to disable)	number	0	?idlecheck=10
Combining Parameters
Use & to combine multiple parameters:

https://vidora.su/movie/299534?autoplay=true&colour=00ff9d&backbutton=https://vidora.su/&logo=https://vidora.su/logo.png
Watch Progress Syncing
Advanced Feature
Vidora supports syncing watch progress with your website. When embedded as an iframe, the player will send progress updates to the parent window.


const STORAGE_KEY = 'watch_progress';
let watchProgress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');


window.addEventListener('message', (event) => {
    if (event.data?.type === 'MEDIA_DATA') {
        const mediaData = event.data.data;
        if (mediaData.id && (mediaData.type === 'movie' || mediaData.type === 'tv')) {
            watchProgress[mediaData.id] = {
                ...watchProgress[mediaData.id],
                ...mediaData,
                last_updated: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(watchProgress));
            
            
            console.log('Progress updated:', mediaData);
        }
    }
});
Progress Data Format
Property	Type	Description
id	string	TMDB ID or IMDb ID of the content
type	'movie' | 'tv'	Content type
title	string	Title of the content
progress	object	Progress information (watched time, duration)
last_updated	number	Timestamp of the last update
How to Find TMDB IDs
Quick Guide
For Movies
1
Visit themoviedb.org or imdb.com
2
Search for your movie
3
Click on the movie title
4
Look at the URL: themoviedb.org/movie/299534 or imdb.com/title/tt4154796
5
The number in the URL is your ID (TMDB or IMDb)
For TV Shows
1
Visit themoviedb.org or imdb.com
2
Search for your TV show
3
Click on the show title
4
URL format: themoviedb.org/tv/1396 or imdb.com/title/tt0903747
5
Click on a season, then episode
6
Use the format: showId/seasonNumber/episodeNumber
Example URLs
Avengers: Endgame

https://vidora.su/movie/299534
https://vidora.su/movie/tt4154796
Breaking Bad S01E01

https://vidora.su/tv/1396/1/1
https://vidora.su/tv/tt0903747/1/1


AeonWatch — Embedding API
Scalable & Fast Embedding API for Webmasters.

GET
Embed (movie)
Query parameters on the root page
Movie Endpoint — Parameters
Parameter	Required	Values / Notes
type	yes	movie — must be "movie" for movie embed
version	yes	v2 or v3 — embed API version used
id	yes	Movie identifier (IMDb tt... or TMDb numeric ID)
poster	no	true or false — whether to show poster
autoPlay	no	true or false — start playback automatically
Examples
https://thisiscinema.pages.dev/?type=movie&version=v3&id=299534
https://thisiscinema.pages.dev/?type=movie&version=v2&id=550&poster=true&autoPlay=true
GET
Embed (TV episode)
Query parameters on the root page
TV Endpoint — Parameters
Parameter	Required	Values / Notes
type	yes	tv — must be "tv" for TV embed
version	yes	v2 or v3
id	yes	Show identifier. TMDb numeric ID required for AutoNext. IMDb tt... also accepted but AutoNext won't work.
season	yes	Season number (integer, minimum 1)
episode	yes	Episode number (integer, minimum 1)
totep	no	Total episodes in the current season (integer). Required for AutoNext.
tsn	no	Total seasons for the show (integer). Required for AutoNext.
autoNext	no	true or false. Default: false
When true, automatically advances to next episode on completion.
showAutoNextButton	no	true or false. Default: hidden
Set to true to display the on-page AutoNext toggle.
poster	no	true or false
autoPlay	no	true or false
⚠️ AutoNext Requirements: The AutoNext feature only works with TMDb numeric IDs (not IMDb tt IDs). You must also provide totep (total episodes in current season) and tsn (total seasons) for it to function correctly.
Examples
https://thisiscinema.pages.dev/?type=tv&version=v3&id=tt0944947&season=1&episode=1
https://thisiscinema.pages.dev/?type=tv&version=v2&id=1399&season=1&episode=1&autoPlay=true
Try the player
Enter an ID from IMDb (must include tt prefix) or TheMovieDB. Select movie or tv, set season/episode for TV, then load the sample.

Note: The AutoNext feature only works with TMDb numeric IDs (not IMDb tt IDs). You must also provide totep and tsn parameters for it to function.


Type 
Movie
Version 
v3
ID
e.g. tt0120737 or 550
Clear

Poster

Auto play
Load sample
Clear
Generated URL will appear here after loading
Copy URL
Examples
Movie: The Lord of the Rings — tt0120737
Movie: Fight Club — 550
TV: Game of Thrones S1E1 — tt0944947 (no AutoNext)
TV: Game of Thrones S1E1 — 1399 (TMDb)
TV: Game of Thrones with AutoNext — 1399
Base URL: https://thisiscinema.pages.dev

Testing locally? Use a static server to avoid issues with nested iframes and CORS.

Notes
The root page reads query parameters and loads the embedded player when type, version, and id are present.
If parameters are missing or invalid, the root page will show an error message.
Use a local static server to test embedding (recommended).
AutoNext: Requires TMDb numeric ID + totep + tsn parameters. The toggle is hidden by default; use showAutoNextButton=true to display it.


Cinemaos Video Streaming API
With Minimal Ads
We offer free streaming links for movies and episodes that can be effortlessly integrated into your website through our embed links API


Movie

https://cinemaos.tech/player/299536
▶
Cinemaos Player
Enter an ID above and click play to start streaming

• High Quality Streaming

• Minimal Advertisements

• Multi-Device Support

Deliver an optimized User Experience
We've loaded up on essential features, all fine-tuned to make sure you get the best user experience possible. Every detail is optimized to keep things smooth and awesome for you

Auto Update
Links are automatically updated with new or better quality as soon as they are available online.

Responsive
The player is responsive and can work on every Desktop, Mobile, Tablet without problem.

High Quality
The quality of the links is the latest available, mostly are 1080p.

Fast Streaming Servers
The player includes a list of fastest streaming servers, users can easily optimize.

API Documentation
Cinemaos API gives you the lowdown on all the methods, request formats, and both required and optional parameters.

1. Movie Embed URL
Use TMDB or IMDB ID for movie ID

Endpoint

Copy
https://cinemaos.tech/player/{tmdb_id}
2. TV Show Embed URL
Use TMDB or IMDB ID for TV Show ID

Endpoint

Copy
https://cinemaos.tech/player/{tmdb_id}/{season_number}/{episode_number}.



QuickWatch Docs

Quickwatch API & Scrapers
QuickWatch's Skip API, and our streaming scrapers, download scrapers and music proxying. Curated JavaScript snippets to help you build your own streaming app.

Skips API
Public GET route that returns skip timestamps for TV episodes.

required: title
required: season (number)
required: episode (number)
optional: runtime (seconds)
Example request (public, CORS open)

const res = await fetch('https://quickwatch.co/api/skips?title=
Severance
&season=
1
&episode=
2
&runtime=
2700
');
const data = await res.json();

Example response

{
  "found": true,
  "skip_times": {
    "intro": {"start": null,"end": null},
    "recap": {"start": null,"end": null},
    "credits": {"start": 2657000,"end": null},
    "ending": {"start": null,"end": null},
    "up_next": {"start": null,"end": null}
  }
}
Response shape: { found: boolean, skip_times: object | null }. If no match is found, you receive { found: false, reason: string }.

Streaming Scrapers
I wrote these streaming scrapers to fetch sources around the internet. When fetching sources, we aim to find a hls playlist or a video url, along with some headers.

Videasy
Vidlink
Hexa
SmashyStream
YFlix
Spenflix
MovieBox
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function resolveVideasy({ title, year, tmdbId, mediaType = 'movie', server = 'myflixerzupcloud' }) {
  const qs = new URLSearchParams({ title, year: String(year), tmdbId: String(tmdbId) });
  if (mediaType === 'tv') qs.set('mediaType', 'tv');

  const apiUrl = `https://api.videasy.net/${server}/sources-with-title?${qs}`;
  const encrypted = await fetch(apiUrl, { headers: { 'User-Agent': UA } }).then((r) => r.text());

  const decrypted = await fetch('https://enc-dec.app/api/dec-videasy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: encrypted, id: String(tmdbId) }),
  }).then((r) => r.json());

  const stream = (decrypted.sources || [])[0];
  return { url: stream.url, headers: { origin: 'https://videasy.net', referer: 'https://videasy.net/' }, type: 'hls' };
}
Downloading Scrapers
I also wrote these downloaders to get direct download links for movies/shows on the Download section of movie/tv pages. These usually dont need headers.

111477
Filmvault
MovieBox
MoviesMod
T4TSA
Vegamovies
Vidzee
async function get111477Downloads({ mediaItem, mediaType = 'movie' }) {
  const q = mediaItem?.title || mediaItem?.name;
  const url = mediaType === 'tv' ? 'https://a.111477.xyz/tvs/' : 'https://a.111477.xyz/movies/';
  const html = await fetch('/api/proxy', { method: 'POST', body: JSON.stringify({ url }) }).then(r => r.text());
  if (!html) return [];

  const row = Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('tr[data-name]'))
    .find(r => r.getAttribute('data-name')?.toLowerCase().includes(q.toLowerCase()));
  if (!row) return [];

  let dUrl = row.getAttribute('data-url');
  if (dUrl.startsWith('/')) dUrl = `https://a.111477.xyz${dUrl}`;

  const dHtml = await fetch('/api/proxy', { method: 'POST', body: JSON.stringify({ url: dUrl }) }).then(r => r.text());
  return Array.from(new DOMParser().parseFromString(dHtml, 'text/html').querySelectorAll('a[class*="maxbutton"]'))
    .map(n => ({ url: n.getAttribute('href'), type: 'download' }));
}
Music proxy
The music API (/api/music/[...path]) forwards requests to several Tidal backends with random selection and caching. All responses are CORS-enabled.

squid-api
https://triton.squid.wtf
kinoplus
https://tidal.kinoplus.online
binimum
https://tidal-api.binimum.org
binimum-2
https://tidal-api-2.binimum.org
hund
https://hund.qqdl.site
katze
https://katze.qqdl.site
maus
https://maus.qqdl.site
vogel
https://vogel.qqdl.site
wolf
https://wolf.qqdl.site
Typical paths: /api/music/v1/tracks/:id, /api/music/v1/albums/:id, /api/music/v1/playlists/:id

async function fetchTrack(trackId) {
  const res = await fetch(`/api/music/v1/tracks/${trackId}?countryCode=US`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('music lookup failed');
  return res.json();
}
Want to dig deeper? Join the Discord and ask me about this more deeply.