const db = uniCloud.database()
const col = db.collection('tourism_heritage')
const authUtil = require('../common/auth-util')
const {
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  CATEGORY_ENUM
} = require('./heritage-service')

module.exports = {
  _before: async function () {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      // 公开读方法允许未登录；管理方法自行校验
    }
  },

  async _requireAdmin() {
    if (!this.auth || !this.auth.uid) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
    const res = await db.collection('uni-id-users')
      .where({ _id: this.auth.uid, role: 'admin' }).get()
    if (!res.data || res.data.length === 0) {
      throw { errCode: -2, errMsg: '无管理员权限' }
    }
  },

  // ---- 公开读 ----
  async getDetail(data) {
    const markerId = Number(data && data.markerId)
    if (!Number.isFinite(markerId)) return { errCode: -1, errMsg: '缺少 markerId', data: null }
    const res = await col.where({ markerId, status: 'published' }).limit(1).get()
    if (!res.data || res.data.length === 0) return { errCode: 0, errMsg: '', data: null }
    return { errCode: 0, errMsg: '', data: normalizeHeritageDetail(res.data[0]) }
  },

  async list(data) {
    const category = (data && typeof data.category === 'string') ? data.category : ''
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 20), 50)
    const where = category && CATEGORY_ENUM.includes(category)
      ? { status: 'published', category }
      : { status: 'published' }
    const res = await col.where(where).skip(offset).limit(limit).get()
    const items = (res.data || []).map((d) => normalizeHeritageDetail(d))
    return { errCode: 0, errMsg: '', data: { items, offset, limit } }
  },

  // ---- 管理写 ----
  async adminList(data) {
    await this._requireAdmin()
    const offset = Number((data && data.offset) || 0)
    const limit = Math.min(Number((data && data.limit) || 50), 100)
    const res = await col.skip(offset).limit(limit).get()
    return { errCode: 0, errMsg: '', data: (res.data || []).map((d) => normalizeHeritageDetail(d)) }
  },

  async adminGet(data) {
    await this._requireAdmin()
    const markerId = Number(data && data.markerId)
    const res = await col.where({ markerId }).limit(1).get()
    if (!res.data || res.data.length === 0) return { errCode: 0, errMsg: '', data: null }
    return { errCode: 0, errMsg: '', data: normalizeHeritageDetail(res.data[0]) }
  },

  async create(data) {
    await this._requireAdmin()
    const v = validateHeritageInput(data)
    if (!v.ok) return { errCode: -1, errMsg: v.msg, data: null }
    const markerRes = await db.collection('tourism_markers').where({ id: Number(data.markerId) }).limit(1).get()
    if (!markerRes.data || markerRes.data.length === 0) {
      return { errCode: -1, errMsg: '关联打卡点不存在', data: null }
    }
    const dup = await col.where({ markerId: Number(data.markerId) }).limit(1).get()
    if (dup.data && dup.data.length > 0) {
      return { errCode: -1, errMsg: '该打卡点已有非遗内容', data: null }
    }
    const doc = buildHeritageDoc(data, Date.now())
    const addRes = await col.add(doc)
    return { errCode: 0, errMsg: '创建成功', data: { _id: addRes.id } }
  },

  async update(data) {
    await this._requireAdmin()
    const id = data && data._id
    if (!id) return { errCode: -1, errMsg: '缺少 _id', data: null }
    const patch = buildHeritageUpdate(data, Date.now())
    await col.doc(id).update(patch)
    return { errCode: 0, errMsg: '保存成功', data: null }
  },

  async remove(data) {
    await this._requireAdmin()
    const id = data && data._id
    if (!id) return { errCode: -1, errMsg: '缺少 _id', data: null }
    await col.doc(id).remove()
    return { errCode: 0, errMsg: '删除成功', data: null }
  }
}
