# Curator Lab Design

## Overview

Curator Lab is a new logged-in user feature with two modes:

1. `Pick For Me`
2. `Build A Playlist`

It should feel agentic without depending on an LLM as the core intelligence layer.

The first version uses:

- user taste memory
- session feedback memory
- TMDB metadata
- deterministic scoring
- constraint-based playlist generation

LLM support can be added later for prompt rewriting, naming, and explanations, but the recommendation core should work without it.

## Goals

- Give users faster, more personal discovery.
- Let users train recommendations with lightweight feedback.
- Let users generate new playlists directly into their account.
- Improve over time using the logged-in user's own history and prior agent sessions.
- Keep the first version frontend-first and low-risk.

## Non-Goals

- No full chatbot experience in v1.
- No requirement for backend AI inference.
- No exact semantic understanding of arbitrary free-form prompts in v1.
- No hidden black-box ranking that cannot be explained.

## Modes

### Pick For Me

Purpose:

- Help the user find the next thing to watch quickly.

Interaction:

- Show one main recommendation card at a time with optional alternates.
- User can provide fast feedback:
  - `Smash`
  - `Pass`
  - `Already Watched`
  - `More Like This`
  - `Less Like This`
  - optional tags like `Too Slow`, `Too Dark`, `Too Popular`

Outputs:

- next recommendation
- short reason string
- save to playlist
- add to shortlist
- convert recent smashes into a playlist

### Build A Playlist

Purpose:

- Turn a user request into a full playlist draft and save it as a new playlist.

Interaction:

- Natural-language prompt plus chips/filters.
- Agent proposes:
  - playlist title
  - short vibe summary
  - recommended titles
  - reason per title
- User can:
  - regenerate all
  - replace one item
  - pin an item
  - remove an item
  - change constraints
  - save as a new playlist

Outputs:

- newly created playlist in the logged-in user's account
- stored session history and feedback for future personalization

## Intelligence Model

The system should be built as a non-LLM taste engine.

### Inputs

- recent view sessions
- wrapped stats
- playlists created
- playlists liked
- recent searches
- agent feedback history
- agent session prompts
- explicit user preferences from Curator Lab
- TMDB metadata for candidate titles

### Taste Profile Layers

Maintain two profiles:

1. `long_term_profile`
2. `session_profile`

#### Long Term Profile

Derived from:

- genres watched
- genres smashed/passed
- movie vs TV preference
- year-range preference
- niche vs mainstream tendency
- rewatch tendency
- language/region preference if inferable

#### Session Profile

Derived from current Curator Lab session:

- current mode
- active prompt
- current chips/filters
- current smash/pass sequence
- temporary preference shifts like `more intense` or `shorter runtime`

The final score should combine both:

`final_profile = 0.75 long_term + 0.25 session`

Session weight can increase during the current interaction if the user gives more feedback.

## Candidate Scoring

Each candidate gets a weighted score from normalized features.

### Suggested v1 score

`score =`

- `genre_match * 0.22`
- `similarity_to_smashed_titles * 0.20`
- `distance_from_passed_titles * 0.14`
- `user_history_affinity * 0.12`
- `freshness_unwatched_boost * 0.10`
- `prompt_constraint_match * 0.10`
- `quality_popularity_balance * 0.06`
- `runtime_fit * 0.03`
- `diversity_adjustment * 0.03`

Then apply penalties:

- duplicate with existing playlist
- already rejected recently
- already watched recently if the user did not ask for comfort rewatches
- too close to another already-selected candidate

### Feature definitions

#### genre_match

Higher when candidate genres overlap with:

- top watched genres
- top smashed genres
- prompt-requested genres

#### similarity_to_smashed_titles

Use TMDB metadata overlap:

- genres
- keywords if available later
- cast/director if available
- media type
- release era

#### distance_from_passed_titles

Negative influence if title is too similar to recent passes.

#### user_history_affinity

Higher when title resembles things the user:

- liked
- added to playlists
- completed sessions for
- rewatched

#### freshness_unwatched_boost

Boost titles not already present in:

- watch history
- playlists
- recent smashes

#### prompt_constraint_match

Binary/weighted matches for:

- movie vs TV
- year range
- runtime bucket
- include/exclude anime
- include/exclude genre
- hidden gem preference

#### quality_popularity_balance

Use vote average + popularity to match the user's tendency:

- mainstream lover
- balanced
- hidden gem seeker

#### runtime_fit

Useful for prompts like:

- under 2 hours
- short episodes
- low commitment

#### diversity_adjustment

Used more strongly in playlist generation than recommendation mode.

## Prompt Parsing Without LLM

In v1, use rule-based parsing into a structured query object.

Example structured object:

```ts
type CuratorRequest = {
  mode: 'pick' | 'playlist';
  count?: number;
  mediaType?: 'movie' | 'tv' | 'mixed';
  includeGenres?: string[];
  excludeGenres?: string[];
  vibeTags?: string[];
  runtimeBucket?: 'short' | 'medium' | 'long';
  yearRange?: { from?: number; to?: number };
  hiddenGemBias?: 'low' | 'medium' | 'high';
  comfortVsNovelty?: 'comfort' | 'balanced' | 'novel';
  animeAllowed?: boolean;
};
```

Use:

- keyword dictionary
- chip-based filters
- regex for counts and years
- fallback defaults

Examples:

- "8 dark thrillers no anime"
- "late night sci-fi under 2 hours"
- "hidden gems like my recent vibe"

This is enough for v1.

## Playlist Generation Algorithm

### Steps

1. Parse prompt into structured request.
2. Build candidate pool from TMDB endpoints.
3. Remove blocked titles:
   - already rejected recently
   - already in target playlist
   - duplicates
