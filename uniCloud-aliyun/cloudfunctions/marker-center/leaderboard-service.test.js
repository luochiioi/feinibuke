const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildLeaderboard,
  attachFriendFilter,
  aggregateLeaderboardRows
} = require('./leaderboard-service')

// ===== buildLeaderboard =====

test('buildLeaderboard sorts by points desc and caps at limit', () => {
  const rows = [
    { userId: 'u1', nickname: 'A', points: 50,  routes: 3, checkins: 12, firstCheckedAt: 100 },
    { userId: 'u2', nickname: 'B', points: 120, routes: 4, checkins: 11, firstCheckedAt: 200 },
    { userId: 'u3', nickname: 'C', points: 80,  routes: 5, checkins: 10, firstCheckedAt: 300 }
  ]
  const out = buildLeaderboard(rows, { metric: 'points', limit: 2 })
  assert.deepEqual(out.map(r => r.userId), ['u2', 'u3'])
  assert.equal(out[0].rank, 1)
  assert.equal(out[1].rank, 2)
})

test('buildLeaderboard sorts by routes when metric is routes', () => {
  const rows = [
    { userId: 'u1', points: 999, routes: 1, checkins: 0, firstCheckedAt: 1 },
    { userId: 'u2', points: 0,   routes: 5, checkins: 0, firstCheckedAt: 2 }
  ]
  const out = buildLeaderboard(rows, { metric: 'routes', limit: 5 })
  assert.equal(out[0].userId, 'u2')
  assert.equal(out[0].value, 5)
})

test('buildLeaderboard sorts by checkins when metric is checkins', () => {
  const rows = [
    { userId: 'u1', points: 0, routes: 0, checkins: 9,  firstCheckedAt: 1 },
    { userId: 'u2', points: 0, routes: 0, checkins: 25, firstCheckedAt: 2 }
  ]
  const out = buildLeaderboard(rows, { metric: 'checkins', limit: 5 })
  assert.equal(out[0].userId, 'u2')
  assert.equal(out[0].value, 25)
})

test('buildLeaderboard breaks ties by earlier firstCheckedAt then uid string', () => {
  const rows = [
    { userId: 'u3', points: 50, routes: 0, checkins: 0, firstCheckedAt: 300 },
    { userId: 'u1', points: 50, routes: 0, checkins: 0, firstCheckedAt: 100 },
    { userId: 'u2', points: 50, routes: 0, checkins: 0, firstCheckedAt: 100 }
  ]
  const out = buildLeaderboard(rows, { metric: 'points', limit: 5 })
  assert.deepEqual(out.map(r => r.userId), ['u1', 'u2', 'u3'])
})

test('buildLeaderboard clamps limit to safe range [1, 50]', () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({
    userId: `u${i}`, points: 1000 - i, routes: 0, checkins: 0, firstCheckedAt: i
  }))
  assert.equal(buildLeaderboard(rows, { metric: 'points', limit: 9999 }).length, 50)
  assert.equal(buildLeaderboard(rows, { metric: 'points', limit: 0 }).length, 1)
  assert.equal(buildLeaderboard(rows, { metric: 'points', limit: -5 }).length, 1)
})

test('buildLeaderboard defaults to metric=points when invalid', () => {
  const rows = [
    { userId: 'u1', points: 100, routes: 0, checkins: 99, firstCheckedAt: 1 },
    { userId: 'u2', points: 50,  routes: 0, checkins: 1,  firstCheckedAt: 2 }
  ]
  const out = buildLeaderboard(rows, { metric: 'wat', limit: 5 })
  assert.equal(out[0].userId, 'u1')
  assert.equal(out[0].metric, 'points')
})

test('buildLeaderboard tolerates empty / null rows', () => {
  assert.deepEqual(buildLeaderboard(null, { metric: 'points', limit: 10 }), [])
  assert.deepEqual(buildLeaderboard([], { metric: 'points', limit: 10 }), [])
})

// ===== attachFriendFilter =====

test('attachFriendFilter keeps only rows in allowed set', () => {
  const rows = [
    { userId: 'u1', points: 1 },
    { userId: 'u2', points: 2 },
    { userId: 'u3', points: 3 }
  ]
  const out = attachFriendFilter(rows, new Set(['u1', 'u3']))
  assert.deepEqual(out.map(r => r.userId), ['u1', 'u3'])
})

test('attachFriendFilter handles empty / null allow set', () => {
  const rows = [{ userId: 'u1' }]
  assert.deepEqual(attachFriendFilter(rows, new Set()), [])
  assert.deepEqual(attachFriendFilter(rows, null), [])
})

test('attachFriendFilter tolerates non-array rows', () => {
  assert.deepEqual(attachFriendFilter(null, new Set(['u1'])), [])
})

// ===== aggregateLeaderboardRows =====

test('aggregateLeaderboardRows joins rewards / routes / users by userId', () => {
  const rewards = [
    { userId: 'u1', rewardPoints: 20, earnedAt: 100 },
    { userId: 'u1', rewardPoints: 30, earnedAt: 200 },
    { userId: 'u2', rewardPoints: 50, earnedAt: 150 }
  ]
  const userRoutes = [
    { userId: 'u1', routeId: 1, completedAt: 100 },
    { userId: 'u1', routeId: 2, completedAt: 200 },
    { userId: 'u2', routeId: 1, completedAt: 150 }
  ]
  const userProfiles = [
    { userId: 'u1', nickname: 'Alice', avatar: 'a.png', totalCheckins: 9 },
    { userId: 'u2', nickname: 'Bob',   avatar: 'b.png', totalCheckins: 4 }
  ]
  const rows = aggregateLeaderboardRows({ rewards, userRoutes, userProfiles })
  rows.sort((a, b) => a.userId.localeCompare(b.userId))

  assert.equal(rows[0].userId, 'u1')
  assert.equal(rows[0].points, 50)
  assert.equal(rows[0].routes, 2)
  assert.equal(rows[0].checkins, 9)
  assert.equal(rows[0].firstCheckedAt, 100)
  assert.equal(rows[0].nickname, 'Alice')

  assert.equal(rows[1].userId, 'u2')
  assert.equal(rows[1].points, 50)
  assert.equal(rows[1].routes, 1)
  assert.equal(rows[1].checkins, 4)
  assert.equal(rows[1].firstCheckedAt, 150)
})

test('aggregateLeaderboardRows includes users with only profile rows (no rewards)', () => {
  const rows = aggregateLeaderboardRows({
    rewards: [],
    userRoutes: [],
    userProfiles: [{ userId: 'u9', nickname: 'Solo', totalCheckins: 3 }]
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].userId, 'u9')
  assert.equal(rows[0].points, 0)
  assert.equal(rows[0].routes, 0)
  assert.equal(rows[0].checkins, 3)
  assert.equal(rows[0].firstCheckedAt, 0)
})

test('aggregateLeaderboardRows skips rewards without userId or numeric points', () => {
  const rows = aggregateLeaderboardRows({
    rewards: [
      { userId: '', rewardPoints: 99 },
      { userId: 'u1', rewardPoints: 'nope' },
      { userId: 'u1', rewardPoints: 10, earnedAt: 1 }
    ],
    userRoutes: [],
    userProfiles: [{ userId: 'u1' }]
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].points, 10)
})
