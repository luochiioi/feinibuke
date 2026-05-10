function parseRewardPoints(rewardText) {
  const text = String(rewardText == null ? '' : rewardText)
  const match = text.match(/(\d+)/)
  if (!match) return 0
  const n = Number(match[1])
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function resolveRewardPoints(row) {
  if (row && row.rewardPoints != null) {
    const n = Number(row.rewardPoints)
    if (Number.isFinite(n)) return Math.floor(n)
  }
  return parseRewardPoints(row && row.reward)
}

function ensureRewardStats(map, userId) {
  const key = String(userId || '')
  if (!key) return null
  if (!map.has(key)) {
    map.set(key, {
      totalRewardPoints: 0,
      claimedRewardPoints: 0,
      pendingRewardPoints: 0,
      routeRewardCount: 0,
      taskRewardCount: 0,
      claimedCount: 0,
      pendingCount: 0
    })
  }
  return map.get(key)
}

function aggregateRewardStatsByUser(rewards) {
  const statsByUserId = new Map()
  ;(rewards || []).forEach(row => {
    const stats = ensureRewardStats(statsByUserId, row && row.userId)
    if (!stats) return

    const points = resolveRewardPoints(row)
    const claimed = row && row.rewardClaimed === true
    const source = row && (row.source === 'route' || row.routeId != null) ? 'route' : 'task'

    stats.totalRewardPoints += points
    if (claimed) {
      stats.claimedRewardPoints += points
      stats.claimedCount += 1
    } else {
      stats.pendingRewardPoints += points
      stats.pendingCount += 1
    }
    if (source === 'route') stats.routeRewardCount += 1
    else stats.taskRewardCount += 1
  })
  return statsByUserId
}

module.exports = {
  parseRewardPoints,
  aggregateRewardStatsByUser
}