4. Score all candidates.
5. Select top candidates with diversity rules.
6. Order playlist intentionally.
7. Generate simple title and summary.
8. Present draft.
9. Save to a new playlist on approval.

### Diversity rules

Do not let the draft become over-clustered.

Suggested guardrails:

- max 2 titles from same franchise
- at least 2 year clusters if count >= 8
- avoid identical genre stack repeated too often
- prefer mix of popular + less obvious if hidden gem bias is medium/high

## Memory Model

### What should be remembered

- prompts used
- titles smashed
- titles passed
- titles marked watched
- generated playlist drafts
- saved playlists created from Curator Lab
- explicit preferences
- soft preferences inferred from behavior

### What should not be silently locked forever

- session-only mood shifts
- one-off experimental prompts

These should decay or stay session-scoped.

## Proposed Database Schema

### curator_sessions

```sql
create table public.curator_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('pick', 'playlist')),
  prompt text,
  session_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### curator_feedback

```sql
create table public.curator_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.curator_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tmdb_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  feedback text not null check (
    feedback in (
      'smash',
      'pass',
      'already_watched',
      'more_like_this',
      'less_like_this',
      'too_slow',
      'too_dark',
      'too_popular'
    )
  ),
  feedback_weight numeric not null default 1,
  created_at timestamptz not null default now()
);
```

### curator_preferences

```sql
create table public.curator_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  explicit_preferences jsonb not null default '{}'::jsonb,
  inferred_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

### curator_generated_playlists

```sql
create table public.curator_generated_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.curator_sessions(id) on delete set null,
  playlist_id uuid references public.playlists(id) on delete set null,
  title text not null,
  summary text,
  request_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Frontend Architecture

### New Page

Add a new page/component:

- `components/CuratorLabPage.tsx`
- `components/MobileCuratorLabPage.tsx`

### Subcomponents

- `CuratorModeSwitch`
- `CuratorPromptPanel`
- `CuratorMemoryPanel`
- `RecommendationDeck`
- `RecommendationCard`
- `PlaylistDraftPanel`
- `CuratorFeedbackBar`

### Suggested local state

```ts
type CuratorMode = 'pick' | 'playlist';

type CuratorSessionState = {
  mode: CuratorMode;
  prompt: string;
  chips: string[];
  request: CuratorRequest | null;
  candidateIds: string[];
  shownIds: string[];
  smashedIds: string[];
  passedIds: string[];
  pinnedIds: string[];
  currentDraft: Movie[];
};
```

## Service Layer

Add:

- `services/CuratorService.ts`

Core responsibilities:

- load user taste profile
- parse request
- fetch candidate pool
- score candidates
- persist feedback
- save generated playlists

### Recommended methods

```ts
loadTasteProfile(userId: string)
parsePrompt(prompt: string, chips: string[]): CuratorRequest
getCandidates(request: CuratorRequest)
scoreCandidates(candidates, profile, sessionState)
getNextRecommendation(...)
generatePlaylistDraft(...)
saveFeedback(...)
saveGeneratedPlaylist(...)
```

## Data Sources

### Existing project data to reuse

- `profiles.stats`
- `profiles.recent_searches`
- `profiles.watch_history` accessors if still relevant
- session-based viewing signals
- playlists owned by user
- playlists liked by user
- existing TMDB service

### Candidate fetch strategy

Use TMDB endpoints already in the codebase:

- similar titles
- discover by genre
- trending
- top rated
- search

Start with a mixed candidate pool:

- 40 percent similarity-based
- 30 percent discover/filter-based
- 20 percent trending/popular
- 10 percent exploratory wildcard

## Explanation System Without LLM

Use template-based reasons.

Examples:

- "Picked because you often save psychological thrillers."
- "Closer to your recent late-night viewing pattern."
- "Matches the dark sci-fi vibe in your prompt."
- "Less mainstream than your usual picks, but still highly rated."

This is enough to make the system feel intelligent in v1.

## Save Flow

When user accepts a playlist draft:

1. create playlist row
2. add items through existing playlist service
3. store generated playlist snapshot
4. route user to the new playlist page

Playlist defaults:

- owner = current user
- type = `custom`
- visibility = ask user or default private

## Privacy and Control

Add explicit controls:

- `Use my taste history`
- `Use only this session`
- `Reset Curator memory`
- `Exclude watched titles`
- `Allow comfort rewatches`

These should be visible because the feature is memory-driven.

## Success Metrics

Track:

- smash rate
- pass rate
- recommendation-to-play conversion
- recommendation-to-playlist-save conversion
- generated-playlist save rate
- regeneration rate
- average accepted items per draft
- repeat Curator Lab usage

## Rollout Plan

### Phase 1

- Curator Lab page shell
- Pick For Me mode
- smash/pass feedback
- session memory only

### Phase 2

- long-term user preference storage
- Build A Playlist mode
- save new playlist flow

### Phase 3

- better prompt parsing
- richer feedback tags
- smarter playlist diversity
- "turn my smashes into playlist"

### Phase 4

- optional LLM enhancement for:
  - playlist naming
  - better summaries
  - prompt rewriting
  - conversational refinement

## Recommended First Build

Implement in this order:

1. database tables for sessions, feedback, preferences
2. Curator service with scoring
3. desktop Curator Lab page
4. Pick For Me feedback loop
5. playlist generation draft flow
6. mobile Curator Lab page
7. metrics and admin visibility

## Future LLM Integration

If added later, the LLM should never replace the core recommender.

Use it only for:

- parsing vague prompts into structured constraints
- generating better playlist titles
- generating richer explanation copy
- handling refinement messages like:
  - "make it darker"
  - "less mainstream"
  - "more emotional"

Core ranking, memory, and filtering should remain deterministic.
