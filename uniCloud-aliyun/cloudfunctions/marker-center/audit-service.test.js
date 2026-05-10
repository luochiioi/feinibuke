const assert = require('node:assert/strict')
const test = require('node:test')

const { buildAuditLogEntry } = require('./audit-service')

test('marker-center audit schema accepts user.deleteCheckin rows', () => {
  const row = buildAuditLogEntry({
    type: 'user.deleteCheckin',
    actorUid: 'u1',
    targetUid: 'u1',
    markerId: 7,
    markerTitle: 'Marker',
    occurredAt: 1800000000000
  })

  assert.equal(row.type, 'user.deleteCheckin')
  assert.equal(row.actorUid, 'u1')
  assert.equal(row.markerId, 7)
  assert.equal(row.occurredAt, 1800000000000)
})

test('marker-center audit schema accepts user.claimReward rows', () => {
  const row = buildAuditLogEntry({
    type: 'user.claimReward',
    actorUid: 'u1',
    targetUid: 'u1',
    reason: 'reward:rw-1',
    occurredAt: 1800000000000
  })

  assert.equal(row.type, 'user.claimReward')
  assert.equal(row.actorUid, 'u1')
  assert.equal(row.targetUid, 'u1')
  assert.equal(row.reason, 'reward:rw-1')
  assert.equal(row.occurredAt, 1800000000000)
})

test('marker-center audit schema rejects unknown rows', () => {
  assert.equal(buildAuditLogEntry({ type: 'admin.deleteUser' }), null)
  assert.equal(buildAuditLogEntry(null), null)
})
