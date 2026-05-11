const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ROUTE_STATUS_ACTIVE,
  ROUTE_STATUS_ARCHIVED,
  sanitizeRouteCreate,
  sanitizeRouteUpdate,
  validateRouteMarkerIds,
  calcRouteProgress,
  isRouteCompleted
} = require('./route-service')

test('sanitizeRouteCreate trims, dedupes markerIds and locks creator + timestamps', () => {
  const route = sanitizeRouteCreate({
    name: '  湖湘文化之旅  ',
    description: ' 探访湖湘三大文化地标 ',
    coverImage: ' cloud://demo/cover.jpg ',
    markerIds: [3, 5, 7, 5, '3'],
    reward: ' 20 积分 + 路线徽章 ',
    rewardKind: 'both',
    rewardPoints: '20',
    createdBy: 'attacker',
    createdAt: 0,
    id: 999
  }, 'admin-1', 1700000000)

  assert.deepEqual(route, {
    id: 1700000000,
    name: '湖湘文化之旅',
    description: '探访湖湘三大文化地标',
    coverImage: 'cloud://demo/cover.jpg',
    markerIds: [3, 5, 7],
    reward: '20 积分 + 路线徽章',
    rewardKind: 'both',
    rewardPoints: 20,
    status: ROUTE_STATUS_ACTIVE,
    createdBy: 'admin-1',
    createdAt: 1700000000,
    updatedAt: 1700000000
  })
})

test('sanitizeRouteCreate defaults legacy routes to prize reward kind', () => {
  const route = sanitizeRouteCreate({
    name: 'legacy',
    markerIds: [1],
    reward: '路线徽章'
  }, 'admin', 1000)

  assert.equal(route.rewardKind, 'prize')
  assert.equal(route.rewardPoints, 0)
})

test('sanitizeRouteCreate rejects prize or both reward kind without reward text', () => {
  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1],
    rewardKind: 'prize',
    reward: ''
  }, 'admin', 1), /奖励文案不能为空/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1],
    rewardKind: 'both',
    rewardPoints: 20,
    reward: ''
  }, 'admin', 1), /奖励文案不能为空/)
})

test('sanitizeRouteCreate accepts no-reward routes with empty reward and zero points', () => {
  const route = sanitizeRouteCreate({
    name: 'no reward',
    markerIds: [1],
    rewardKind: 'none',
    reward: ' ignored ',
    rewardPoints: 99
  }, 'admin', 1000)

  assert.equal(route.rewardKind, 'none')
  assert.equal(route.reward, '')
  assert.equal(route.rewardPoints, 0)
})

test('sanitizeRouteCreate accepts points-only routes without reward text', () => {
  const route = sanitizeRouteCreate({
    name: 'points',
    markerIds: [1],
    rewardKind: 'points',
    rewardPoints: '50',
    reward: ''
  }, 'admin', 1000)

  assert.equal(route.rewardKind, 'points')
  assert.equal(route.reward, '')
  assert.equal(route.rewardPoints, 50)
})

test('sanitizeRouteCreate rejects empty name and over-long name', () => {
  assert.throws(() => sanitizeRouteCreate({
    name: '   ',
    markerIds: [1],
    reward: '10 分'
  }, 'admin', 1), /路线名称不能为空/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'a'.repeat(31),
    markerIds: [1],
    reward: '10 分'
  }, 'admin', 1), /不能超过 30/)
})

test('sanitizeRouteCreate rejects empty markerIds and bad entries', () => {
  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [],
    reward: '10 分'
  }, 'admin', 1), /至少包含 1 项/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1, 'not-a-number', 3],
    reward: '10 分'
  }, 'admin', 1), /必须是正整数/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1, 0, 3],
    reward: '10 分'
  }, 'admin', 1), /必须是正整数/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: 'not-array',
    reward: '10 分'
  }, 'admin', 1), /必须是数组/)
})

test('sanitizeRouteCreate rejects over-long description and reward', () => {
  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    description: 'd'.repeat(201),
    markerIds: [1],
    reward: '10 分'
  }, 'admin', 1), /不能超过 200/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1],
    reward: 'r'.repeat(101)
  }, 'admin', 1), /不能超过 100/)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1],
    reward: '   '
  }, 'admin', 1), /奖励文案不能为空/)
})

test('sanitizeRouteCreate normalizes empty cover image to null and validates status', () => {
  const route = sanitizeRouteCreate({
    name: 'r',
    coverImage: '   ',
    markerIds: [1],
    reward: '10 分',
    status: ROUTE_STATUS_ARCHIVED
  }, 'admin', 1)
  assert.equal(route.coverImage, null)
  assert.equal(route.status, ROUTE_STATUS_ARCHIVED)

  assert.throws(() => sanitizeRouteCreate({
    name: 'r',
    markerIds: [1],
    reward: '10 分',
    status: 'pending'
  }, 'admin', 1), /status 必须是/)
})

test('sanitizeRouteUpdate only writes provided fields and stamps updatedAt', () => {
  const updates = sanitizeRouteUpdate({
    name: '新名',
    markerIds: [2, 2, 4],
    rewardKind: 'points',
    rewardPoints: '30',
    reward: '',
    status: ROUTE_STATUS_ARCHIVED
  }, 1700001000)

  assert.deepEqual(updates, {
    name: '新名',
    markerIds: [2, 4],
    reward: '',
    rewardKind: 'points',
    rewardPoints: 30,
    status: ROUTE_STATUS_ARCHIVED,
    updatedAt: 1700001000
  })
})

test('sanitizeRouteUpdate rejects bad fields without falling back', () => {
  assert.throws(() => sanitizeRouteUpdate({ name: '' }, 1), /路线名称不能为空/)
  assert.throws(() => sanitizeRouteUpdate({ markerIds: [] }, 1), /至少包含 1 项/)
})

test('validateRouteMarkerIds reports missing ids', () => {
  assert.deepEqual(
    validateRouteMarkerIds([1, 2, 3], [1, 2, 3, 4]),
    { ok: true, missing: [] }
  )
  assert.deepEqual(
    validateRouteMarkerIds([1, 99], [1, 2, 3]),
    { ok: false, missing: [99] }
  )
  assert.deepEqual(
    validateRouteMarkerIds([], [1, 2]),
    { ok: true, missing: [] }
  )
})

test('calcRouteProgress returns done/pending split with ratio', () => {
  const route = { markerIds: [3, 5, 7] }
  assert.deepEqual(calcRouteProgress(route, [3, 5]), {
    total: 3,
    done: 2,
    ratio: 2 / 3,
    doneMarkerIds: [3, 5],
    pendingMarkerIds: [7]
  })
  assert.deepEqual(calcRouteProgress(route, []), {
    total: 3,
    done: 0,
    ratio: 0,
    doneMarkerIds: [],
    pendingMarkerIds: [3, 5, 7]
  })
  assert.deepEqual(calcRouteProgress({ markerIds: [] }, [1, 2]), {
    total: 0,
    done: 0,
    ratio: 0,
    doneMarkerIds: [],
    pendingMarkerIds: []
  })
})

test('isRouteCompleted requires every marker checked and at least one marker', () => {
  const route = { markerIds: [3, 5, 7] }
  assert.equal(isRouteCompleted(route, [3, 5, 7]), true)
  assert.equal(isRouteCompleted(route, [3, 5, 7, 9]), true)
  assert.equal(isRouteCompleted(route, [3, 5]), false)
  assert.equal(isRouteCompleted(route, []), false)
  assert.equal(isRouteCompleted({ markerIds: [] }, []), false)
})
