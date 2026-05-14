const assert = require('node:assert/strict')
const test = require('node:test')

const {
  buildNotification,
  markRead,
  groupByDateHeadings
} = require('./notification-service')

test('buildNotification returns a typed row for every supported type', () => {
  const types = ['friend.requested', 'friend.accepted', 'route.completed', 'route.markerAdded', 'system.broadcast']
  for (const t of types) {
    const row = buildNotification(t, 'u1', { key: 'val' }, 1700000000000)
    assert.equal(row.type, t)
    assert.equal(row.userId, 'u1')
    assert.equal(row.read, false)
    assert.equal(row.readAt, null)
    assert.equal(row.createdAt, 1700000000000)
    assert.deepEqual(row.payload, { key: 'val' })
  }
})

test('buildNotification rejects unknown types', () => {
  assert.equal(buildNotification('foo.bar', 'u1', {}, 1), null)
  assert.equal(buildNotification('', 'u1', {}, 1), null)
  assert.equal(buildNotification(null, 'u1', {}, 1), null)
})

test('buildNotification normalises empty uid to null', () => {
  assert.equal(buildNotification('friend.accepted', '', {}, 1), null)
  assert.equal(buildNotification('friend.accepted', null, {}, 1), null)
})

test('buildNotification defaults payload to empty object', () => {
  const row = buildNotification('friend.accepted', 'u1', null, 1)
  assert.deepEqual(row.payload, {})
})

test('markRead returns a new row with read=true and readAt set', () => {
  const original = { _id: 'n1', read: false, readAt: null, userId: 'u1', type: 'friend.accepted', createdAt: 1 }
  const next = markRead(original, 1700000005000)
  assert.equal(next.read, true)
  assert.equal(next.readAt, 1700000005000)
  assert.equal(original.read, false)
})

test('markRead is a no-op when already read', () => {
  const row = { _id: 'n1', read: true, readAt: 100, userId: 'u1', type: 'friend.accepted', createdAt: 1 }
  assert.equal(markRead(row, 200), null)
})

test('markRead rejects null row', () => {
  assert.equal(markRead(null, 1), null)
})

test('groupByDateHeadings groups rows by YYYY-MM-DD and inserts heading entries', () => {
  const day1 = 1700000000000
  const day2 = day1 + 86400000
  const rows = [
    { _id: 'a', createdAt: day1 },
    { _id: 'b', createdAt: day1 + 1000 },
    { _id: 'c', createdAt: day2 }
  ]
  const out = groupByDateHeadings(rows)
  assert.equal(out.length, 5)
  assert.equal(out[0]._type, 'heading')
  assert.equal(out[0].label, '2023-11-14')
  assert.equal(out[1]._id, 'a')
  assert.equal(out[2]._id, 'b')
  assert.equal(out[3]._type, 'heading')
  assert.equal(out[3].label, '2023-11-15')
  assert.equal(out[4]._id, 'c')
})

test('groupByDateHeadings returns empty for empty input', () => {
  assert.deepEqual(groupByDateHeadings([]), [])
  assert.deepEqual(groupByDateHeadings(null), [])
})
