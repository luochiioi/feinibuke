const ROUTE_STATUS_ACTIVE = 'active'
const ROUTE_STATUS_ARCHIVED = 'archived'
const ROUTE_STATUSES = new Set([ROUTE_STATUS_ACTIVE, ROUTE_STATUS_ARCHIVED])
const REWARD_KIND_NONE = 'none'
const REWARD_KIND_PRIZE = 'prize'
const REWARD_KIND_POINTS = 'points'
const REWARD_KIND_BOTH = 'both'
const REWARD_KINDS = new Set([REWARD_KIND_NONE, REWARD_KIND_PRIZE, REWARD_KIND_POINTS, REWARD_KIND_BOTH])

const NAME_MAX = 30
const DESCRIPTION_MAX = 200
const REWARD_MAX = 100
const COVER_MAX = 1024
const MARKER_MAX = 50

function normalizeRouteName(value) {
  const name = String(value == null ? '' : value).trim()
  if (name.length === 0) {
    throw new Error('路线名称不能为空')
  }
  if (name.length > NAME_MAX) {
    throw new Error(`路线名称不能超过 ${NAME_MAX} 个字符`)
  }
  return name
}

function normalizeDescription(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (text.length > DESCRIPTION_MAX) {
    throw new Error(`简介不能超过 ${DESCRIPTION_MAX} 个字符`)
  }
  return text
}

function normalizeRewardKind(value) {
  const kind = String(value == null ? REWARD_KIND_PRIZE : value).trim()
  if (!REWARD_KINDS.has(kind)) {
    throw new Error('rewardKind 必须是 none/prize/points/both')
  }
  return kind
}

function normalizeRewardPoints(value) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error('rewardPoints 必须是非负整数')
  }
  return n
}

function ensurePositivePointsForKind(rewardKind, rewardPoints) {
  if (rewardKind !== REWARD_KIND_POINTS && rewardKind !== REWARD_KIND_BOTH) return
  if (!(rewardPoints > 0)) {
    throw new Error('积分数量必须大于 0')
  }
}

function normalizeReward(value, rewardKind) {
  const reward = String(value == null ? '' : value).trim()
  if (rewardKind === REWARD_KIND_NONE) return ''
  if (rewardKind === REWARD_KIND_POINTS) {
    if (reward.length > REWARD_MAX) {
      throw new Error(`奖励文案不能超过 ${REWARD_MAX} 个字符`)
    }
    return reward
  }
  if (reward.length === 0) {
    throw new Error('奖励文案不能为空')
  }
  if (reward.length > REWARD_MAX) {
    throw new Error(`奖励文案不能超过 ${REWARD_MAX} 个字符`)
  }
  return reward
}

function normalizeCoverImage(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (text.length === 0) return null
  if (text.length > COVER_MAX) {
    throw new Error('封面图地址过长')
  }
  return text
}

function normalizeStatus(value) {
  const status = String(value == null ? ROUTE_STATUS_ACTIVE : value).trim()
  if (!ROUTE_STATUSES.has(status)) {
    throw new Error(`status 必须是 ${ROUTE_STATUS_ACTIVE} 或 ${ROUTE_STATUS_ARCHIVED}`)
  }
  return status
}

function normalizeMarkerIds(value) {
  if (!Array.isArray(value)) {
    throw new Error('markerIds 必须是数组')
  }
  if (value.length === 0) {
    throw new Error('markerIds 至少包含 1 项')
  }
  if (value.length > MARKER_MAX) {
    throw new Error(`markerIds 不能超过 ${MARKER_MAX} 项`)
  }
  const seen = new Set()
  const result = []
  for (let i = 0; i < value.length; i++) {
    const raw = value[i]
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      throw new Error(`markerIds[${i}] 必须是正整数`)
    }
    if (seen.has(n)) {
      continue
    }
    seen.add(n)
    result.push(n)
  }
  if (result.length === 0) {
    throw new Error('markerIds 至少包含 1 项')
  }
  return result
}

