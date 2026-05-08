const DEFAULT_ICON_PATH = '/static/marker_default.png'
const DEFAULT_MARKER_SIZE = 36
const SYSTEM_CREATOR = 'system'

const DEFAULT_SEED_MARKERS = [
  { id: 1, title: '北京故宫', latitude: 39.9163, longitude: 116.3972 },
  { id: 2, title: '上海迪士尼', latitude: 31.1465, longitude: 121.6593 },
  { id: 3, title: '长沙岳麓书院', latitude: 28.1836, longitude: 112.9388 },
  { id: 4, title: '澳门大三巴', latitude: 22.1979, longitude: 113.5413 },
  { id: 5, title: '长沙橘子洲', latitude: 28.1968, longitude: 112.9625 },
  { id: 6, title: '广州塔', latitude: 23.1065, longitude: 113.3246 },
  { id: 7, title: '中山大学东校区', latitude: 23.0622, longitude: 113.3894 },
  { id: 8, title: '北京交通大学', latitude: 39.9505, longitude: 116.3474 }
]

function toNumber(value, fieldName) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} 必须是数字`)
  }
  return n
}

function normalizeLatitude(value) {
  const n = toNumber(value, 'latitude')
  if (n < -90 || n > 90) {
    throw new Error('latitude 必须在 -90 到 90 之间')
  }
  return n
}

function normalizeLongitude(value) {
  const n = toNumber(value, 'longitude')
  if (n < -180 || n > 180) {
    throw new Error('longitude 必须在 -180 到 180 之间')
  }
  return n
}

function normalizeTitle(value) {
  const title = String(value == null ? '' : value).trim()
  if (title.length === 0) {
    throw new Error('名称不能为空')
  }
  if (title.length > 50) {
    throw new Error('名称不能超过 50 个字符')
  }
  return title
}

function normalizeIconPath(value) {
  const path = String(value == null ? '' : value).trim()
  if (path.length === 0 || path.startsWith('http')) {
    return DEFAULT_ICON_PATH
  }
  return path
}

function normalizeSize(value, fieldName) {
  if (value == null || value === '') return DEFAULT_MARKER_SIZE
  const n = toNumber(value, fieldName)
  if (n <= 0 || n > 128) {
    throw new Error(`${fieldName} 必须在 1 到 128 之间`)
  }
  return n
}

function buildSeedMarker(seed, now) {
  return {
    id: seed.id,
    title: normalizeTitle(seed.title),
    latitude: normalizeLatitude(seed.latitude),
    longitude: normalizeLongitude(seed.longitude),
    iconPath: DEFAULT_ICON_PATH,
    width: DEFAULT_MARKER_SIZE,
    height: DEFAULT_MARKER_SIZE,
    checked: false,
    checkinCount: 0,
    checkedBy: [],
    createdBy: SYSTEM_CREATOR,
    createdAt: now,
    updatedAt: now
  }
}

function buildSeedUpdate(seed, now) {
  return {
    title: normalizeTitle(seed.title),
    latitude: normalizeLatitude(seed.latitude),
    longitude: normalizeLongitude(seed.longitude),
    iconPath: DEFAULT_ICON_PATH,
    width: DEFAULT_MARKER_SIZE,
    height: DEFAULT_MARKER_SIZE,
    updatedAt: now
  }
}

function sanitizeMarkerCreate(data, creatorId, now) {
  return {
    id: now,
    title: normalizeTitle(data && data.title),
    latitude: normalizeLatitude(data && data.latitude),
    longitude: normalizeLongitude(data && data.longitude),
    iconPath: normalizeIconPath(data && data.iconPath),
    width: normalizeSize(data && data.width, 'width'),
    height: normalizeSize(data && data.height, 'height'),
    checked: false,
    checkinCount: 0,
    checkedBy: [],
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now
  }
}

function sanitizeMarkerUpdate(data, now) {
  const updates = {}
  if (data && Object.prototype.hasOwnProperty.call(data, 'title')) {
    updates.title = normalizeTitle(data.title)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'latitude')) {
    updates.latitude = normalizeLatitude(data.latitude)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'longitude')) {
    updates.longitude = normalizeLongitude(data.longitude)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'iconPath')) {
    updates.iconPath = normalizeIconPath(data.iconPath)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'width')) {
    updates.width = normalizeSize(data.width, 'width')
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'height')) {
    updates.height = normalizeSize(data.height, 'height')
  }
  updates.updatedAt = now
  return updates
}

function flattenCheckinRecords(markers) {
  const records = []
  ;(markers || []).forEach(marker => {
    ;(marker.checkedBy || []).forEach(entry => {
      records.push({
        markerDocId: marker._id || '',
        markerId: marker.id,
        markerTitle: marker.title,
        latitude: marker.latitude,
        longitude: marker.longitude,
        userId: entry.userId || '',
        checkedAt: entry.checkedAt || 0,
        photoCloudURL: entry.photoCloudURL || null,
        note: entry.note || null
      })
    })
  })
  records.sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0))
  return records
}

module.exports = {
  DEFAULT_SEED_MARKERS,
  buildSeedMarker,
  buildSeedUpdate,
  sanitizeMarkerCreate,
  sanitizeMarkerUpdate,
  flattenCheckinRecords
}
