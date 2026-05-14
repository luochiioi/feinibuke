const assert = require('node:assert/strict')
const test = require('node:test')

const {
  validateTaskInput,
  buildTaskUpsertDoc,
  nextTaskId,
  buildMarkerLookup
} = require('./task-service')

test('validateTaskInput rejects missing id or name', () => {
  assert.throws(() => validateTaskInput({
    name: '任务',
    targetMarkerId: 1
  }), /任务 ID 不能为空/)

  assert.throws(() => validateTaskInput({
    id: 'task_new',
    name: ' ',
    targetMarkerId: 1
  }), /任务名称不能为空/)
})

test('validateTaskInput requires numeric targetMarkerId', () => {
  assert.throws(() => validateTaskInput({
    id: 'task_new',
    name: '任务',
    targetMarkerId: 'bad'
  }), /targetMarkerId 必须是正整数/)
})

test('buildTaskUpsertDoc trims fields, defaults status to active, and does not store targetTitle snapshot', () => {
  const doc = buildTaskUpsertDoc({
    id: ' task_new ',
    name: ' 新任务 ',
    description: ' 描述 ',
    targetMarkerId: '42',
    targetTitle: ' 目标点 ',
    reward: ' 30 积分 ',
    rewardKind: 'points',
    rewardPoints: '30'
  }, 'admin-1', 1700000000)

  assert.deepEqual(doc, {
    id: 'task_new',
    name: '新任务',
    description: '描述',
    targetMarkerId: 42,
    reward: '30 积分',
    rewardKind: 'points',
    rewardPoints: 30,
    status: 'active',
    createdBy: 'admin-1',
    updatedAt: 1700000000
  })
  assert.equal(Object.prototype.hasOwnProperty.call(doc, 'targetTitle'), false)
})

test('buildTaskUpsertDoc validates reward kind and normalizes archived status', () => {
  const doc = buildTaskUpsertDoc({
    id: 'task_old',
    name: '旧任务',
    targetMarkerId: 1,
    rewardKind: 'none',
    reward: 'ignored',
    rewardPoints: 99,
    status: 'archived'
  }, 'admin-1', 1700000000)

  assert.equal(doc.rewardKind, 'none')
  assert.equal(doc.reward, '')
  assert.equal(doc.rewardPoints, 0)
  assert.equal(doc.status, 'archived')
})

test('nextTaskId generates the next sequential task id', () => {
  assert.equal(nextTaskId([
    { id: 'task_001' },
    { id: 'task_009' },
    { id: 'task_010' },
    { id: 'legacy_task' }
  ]), 'task_011')
  assert.equal(nextTaskId([]), 'task_001')
})

test('buildTaskUpsertDoc generates id when creating a task without one', () => {
  const doc = buildTaskUpsertDoc({
    name: '自动编号任务',
    targetMarkerId: 8,
    rewardKind: 'points',
    rewardPoints: 20
  }, 'admin-1', 1700000000, [
    { id: 'task_001' },
    { id: 'task_006' }
  ])

  assert.equal(doc.id, 'task_007')
  assert.equal(doc.name, '自动编号任务')
})

test('buildMarkerLookup returns a Set of numeric marker ids', () => {
  const lookup = buildMarkerLookup([
    { id: 1 }, { id: '2' }, { id: 3.5 }, { id: 'bad' }, null, { id: 4 }
  ])
  assert.equal(lookup.has(1), true)
  assert.equal(lookup.has(2), true)
  assert.equal(lookup.has(4), true)
  assert.equal(lookup.has(3.5), false)
  assert.equal(lookup.size, 3)
})

test('validateTaskInput rejects targetMarkerId not in marker lookup', () => {
  const lookup = buildMarkerLookup([{ id: 1 }, { id: 2 }])
  assert.throws(() => validateTaskInput({
    id: 'task_new',
    name: '任务',
    targetMarkerId: 99,
    rewardKind: 'points'
  }, undefined, lookup), /目标打卡点不存在/)
})

test('validateTaskInput accepts targetMarkerId that exists in marker lookup', () => {
  const lookup = buildMarkerLookup([{ id: 1 }, { id: 2 }])
  assert.equal(validateTaskInput({
    id: 'task_new',
    name: '任务',
    targetMarkerId: 2,
    rewardKind: 'points'
  }, undefined, lookup), true)
})

test('buildTaskUpsertDoc throws when marker lookup is provided and id missing', () => {
  const lookup = buildMarkerLookup([{ id: 1 }])
  assert.throws(() => buildTaskUpsertDoc({
    name: '任务',
    targetMarkerId: 9,
    rewardKind: 'points'
  }, 'admin-1', 1700000000, null, lookup), /目标打卡点不存在/)
})
