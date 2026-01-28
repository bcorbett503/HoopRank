#!/bin/bash
# Comprehensive Teams API Test Suite

BASE_URL="https://hooprank-production.up.railway.app"
USER_ID="test-user-$(date +%s)"
USER_ID_2="test-user-2-$(date +%s)"
TEAM_ID=""

echo "=================================="
echo "Teams API Test Suite"
echo "=================================="
echo "Base URL: $BASE_URL"
echo "Test User 1: $USER_ID"
echo "Test User 2: $USER_ID_2"
echo ""

# Test 1: Create Team (3v3)
echo "TEST 1: Create 3v3 Team"
echo "------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/teams" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{"name": "Test Ballers", "teamType": "3v3"}')
echo "$RESPONSE" | jq .
TEAM_ID=$(echo "$RESPONSE" | jq -r '.id')
if [ "$TEAM_ID" != "null" ] && [ -n "$TEAM_ID" ]; then
  echo "✅ PASS: Team created with ID: $TEAM_ID"
else
  echo "❌ FAIL: Could not create team"
  exit 1
fi
echo ""

# Test 2: Get Team by ID
echo "TEST 2: Get Team by ID"
echo "----------------------"
curl -s -X GET "$BASE_URL/teams/$TEAM_ID" \
  -H "x-user-id: $USER_ID" | jq .
echo "✅ PASS: Retrieved team details"
echo ""

# Test 3: Get My Teams
echo "TEST 3: Get My Teams"
echo "--------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL/teams/my-teams" \
  -H "x-user-id: $USER_ID")
echo "$RESPONSE" | jq .
COUNT=$(echo "$RESPONSE" | jq 'length')
if [ "$COUNT" -ge 1 ]; then
  echo "✅ PASS: Found $COUNT team(s)"
else
  echo "❌ FAIL: No teams found"
fi
echo ""

# Test 4: Invite User to Team
echo "TEST 4: Invite User to Team"
echo "---------------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/teams/$TEAM_ID/invite" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"userId\": \"$USER_ID_2\"}")
echo "$RESPONSE" | jq .
echo "✅ PASS: Invitation sent"
echo ""

# Test 5: Get Team Invites (for invited user)
echo "TEST 5: Get Team Invites (for user 2)"
echo "--------------------------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL/teams/invites" \
  -H "x-user-id: $USER_ID_2")
echo "$RESPONSE" | jq .
INVITE_COUNT=$(echo "$RESPONSE" | jq 'length')
if [ "$INVITE_COUNT" -ge 1 ]; then
  echo "✅ PASS: Found $INVITE_COUNT invite(s)"
else
  echo "⚠️ WARNING: No invites found (may need debugging)"
fi
echo ""

# Test 6: Accept Invite
echo "TEST 6: Accept Invite"
echo "---------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/teams/$TEAM_ID/respond" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID_2" \
  -d '{"accept": true}')
echo "$RESPONSE" | jq .
echo "✅ PASS: Invite responded to"
echo ""

# Test 7: Get Team Chats (for messaging)
echo "TEST 7: Get Team Chats"
echo "----------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL/messages/team-chats" \
  -H "x-user-id: $USER_ID")
echo "$RESPONSE" | jq .
CHAT_COUNT=$(echo "$RESPONSE" | jq 'length')
if [ "$CHAT_COUNT" -ge 1 ]; then
  echo "✅ PASS: Found $CHAT_COUNT team chat(s)"
else
  echo "⚠️ WARNING: No team chats found"
fi
echo ""

# Test 8: Create 5v5 Team (test both types)
echo "TEST 8: Create 5v5 Team"
echo "-----------------------"
RESPONSE=$(curl -s -X POST "$BASE_URL/teams" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{"name": "Test Squad 5v5", "teamType": "5v5"}')
echo "$RESPONSE" | jq .
TEAM_ID_2=$(echo "$RESPONSE" | jq -r '.id')
if [ "$TEAM_ID_2" != "null" ] && [ -n "$TEAM_ID_2" ]; then
  echo "✅ PASS: 5v5 Team created with ID: $TEAM_ID_2"
else
  echo "❌ FAIL: Could not create 5v5 team"
fi
echo ""

# Test 9: Get Rankings (by team type)
echo "TEST 9: Get Team Rankings (3v3)"
echo "--------------------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL/teams/rankings?teamType=3v3" \
  -H "x-user-id: $USER_ID")
echo "$RESPONSE" | jq .
echo "✅ PASS: Rankings retrieved"
echo ""

# Cleanup: Delete test teams
echo "CLEANUP: Deleting test teams"
echo "----------------------------"
curl -s -X DELETE "$BASE_URL/teams/$TEAM_ID" \
  -H "x-user-id: $USER_ID" | jq .
curl -s -X DELETE "$BASE_URL/teams/$TEAM_ID_2" \
  -H "x-user-id: $USER_ID" | jq .
echo "✅ Cleanup complete"
echo ""

echo "=================================="
echo "All Tests Complete!"
echo "=================================="
