const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseRewardPoints,
  aggregateRewardStatsByUser
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
