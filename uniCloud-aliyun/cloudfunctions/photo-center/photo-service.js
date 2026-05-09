// 纯函数：校验 cloudURL 属于本服务空间打卡照片命名空间。
// upload() 写入路径形如 cloud://<env>.<spaceId>/checkin-photos/<uid>/<ts>_<name>.jpg
// 或 https 形式：https://...service.../checkin-photos/<uid>/<ts>_<name>.jpg
// 任何 cloudURL 不含 "/checkin-photos/" 前缀，都视为越界，拒绝物理删除。
//
// 这是把"删除什么文件"的权限收口的最后一道闸：admin 只能通过 deleteCheckinRecord
// 触发删除，每条记录的 photoCloudURL 都来自 uploadPhoto 的命名空间——没有其他
// 接口能注入 cloudURL，所以这里加一道字符串校验即可挡掉脏数据 / 调用方手贱传错。
const ALLOWED_NAMESPACE_SEGMENT = '/checkin-photos/'

function isAllowedCloudURL(url) {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > 1024) return false
  if (trimmed.indexOf('..') !== -1) return false
  return trimmed.indexOf(ALLOWED_NAMESPACE_SEGMENT) !== -1
}

module.exports = {
  ALLOWED_NAMESPACE_SEGMENT,
  isAllowedCloudURL
}
