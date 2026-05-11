const TASK_STATUS_ACTIVE = 'active'
const TASK_STATUS_ARCHIVED = 'archived'
const TASK_STATUSES = new Set([TASK_STATUS_ACTIVE, TASK_STATUS_ARCHIVED])
const REWARD_KINDS = new Set(['none', 'prize', 'points', 'both'])

function normalizeText(value, fieldName, maxLength, required) {
  const text = String(value == null ? '' : value).trim()
  if (required && text.length === 0) {
    throw new Error(`${fieldName}不能为空`)
  }
  if (text.length > maxLength) {
    throw new Error(`${fieldName}不能超过 ${maxLength} 个字符`)
  }
  return text
}

function normalizeTargetMarkerId(value) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error('targetMarkerId 必须是正整数')
  }
  return n
}

function normalizeStatus(value) {
  const status = String(value == null ? TASK_STATUS_ACTIVE : value).trim()
  if (!TASK_STATUSES.has(status)) {
    throw new Error('status 必须是 active 或 archived')
  }
  return status
}

function normalizeRewardKind(value) {
  const kind = String(value == null ? 'points' : value).trim()
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

function validateTaskInput(input) {
  const data = input || {}
  normalizeText(data.id, '任务 ID ', 64, true)
  normalizeText(data.name, '任务名称', 50, true)
  normalizeTargetMarkerId(data.targetMarkerId)
  normalizeStatus(data.status)
  normalizeRewardKind(data.rewardKind)
  return true
}

function buildTaskUpsertDoc(input, actorUid, now) {
  const data = input || {}
  const rewardKind = normalizeRewardKind(data.rewardKind)
  const reward = rewardKind === 'none'
    ? ''
    : normalizeText(data.reward, '奖励文案', 100, false)
  const rewardPoints = rewardKind === 'none' ? 0 : normalizeRewardPoints(data.rewardPoints)
  const doc = {
    id: normalizeText(data.id, '任务 ID ', 64, true),
    name: normalizeText(data.name, '任务名称', 50, true),
    description: normalizeText(data.description, '任务描述', 200, false),
    targetMarkerId: normalizeTargetMarkerId(data.targetMarkerId),
    targetTitle: normalizeText(data.targetTitle, '目标点名称', 50, false),
    reward,
    rewardKind,
    rewardPoints,
    status: normalizeStatus(data.status),
    createdBy: String(actorUid || ''),
    updatedAt: Number(now)
  }
  return doc
}

module.exports = {
  TASK_STATUS_ACTIVE,
  TASK_STATUS_ARCHIVED,
  TASK_STATUSES,
  validateTaskInput,
  buildTaskUpsertDoc
}
