# 🧪 HoopRank Test Suite

> **Quick reference for all tests — run these before every PR.**

## Running Tests

```bash
# Backend unit tests (111 tests, ~4s)
cd backend && npm test

# Backend E2E tests (full API integration)
cd backend && npm run test:e2e

# Mobile Flutter tests
cd mobile && flutter test

# Backend with coverage report
cd backend && npm run test:cov
```

## Backend Unit Tests

All spec files live next to their source files (co-located pattern).

| Module | Spec File | Tests | Coverage |
|--------|-----------|-------|----------|
| **Ratings** | `src/ratings/hooprank.service.spec.ts` | 13 | K-factor, expected score, rating bounds |
| **Runs** | `src/runs/runs.service.spec.ts` | 11 | CRUD, join/leave, duplicate handling |
| **Feed** | `src/statuses/statuses.service.spec.ts` | 16 | Feed scoring algorithm, all boost factors |
| **Challenges** | `src/challenges/challenges.service.spec.ts` | 18 | Create, accept, decline, cancel, active check |
| **Matches** | `src/matches/matches.service.spec.ts` | 19 | Score submit → confirm/contest lifecycle |
| **Messages** | `src/messages/messages.service.spec.ts` | 13 | Send, unread count, read tracking |
| **Users** | `src/users/users.service.spec.ts` | 18 | Auth, profile, follow/unfollow, sanitize |

**Total: 111 tests**

## Backend E2E Tests

Single integrated test file covering all API routes.

| File | Location |
|------|----------|
| API E2E | `test/app.e2e-spec.ts` |

Sections: Health, Users, Courts, Rankings, Challenges, Matches, Runs, Feed, Messages, Teams, Stubs, Subscription

## Mobile Flutter Tests

| Test File | Coverage |
|-----------|----------|
| `test/basketball_marker_test.dart` | Court marker rendering |
| `test/court_deep_link_test.dart` | Deep link parsing |
| `test/court_service_test.dart` | Court data service |
| `test/directions_url_test.dart` | Map URL generation |
| `test/models_test.dart` | Data model serialization |
| `test/transform_data.dart` | Data transformations |
| `test/widgets/challenge_widgets_test.dart` | Challenge UI components |
| `test/widgets/rating_widgets_test.dart` | Rating display widgets |
| `test/widgets/tutorial_overlay_position_test.dart` | Tutorial overlay positioning |
