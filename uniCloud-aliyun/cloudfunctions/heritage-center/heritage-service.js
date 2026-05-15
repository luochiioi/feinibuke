const CATEGORY_ENUM = [
  '传统技艺', '民俗', '曲艺', '传统音乐', '传统舞蹈',
  '传统美术', '传统医药', '民间文学', '传统体育'
]

const HERITAGE_UPDATE_WHITELIST = [
  'category', 'summary', 'story', 'images',
  'inheritorName', 'inheritorBio', 'inheritorPhoto',
  'relatedMarkerIds', 'status'
]

function toStr(v) { return typeof v === 'string' ? v : '' }
function toIntArray(v) {
  if (!Array.isArray(v)) return []
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n))
}
function toStrArray(v) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string')
}

function validateHeritageInput(data) {
  if (data == null) return { ok: false, msg: '缺少内容' }
  const markerId = Number(data.markerId)
  if (!Number.isFinite(markerId)) return { ok: false, msg: '缺少关联打卡点' }
  if (!CATEGORY_ENUM.includes(data.category)) return { ok: false, msg: '非遗类别非法' }
  return { ok: true, msg: '' }
}

function buildHeritageDoc(data, now) {
  return {
    markerId: Number(data.markerId),
    category: data.category,
    summary: toStr(data.summary),
    story: toStr(data.story),
    images: toStrArray(data.images),
    inheritorName: toStr(data.inheritorName),
    inheritorBio: toStr(data.inheritorBio),
    inheritorPhoto: toStr(data.inheritorPhoto),
    relatedMarkerIds: toIntArray(data.relatedMarkerIds),
    status: data.status === 'published' ? 'published' : 'draft',
    createdAt: now,
    updatedAt: now
  }
}

function buildHeritageUpdate(data, now) {
  const out = {}
  for (const key of HERITAGE_UPDATE_WHITELIST) {
    if (data[key] === undefined) continue
    if (key === 'images') { out.images = toStrArray(data.images); continue }
    if (key === 'relatedMarkerIds') { out.relatedMarkerIds = toIntArray(data.relatedMarkerIds); continue }
    if (key === 'category' && !CATEGORY_ENUM.includes(data.category)) continue
    if (key === 'status') { out.status = data.status === 'published' ? 'published' : 'draft'; continue }
    out[key] = data[key]
  }
  out.updatedAt = now
  return out
}

function normalizeHeritageDetail(doc) {
  return {
    _id: toStr(doc && doc._id),
    markerId: Number((doc && doc.markerId) || 0),
    category: toStr(doc && doc.category),
    summary: toStr(doc && doc.summary),
    story: toStr(doc && doc.story),
    images: toStrArray(doc && doc.images),
    inheritorName: toStr(doc && doc.inheritorName),
    inheritorBio: toStr(doc && doc.inheritorBio),
    inheritorPhoto: toStr(doc && doc.inheritorPhoto),
    relatedMarkerIds: toIntArray(doc && doc.relatedMarkerIds),
    status: (doc && doc.status === 'published') ? 'published' : 'draft'
  }
}

// 种子数据：澳门 + 湖南真实非遗。markerId 由 Task 12 一并种入 tourism_markers。
// summary/story 在 Task 12 实现时写入真实内容（此处为占位骨架，仅用于测试形状）。
const DEFAULT_SEED_HERITAGE = [
  { markerId: 1001, category: '民俗',     status: 'published', title: '鱼行醉龙节' },
  { markerId: 1002, category: '传统美术', status: 'published', title: '澳门神像雕刻' },
  { markerId: 1003, category: '传统医药', status: 'published', title: '凉茶配制' },
  { markerId: 1004, category: '曲艺',     status: 'published', title: '土生土语话剧' },
  { markerId: 1005, category: '传统音乐', status: 'published', title: '道教科仪音乐' },
  { markerId: 1101, category: '传统美术', status: 'published', title: '湘绣' },
  { markerId: 1102, category: '曲艺',     status: 'published', title: '花鼓戏' },
  { markerId: 1103, category: '传统美术', status: 'published', title: '滩头年画' },
  { markerId: 1104, category: '民间文学', status: 'published', title: '江永女书' },
  { markerId: 1105, category: '传统技艺', status: 'published', title: '醴陵釉下五彩瓷烧制技艺' }
]

module.exports = {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  DEFAULT_SEED_HERITAGE
}
