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

test('CATEGORY_ENUM 含 9 个法定类别', () => {
  assert.strictEqual(CATEGORY_ENUM.length, 9)
  assert.ok(CATEGORY_ENUM.includes('传统技艺'))
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
