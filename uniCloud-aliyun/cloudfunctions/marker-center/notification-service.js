const VALID_TYPES = new Set([
  'friend.requested',
  'friend.accepted',
  'route.completed',
  'route.markerAdded',
  'system.broadcast'
])

function s(value) { return value == null ? '' : String(value) }
function n(value, fallback = 0) {
  if (value == null) return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function buildNotification(type, userId, payload, now) {
  const t = s(type)
  if (!VALID_TYPES.has(t)) return null
  const uid = s(userId)
  if (!uid) return null
  return {
    type: t,
    userId: uid,
    payload: payload != null && typeof payload === 'object' ? payload : {},
    read: false,
    readAt: null,
    createdAt: n(now)
  }
}

function markRead(row, now) {
  if (row == null) return null
  if (row.read === true) return null
  return { ...row, read: true, readAt: n(now) }
}

function groupByDateHeadings(rows) {
  if (!Array.isArray(rows)) return []
  const out = []
  let lastDate = ''
  for (const row of rows) {
    const ts = n(row && row.createdAt)
    const date = ts > 0 ? new Date(ts).toISOString().slice(0, 10) : ''
    if (date && date !== lastDate) {
      out.push({ _type: 'heading', label: date })
      lastDate = date
    }
    out.push(row)
  }
  return out
}

module.exports = { buildNotification, markRead, groupByDateHeadings }
