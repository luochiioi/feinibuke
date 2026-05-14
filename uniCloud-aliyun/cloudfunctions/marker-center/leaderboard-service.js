// Pure helpers for the leaderboard.
//
// aggregateLeaderboardRows: joins rewards / user_routes / users by userId
// into a single per-user row. Callers supply already-filtered slices so the
// helper stays free of DB I/O.
//
// buildLeaderboard: sorts and ranks. Tie-break order:
//   1. metric value (desc)
//   2. firstCheckedAt (asc) — earlier activity wins on a tie
//   3. userId (asc, string) — stable final tie-break
//
// attachFriendFilter: drops rows whose userId is not in the allowed set;
// used by `scope=friends` after the caller fetches their accepted friend uids.

const VALID_METRICS = new Set(['points', 'routes', 'checkins'])
const MIN_LIMIT = 1
const MAX_LIMIT = 50

function s(value) {
  return value == null ? '' : String(value)
}

function n(value, fallback = 0) {
  if (value == null) return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function clampLimit(raw) {
  const num = Number(raw)
  if (!Number.isFinite(num)) return MAX_LIMIT
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.floor(num)))
}

function pickMetric(raw) {
  return VALID_METRICS.has(raw) ? raw : 'points'
}

function valueFor(row, metric) {
  if (metric === 'routes') return n(row.routes)
  if (metric === 'checkins') return n(row.checkins)
  return n(row.points)
}

function buildLeaderboard(rows, opts) {
  const list = Array.isArray(rows) ? rows : []
  const options = opts || {}
  const metric = pickMetric(options.metric)
  const limit = clampLimit(options.limit)

  const sortable = list.map(row => ({
    userId: s(row && row.userId),
    nickname: s(row && row.nickname),
    avatar: s(row && row.avatar),
    points: n(row && row.points),
    routes: n(row && row.routes),
    checkins: n(row && row.checkins),
    firstCheckedAt: n(row && row.firstCheckedAt)
  }))

  sortable.sort((a, b) => {
    const aValue = valueFor(a, metric)
    const bValue = valueFor(b, metric)
    if (aValue !== bValue) return bValue - aValue
    // Treat 0 firstCheckedAt as Infinity so a user with no activity timestamp
    // never wins a tie against a user with a real one.
    const aFirst = a.firstCheckedAt > 0 ? a.firstCheckedAt : Number.POSITIVE_INFINITY
    const bFirst = b.firstCheckedAt > 0 ? b.firstCheckedAt : Number.POSITIVE_INFINITY
    if (aFirst !== bFirst) return aFirst - bFirst
    return a.userId.localeCompare(b.userId)
  })

  return sortable.slice(0, limit).map((row, idx) => ({
    ...row,
    metric,
    value: valueFor(row, metric),
    rank: idx + 1
  }))
}

function attachFriendFilter(rows, allowedUidSet) {
  if (!Array.isArray(rows)) return []
  if (allowedUidSet == null) return []
  if (typeof allowedUidSet.has !== 'function') return []
  return rows.filter(row => row != null && allowedUidSet.has(s(row.userId)))
}

function aggregateLeaderboardRows(input) {
  const data = input || {}
  const rewards = Array.isArray(data.rewards) ? data.rewards : []
  const userRoutes = Array.isArray(data.userRoutes) ? data.userRoutes : []
  const userProfiles = Array.isArray(data.userProfiles) ? data.userProfiles : []

  const acc = new Map()
  function bucket(uid) {
    const key = s(uid)
    if (!key) return null
    let row = acc.get(key)
    if (row == null) {
      row = {
        userId: key,
        nickname: '',
        avatar: '',
        points: 0,
        routes: 0,
        checkins: 0,
        firstCheckedAt: 0
      }
      acc.set(key, row)
    }
    return row
  }

  for (const reward of rewards) {
    const row = bucket(reward && reward.userId)
    if (row == null) continue
    const points = Number(reward && reward.rewardPoints)
    if (!Number.isFinite(points)) continue
    row.points += points
    const earnedAt = n(reward && reward.earnedAt)
    if (earnedAt > 0 && (row.firstCheckedAt === 0 || earnedAt < row.firstCheckedAt)) {
      row.firstCheckedAt = earnedAt
    }
  }

  for (const ur of userRoutes) {
    const row = bucket(ur && ur.userId)
    if (row == null) continue
    row.routes += 1
    const completedAt = n(ur && ur.completedAt)
    if (completedAt > 0 && (row.firstCheckedAt === 0 || completedAt < row.firstCheckedAt)) {
      row.firstCheckedAt = completedAt
    }
  }

  for (const profile of userProfiles) {
    const row = bucket(profile && profile.userId)
    if (row == null) continue
    row.checkins = n(profile && profile.totalCheckins)
    row.nickname = s(profile && profile.nickname)
    row.avatar = s(profile && profile.avatar)
  }

  return Array.from(acc.values())
}

module.exports = {
  buildLeaderboard,
  attachFriendFilter,
  aggregateLeaderboardRows
}
