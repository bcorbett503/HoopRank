# HoopRank
Second build
Basketball Social Network App — Engineering Roadmap 1.0
A phase by phase build guide with clear, test driven deliverables that an AI coding agent can execute from an empty repo to production launch.
________________________________________
0 · Project Foundation (Week 0)
Track	Tasks	Acceptance
Repo & Tooling	• Initialize monorepo (/backend, /mobile, /infra).• Pre commit hooks (lint, format).• GitHub Actions skeleton.	main protected branch; all checks green.
Dev Envs	Docker compose for Postgres + Redis + RabbitMQ; .devcontainer for VS Code.	docker compose up exposes API on localhost:3000.
CI/CD	GH Actions → AWS ECS blue green; staging & prod ECS clusters.	Tag v0.1.0 auto deployed to staging.
________________________________________
1 · Core Backend / UI & MVP Matchmaking (Weeks 1 – 6)
(Full spec in Phase I doc) 
Area	Deliverables
Auth & Profiles	Google & Facebook OAuth; JWT (30 min access / 14 d refresh).
Play Flow	QR & Direct Invite matches for 1 v 1; status = pending → accepted → completed.
Rating Engine	HoopRank 1.0 – 5.0 (seed 2.5; K = 0.15).
API	POST /matches → GET /matches/{id}/qr → POST /matches/{id}/complete.GET /users/{id} returns profile + badges (empty list for now).
Tests	Unit: rating math; Integration: match lifecycle; E2E: QR scan.
Done	New user → play match → both ratings update within 5 s, visible on mobile.
________________________________________
2 · Match Integrity & Team Formats (Weeks 7 – 12)
(See Phase 2 spec) 
Track	Deliverables
Team Elo	2 v 2 & 3 v 3; team average calc.
Geo Verification	GPS check in ≤ 75 m; matchToken issued.
Two Stage Rating	elo_provisional → confirmed after 24 h or instant mutual confirm.
AutoMod v1	Rules engine flags anomalies; /integrity/alerts admin API.
DB	court_id, status, elo_history, `elo_provisional
Tests	Unit: haversine util, AutoMod rules; E2E: spoofed GPS blocked.
Done	≥ 95 % legit matches geo verified; provisional → confirmed worker runs hourly.
________________________________________
3A · Casual Shooting Modes (Weeks 13 – 18)
(Detailed spec) 
Deliverables
HORSE, 3 Pt 25, 7s engine + Flutter UIs.
Shooting Rank (parallel 1.0 – 5.0 scale).
Peer confirmation flow & dispute timer.
Anti cheat hooks (GPS proximity, pace checks).
POST /games, POST /games/{id}/result, PATCH /games/{id}/confirm.
Done: All three modes playable end to end; Shooting Rank visible on profile.
________________________________________
3B · Rank Impact Visualization (Weeks 19 – 22)
(Spec) 
Deliverables
Post match delta card (prelim → confirmed).
30 day HoopRank chart (/analytics/elo/history).
Social share of card/chart.
Weekly EloSnapshot aggregation Lambda.
Done: Card renders < 300 ms; default chart < 400 ms; share sheet works on iOS & Android.
________________________________________
4 · Challenges, Notifications & Discover Players (Weeks 23 – 28)
Track	Deliverables
Push	FCM topics: personal, friends, radius, court.
Runs / Group Chat	/runs CRUD, match linking.
Player Visibility	users.visibility_scope, radius_limit_km, rank_window columns.
Search API	GET /players/search?radius&rankMin&rankMax&city.
Frontend	Home nav tabs: Play, Discover Players (map/list toggle).
Tests	Privacy unit tests; integration search respects scope.
Done: User can opt in discoverability and find others within filters.	
________________________________________
5 · Disputes & Reputation (Weeks 29 – 34)
Deliverables
24 h dispute chat; evidence upload; moderator console.
Reputation metrics: sportsmanship, dispute ratio.
K factor dampening for low rep.
/disputes/* endpoints; /reputation/{id}.
Done: < 2 % unresolved disputes after 48 h in beta cohort.
________________________________________
6 · Monetization & Leaderboards (Weeks 35 – 40)
Track	Deliverables
Ads	AdMob banners/interstitials; feature flag.
Premium	Placeholder paywall for advanced analytics.
Leaderboards	Local (50 km), Regional (state), Global.
Endpoints: /leaderboards/{scope}?page=.	
Done: Ads live to 5 % cohort; leaderboards paginated & cached (p95 < 250 ms).	
________________________________________
7 · Tournaments & Seasonal Events (Weeks 41 – 46)
Deliverables
Bracket engine; /tournaments CRUD for organisers.
Seasonal badge framework (extra K boost config).
Push + calendar sync.
Done: Pilot 16 team tourney completes with automatic bracket progression & badge awards.
________________________________________
8 · Discover Courts Map & King of the Court (Weeks 47 – 52)
Track	Deliverables
PostGIS	Court table (id, name, lat, lng, address, photoUrl).
KOTC Logic	KingStatus rotation trigger; isKotcChallenge flag.
Map API	GET /courts?near, POST /courts, GET /courts/{id}/king, POST /courts/{id}/king/challenge.
Frontend	Discover Courts tab; map clusters; court sheets; challenge button.
Tests	Geo index performance; king rotation unit tests.
Done: Users can discover courts, view reigning kings, and issue rank gated challenges.	
________________________________________
9 · Social Sharing & UGC (Weeks 53 – 58)
Deliverables
Video upload (S3 presigned); highlight generator.
Tagging & community voting API.
Infinite feed; moderation queue.
Done: 1 min highlight clip uploads with < 5 s start to view latency.
________________________________________
10 · Polish, Achievements, Security & Continuous Deployment (Weeks 59 – 64)
Track	Deliverables
Badges 2.0	50+ achievements; animated unlock.
GDPR & CCPA	Data export / delete endpoints; legal content.
Pentest Fixes	OWASP top 10 scan clean.
CD	One click prod deploy via GitHub Release; canary & rollback.
Done: Security review signed; 99.9 % crash free sessions in GA.	
________________________________________
11 · Cross Phase Test Matrix
Phase	Unit	Integration	E2E	Performance
1 → 10	Rating math, Haversine, KOTC trigger, …	REST contract, worker jobs	Detox / Flutter Driver scripts	k6 + Locust — p95 < 250 ms
________________________________________
12 · API Versioning Convention
•	v1 — Phases 1 – 3B
•	v2 — Breaking changes introduced in Phase 4 (visibility), Phase 8 (PostGIS court search).
•	SemVer tagging on OpenAPI docs; AI agent regenerates API stubs on version bump.
________________________________________
13 · Target Timeline Summary
Quarter	Major Releases
Q1 ’26	Phases 0–2 live (core play + integrity).
Q2 ’26	Phases 3A–4 (shooting modes, discover players).
Q3 ’26	Phases 5–7 (reputation, monetization, tournaments).
Q4 ’26	Phases 8–10 (maps, social UGC, polish & compliance).
(6 × two week sprints per quarter; buffer = 4 weeks).
________________________________________
🔑 Guidance for the AI Coding Agent
1.	Follow phase order strictly – later features assume earlier schemas.
2.	Use branch naming: phase-<n>/<feature>; PR must include tests & OpenAPI update.
3.	After each phase, run the acceptance tests block above before merging to main.
4.	Telemetry first: instrument metrics when you build, not afterwards.
5.	Keep HoopRank integrity sacrosanct – any code path that touches ratings must have >90 % unit test coverage.
________________________________________
