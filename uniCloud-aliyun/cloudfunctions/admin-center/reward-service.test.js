const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseRewardPoints,
  aggregateRewardStatsByUser,
  normalizeRewardRecords
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
    claimedRewardPoints: 10,
    pendingRewardPoints: 25,
    routeRewardCount: 1,
    taskRewardCount: 2,
    claimedCount: 1,
    pendingCount: 2
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
  assert.equal(rows[1].statusText, '待兑')
  assert.equal(rows[1].claimedAt, null)
})
