const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseRewardPoints,
  aggregateRewardStatsByUser,
  filterRewardRecords,
  normalizeRewardRecords,
  buildAdminPointsSummary
} = require('./reward-service')

test('parseRewardPoints extracts integer points from common reward text', () => {
  assert.equal(parseRewardPoints('20 积分'), 20)
  assert.equal(parseRewardPoints('20 points'), 20)
  assert.equal(parseRewardPoints('奖励：35 积分 + 徽章'), 35)
  assert.equal(parseRewardPoints('badge only'), 0)
  assert.equal(parseRewardPoints(null), 0)
})

test('aggregateRewardStatsByUser groups points and claim counts per user', () => {
  const stats = aggregateRewardStatsByUser([
    { userId: 'uid-1', source: 'route', reward: '20 积分', rewardClaimed: false },
    { userId: 'uid-1', source: 'task', reward: '10 points', rewardClaimed: true },
    { userId: 'uid-1', taskId: 'task_legacy', reward: '5 积分', rewardClaimed: false },
    { userId: 'uid-2', source: 'route', reward: 'Badge', rewardPoints: 12, rewardClaimed: true },
    { userId: '', source: 'route', reward: '99 积分' },
    { source: 'task', reward: '99 积分' }
  ])

  assert.deepEqual(stats.get('uid-1'), {
    totalRewardPoints: 35,
    claimedRewardPoints: 15,
    pendingRewardPoints: 20,
    routeRewardCount: 1,
    taskRewardCount: 2,
    claimedCount: 2,
    pendingCount: 1
  })
  assert.deepEqual(stats.get('uid-2'), {
    totalRewardPoints: 12,
    claimedRewardPoints: 12,
    pendingRewardPoints: 0,
    routeRewardCount: 1,
    taskRewardCount: 0,
    claimedCount: 1,
    pendingCount: 0
  })
  assert.equal(stats.has(''), false)
})

test('normalizeRewardRecords joins user names and exposes claim status', () => {
  const rows = normalizeRewardRecords([
    {
      _id: 'rw-1',
      userId: 'u1',
      source: 'route',
      routeName: 'Macau Walk',
      reward: '20 绉垎',
      rewardClaimed: true,
      claimedAt: 2000,
      earnedAt: 1000
    },
    {
      _id: 'rw-2',
      userId: 'u2',
      taskName: 'Palace',
      reward: '10 points',
      rewardClaimed: false,
      earnedAt: 1500
    }
  ], [
    { _id: 'u1', username: 'alice', nickname: 'Alice' }
  ])

  assert.equal(rows[0].userName, 'Alice')
  assert.equal(rows[0].sourceType, 'route')
  assert.equal(rows[0].sourceTitle, 'Macau Walk')
  assert.equal(rows[0].rewardPoints, 20)
  assert.equal(rows[0].statusText, '已兑')
  assert.equal(rows[0].claimedAt, 2000)
  assert.equal(rows[1].userName, 'u2')
  assert.equal(rows[1].sourceType, 'task')
  assert.equal(rows[1].sourceTitle, 'Palace')
  assert.equal(rows[1].rewardPoints, 10)
  assert.equal(rows[1].rewardClaimed, true)
  assert.equal(rows[1].statusText, rows[0].statusText)
  assert.equal(rows[1].claimedAt, 1500)
})
test('filterRewardRecords treats legacy rows without source as task rewards', () => {
  const rows = [
    { _id: 'route-1', userId: 'u1', source: 'route', routeId: 100, rewardClaimed: false },
    { _id: 'task-1', userId: 'u1', source: 'task', taskId: 'task_001', rewardClaimed: true },
    { _id: 'task-legacy', userId: 'u1', taskId: 'task_002', rewardClaimed: false },
    { _id: 'other-user', userId: 'u2', taskId: 'task_003', rewardClaimed: false }
  ]

  assert.deepEqual(filterRewardRecords(rows, { source: 'task', userId: 'u1' }).map(row => row._id), [
    'task-1',
    'task-legacy'
  ])
  assert.deepEqual(filterRewardRecords(rows, { source: 'route' }).map(row => row._id), ['route-1'])
  assert.deepEqual(filterRewardRecords(rows, { status: 'claimed', userId: 'u1' }).map(row => row._id), [
    'task-1',
    'task-legacy'
  ])
})

test('buildAdminPointsSummary aggregates across users with task/route semantics', () => {
  const rewards = [
    { userId: 'u1', source: 'task', reward: '10 points', earnedAt: 1700000000000 },
    { userId: 'u1', source: 'route', reward: '20 points', earnedAt: 1700000000010, rewardClaimed: false },
    { userId: 'u2', source: 'route', reward: '30 points', earnedAt: 1700000000020, rewardClaimed: true, claimedAt: 1800000000000 },
    { userId: 'u2', taskId: 'task_legacy', reward: '5 points', earnedAt: 1700000000030 }
  ]
  const summary = buildAdminPointsSummary(rewards)

  assert.equal(summary.totalEarnedPoints, 65)
  assert.equal(summary.taskIssuedPoints, 15)
  assert.equal(summary.routeIssuedPoints, 30)
  assert.equal(summary.issuedPoints, 45)
  assert.equal(summary.pendingRoutePoints, 20)
})

test('buildAdminPointsSummary returns zero shape for empty input', () => {
  const summary = buildAdminPointsSummary([])
  assert.equal(summary.totalEarnedPoints, 0)
  assert.equal(summary.issuedPoints, 0)
  assert.equal(summary.pendingRoutePoints, 0)
  assert.equal(summary.taskIssuedPoints, 0)
  assert.equal(summary.routeIssuedPoints, 0)
})
