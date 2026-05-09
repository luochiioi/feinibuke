const authUtil = require('auth-util')
const { isAllowedCloudURL } = require('./photo-service')

module.exports = {
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
  },

  async upload(data) {
    const { fileContent, fileName } = data
    if (!fileContent) return { errCode: -1, errMsg: '缺少文件内容' }

    const result = await uniCloud.uploadFile({
      cloudPath: `checkin-photos/${this.auth.uid}/${Date.now()}_${fileName || 'photo.jpg'}`,
      fileContent: Buffer.from(fileContent, 'base64')
    })
    return {
      errCode: 0,
      data: {
        fileID: result.fileID,
        cloudURL: result.fileID
      }
    }
  },

  async delete(data) {
    const { fileID } = data
    if (!fileID) return { errCode: -1, errMsg: '缺少文件ID' }
    await uniCloud.deleteFile({ fileList: [fileID] })
    return { errCode: 0, errMsg: '删除成功' }
  },

  // P3.4 物理删图：违规审核或我的打卡页"彻底删除"会调用本接口。
  // 与历史 delete(fileID) 区别：deletePhoto 强制走命名空间校验（isAllowedCloudURL），
  // 任何非 /checkin-photos/ 路径直接拒绝；返回 { deleted, errMsg } 让调用方写
  // 审计 purgeError 字段时有结构化信息。物理删除失败不抛 throw，由 admin-center
  // 决定是否回滚数据库（当前策略是不回滚——数据库 entry 已删，文件残留仅记审计）。
  async deletePhoto(data) {
    const cloudURL = data && data.cloudURL ? String(data.cloudURL) : ''
    if (!isAllowedCloudURL(cloudURL)) {
      return { errCode: -1, errMsg: '非法 cloudURL', data: { deleted: false, errMsg: '非法 cloudURL' } }
    }
    try {
      const result = await uniCloud.deleteFile({ fileList: [cloudURL] })
      const fileItem = result && Array.isArray(result.fileList) && result.fileList.length > 0
        ? result.fileList[0]
        : null
      const code = fileItem && fileItem.code ? String(fileItem.code) : 'SUCCESS'
      const ok = code === 'SUCCESS' || code === '0'
      return {
        errCode: 0,
        errMsg: ok ? 'ok' : (fileItem && fileItem.message) || code,
        data: { deleted: ok, errMsg: ok ? '' : (fileItem && fileItem.message) || code }
      }
    } catch (e) {
      const msg = e && e.message ? e.message : '物理删除失败'
      return { errCode: -1, errMsg: msg, data: { deleted: false, errMsg: msg } }
    }
  }
}
