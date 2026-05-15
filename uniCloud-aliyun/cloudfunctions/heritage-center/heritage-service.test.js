const test = require('node:test')
const assert = require('node:assert')
const {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  DEFAULT_SEED_HERITAGE
} = require('./heritage-service')

test('CATEGORY_ENUM 含 10 个法定类别', () => {
  assert.strictEqual(CATEGORY_ENUM.length, 10)
  assert.ok(CATEGORY_ENUM.includes('传统技艺'))
  assert.ok(CATEGORY_ENUM.includes('传统戏剧'))
})

test('validateHeritageInput 拒绝缺 markerId', () => {
  const r = validateHeritageInput({ category: '传统技艺' })
  assert.strictEqual(r.ok, false)
})

test('validateHeritageInput 拒绝非法类别', () => {
  const r = validateHeritageInput({ markerId: 1, category: '不存在的类别' })
  assert.strictEqual(r.ok, false)
})

test('validateHeritageInput 接受合法输入', () => {
  const r = validateHeritageInput({ markerId: 1, category: '传统技艺' })
  assert.strictEqual(r.ok, true)
})

test('buildHeritageDoc 注入默认值与时间戳', () => {
  const doc = buildHeritageDoc({ markerId: 4, category: '民俗' }, 1700000000000)
  assert.strictEqual(doc.markerId, 4)
  assert.strictEqual(doc.status, 'draft')
  assert.deepStrictEqual(doc.images, [])
  assert.deepStrictEqual(doc.relatedMarkerIds, [])
  assert.strictEqual(doc.createdAt, 1700000000000)
  assert.strictEqual(doc.updatedAt, 1700000000000)
})

test('buildHeritageUpdate 只保留白名单字段', () => {
  const u = buildHeritageUpdate({ summary: 'x', _id: 'hack', markerId: 999 }, 1700000000000)
  assert.strictEqual(u.summary, 'x')
  assert.strictEqual(u._id, undefined)
  assert.strictEqual(u.markerId, undefined)
  assert.strictEqual(u.updatedAt, 1700000000000)
})

test('normalizeHeritageDetail 补齐 non-optional 字段', () => {
  const n = normalizeHeritageDetail({ markerId: 1, category: '曲艺' })
  assert.strictEqual(n.summary, '')
  assert.strictEqual(n.story, '')
  assert.deepStrictEqual(n.images, [])
  assert.strictEqual(n.inheritorName, '')
  assert.deepStrictEqual(n.relatedMarkerIds, [])
})

test('DEFAULT_SEED_HERITAGE 含澳门与湖南条目且类别合法', () => {
  assert.ok(DEFAULT_SEED_HERITAGE.length >= 8)
  for (const s of DEFAULT_SEED_HERITAGE) {
    assert.ok(CATEGORY_ENUM.includes(s.category), `非法类别 ${s.category}`)
    assert.strictEqual(typeof s.markerId, 'number')
    assert.strictEqual(s.status, 'published')
  }
})

test('DEFAULT_SEED_MARKERS 与 DEFAULT_SEED_HERITAGE markerId 一一对应', () => {
  const { DEFAULT_SEED_MARKERS, DEFAULT_SEED_HERITAGE } = require('./heritage-service')
  const markerIds = DEFAULT_SEED_MARKERS.map((m) => m.id).sort()
  const heritageIds = DEFAULT_SEED_HERITAGE.map((h) => h.markerId).sort()
  assert.deepStrictEqual(markerIds, heritageIds)
})

test('每条种子非遗都有非空 summary 与 story', () => {
  const { DEFAULT_SEED_HERITAGE } = require('./heritage-service')
  for (const h of DEFAULT_SEED_HERITAGE) {
    assert.ok(h.summary && h.summary.length > 10, `${h.title} summary 太短`)
    assert.ok(h.story && h.story.length > 30, `${h.title} story 太短`)
  }
})

test('种子 marker 坐标落在合理经纬度范围', () => {
  const { DEFAULT_SEED_MARKERS } = require('./heritage-service')
  for (const m of DEFAULT_SEED_MARKERS) {
    assert.ok(m.latitude > 20 && m.latitude < 33, `${m.title} 纬度异常`)
    assert.ok(m.longitude > 109 && m.longitude < 115, `${m.title} 经度异常`)
  }
})
