const assert = require('node:assert/strict')
const test = require('node:test')

const {
  DEFAULT_SEED_MARKERS,
  buildSeedMarker,
  sanitizeMarkerCreate,
  sanitizeMarkerUpdate,
  flattenCheckinRecords
} = require('./marker-service')

test('default seed markers match the eight local marker ids', () => {
  assert.equal(DEFAULT_SEED_MARKERS.length, 8)
  assert.deepEqual(DEFAULT_SEED_MARKERS.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8])
})

test('buildSeedMarker produces an idempotent cloud marker shape', () => {
  const marker = buildSeedMarker(DEFAULT_SEED_MARKERS[0], 123456)

  assert.equal(marker.id, 1)
  assert.equal(marker.title, '北京故宫')
  assert.equal(marker.iconPath, '/static/marker_default.png')
  assert.equal(marker.createdBy, 'system')
  assert.equal(marker.createdAt, 123456)
  assert.equal(marker.updatedAt, 123456)
  assert.equal(marker.checked, false)
  assert.equal(marker.checkinCount, 0)
  assert.deepEqual(marker.checkedBy, [])
})

test('sanitizeMarkerCreate accepts only safe marker fields', () => {
  const marker = sanitizeMarkerCreate({
    title: ' 新点位 ',
    latitude: '22.2',
    longitude: '113.5',
    checkedBy: [{ userId: 'attacker' }],
    checkinCount: 99,
    createdBy: 'attacker'
  }, 'admin-user', 1000)

  assert.deepEqual(marker, {
    id: 1000,
    title: '新点位',
    latitude: 22.2,
    longitude: 113.5,
    iconPath: '/static/marker_default.png',
    width: 36,
    height: 36,
    checked: false,
    checkinCount: 0,
    checkedBy: [],
    createdBy: 'admin-user',
    createdAt: 1000,
    updatedAt: 1000
  })
})

test('sanitizeMarkerUpdate ignores protected fields', () => {
  const updates = sanitizeMarkerUpdate({
    title: ' 改名 ',
    latitude: '28.1',
    longitude: '112.9',
    checkedBy: [],
    checkinCount: 0,
    createdBy: 'attacker',
    createdAt: 1,
    updatedAt: 1
  }, 2000)

  assert.deepEqual(updates, {
    title: '改名',
    latitude: 28.1,
    longitude: 112.9,
    updatedAt: 2000
  })
})

test('flattenCheckinRecords returns records sorted by newest checkin first', () => {
  const records = flattenCheckinRecords([
    {
      _id: 'm1',
      id: 1,
      title: '北京故宫',
      latitude: 39.9163,
      longitude: 116.3972,
      checkedBy: [
        { userId: 'u1', checkedAt: 100, photoCloudURL: 'a.jpg', note: '早' },
        { userId: 'u2', checkedAt: 300, photoCloudURL: null, note: null }
      ]
    },
    {
      _id: 'm2',
      id: 2,
      title: '上海迪士尼',
      latitude: 31.1465,
      longitude: 121.6593,
      checkedBy: [
        { userId: 'u3', checkedAt: 200, photoCloudURL: 'b.jpg', note: '中' }
      ]
    }
  ])

  assert.deepEqual(records.map(item => item.userId), ['u2', 'u3', 'u1'])
  assert.equal(records[0].markerId, 1)
  assert.equal(records[0].markerTitle, '北京故宫')
  assert.equal(records[1].photoCloudURL, 'b.jpg')
})
