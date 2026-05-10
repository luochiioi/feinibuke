function s(value) {
  return value == null ? '' : String(value)
}

function n(value) {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function buildClaimedReward(reward, now) {
  return {
    rewardClaimed: true,
    claimedAt: Number(now)
  }
}

function findRoute(routes, routeId) {
  const id = n(routeId)
  if (id == null) return null
  const list = Array.isArray(routes) ? routes : []
  return list.find(route => Number(route && route.id) === id) || null
}

function findTask(tasks, taskId) {
  const id = s(taskId)
  if (!id) return null
  const list = Array.isArray(tasks) ? tasks : []
  return list.find(task => s(task && task.id) === id) || null
}

function enrichRewardWithSource(reward, routes, tasks) {
  const row = reward || {}
  const sourceType = row.source === 'route' ? 'route' : 'task'
  const route = sourceType === 'route' ? findRoute(routes, row.routeId) : null
  const task = sourceType === 'task' ? findTask(tasks, row.taskId) : null
  const routeName = sourceType === 'route' ? s((route && route.name) || row.routeName) : ''
  const taskName = sourceType === 'task' ? s((task && task.name) || row.taskName) : ''

  return {
    ...row,
    sourceType,
    routeName,
    taskName,
    sourceTitle: sourceType === 'route' ? routeName : taskName,
    rewardClaimed: row.rewardClaimed === true,
    claimedAt: row.claimedAt != null ? Number(row.claimedAt) : null
  }
}

module.exports = {
  buildClaimedReward,
  enrichRewardWithSource
}