function sanitizeRouteCreate(data, creatorId, now) {
  const name = normalizeRouteName(data && data.name)
  const description = normalizeDescription(data && data.description)
  const coverImage = normalizeCoverImage(data && data.coverImage)
  const markerIds = normalizeMarkerIds(data && data.markerIds)
  const rewardKind = normalizeRewardKind(data && data.rewardKind)
  const reward = normalizeReward(data && data.reward, rewardKind)
  const rewardPoints = rewardKind === REWARD_KIND_NONE ? 0 : normalizeRewardPoints(data && data.rewardPoints)
  ensurePositivePointsForKind(rewardKind, rewardPoints)
  const status = data && Object.prototype.hasOwnProperty.call(data, 'status')
    ? normalizeStatus(data.status)
    : ROUTE_STATUS_ACTIVE
  return {
    id: now,
    name,
    description,
    coverImage,
    markerIds,
    reward,
    rewardKind,
    rewardPoints,
    status,
    createdBy: String(creatorId || ''),
    createdAt: now,
    updatedAt: now
  }
}

function sanitizeRouteUpdate(data, now) {
  const updates = {}
  const rewardKind = data && Object.prototype.hasOwnProperty.call(data, 'rewardKind')
    ? normalizeRewardKind(data.rewardKind)
    : null
  if (data && Object.prototype.hasOwnProperty.call(data, 'name')) {
    updates.name = normalizeRouteName(data.name)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'description')) {
    updates.description = normalizeDescription(data.description)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'coverImage')) {
    updates.coverImage = normalizeCoverImage(data.coverImage)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'markerIds')) {
    updates.markerIds = normalizeMarkerIds(data.markerIds)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'reward')) {
    updates.reward = normalizeReward(data.reward, rewardKind || REWARD_KIND_PRIZE)
  }
  if (rewardKind != null) {
    updates.rewardKind = rewardKind
    if (!Object.prototype.hasOwnProperty.call(updates, 'reward') && (rewardKind === REWARD_KIND_NONE || rewardKind === REWARD_KIND_POINTS)) {
      updates.reward = ''
    }
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'rewardPoints')) {
    updates.rewardPoints = rewardKind === REWARD_KIND_NONE ? 0 : normalizeRewardPoints(data.rewardPoints)
  } else if (rewardKind === REWARD_KIND_NONE) {
    updates.rewardPoints = 0
  }
  if (rewardKind === REWARD_KIND_POINTS || rewardKind === REWARD_KIND_BOTH) {
    const provided = data && Object.prototype.hasOwnProperty.call(data, 'rewardPoints')
    const points = provided ? Number(updates.rewardPoints) : 0
    ensurePositivePointsForKind(rewardKind, points)
  }
  if (data && Object.prototype.hasOwnProperty.call(data, 'status')) {
    updates.status = normalizeStatus(data.status)
  }
  updates.updatedAt = now
  return updates
}

function validateRouteMarkerIds(markerIds, allMarkerIds) {
  const ids = Array.isArray(markerIds) ? markerIds : []
  const all = Array.isArray(allMarkerIds) ? allMarkerIds : []
  const allSet = new Set(all.map(item => Number(item)))
  const missing = []
  for (let i = 0; i < ids.length; i++) {
    const n = Number(ids[i])
    if (!allSet.has(n)) missing.push(n)
  }
  return {
    ok: missing.length === 0,
    missing
  }
}

function calcRouteProgress(route, userCheckedMarkerIds) {
  const routeIds = (route && Array.isArray(route.markerIds)) ? route.markerIds : []
  const userIds = Array.isArray(userCheckedMarkerIds) ? userCheckedMarkerIds : []
  const userSet = new Set(userIds.map(item => Number(item)))
  const doneMarkerIds = []
  const pendingMarkerIds = []
  for (let i = 0; i < routeIds.length; i++) {
    const n = Number(routeIds[i])
    if (userSet.has(n)) {
      doneMarkerIds.push(n)
    } else {
      pendingMarkerIds.push(n)
    }
  }
  const total = routeIds.length
  const done = doneMarkerIds.length
  const ratio = total > 0 ? done / total : 0
  return { total, done, ratio, doneMarkerIds, pendingMarkerIds }
}

function isRouteCompleted(route, userCheckedMarkerIds) {
  const progress = calcRouteProgress(route, userCheckedMarkerIds)
  return progress.total > 0 && progress.done === progress.total
}

module.exports = {
  ROUTE_STATUS_ACTIVE,
  ROUTE_STATUS_ARCHIVED,
  ROUTE_STATUSES,
  REWARD_KIND_NONE,
  REWARD_KIND_PRIZE,
  REWARD_KIND_POINTS,
  REWARD_KIND_BOTH,
  REWARD_KINDS,
  sanitizeRouteCreate,
  sanitizeRouteUpdate,
  validateRouteMarkerIds,
  calcRouteProgress,
  isRouteCompleted
}
