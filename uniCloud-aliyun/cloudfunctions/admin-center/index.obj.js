const db = uniCloud.database()
const authUtil = require('../common/auth-util')

module.exports = {
  _before: async function() {
    this.auth = { uid: null, isAdmin: false }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      throw { errCode: -1, errMsg: '请先登录' }
    }
    const userRes = await db.collection('uni-id-users')
      .where({ _id: this.auth.uid, role: 'admin' }).get()
    if (!userRes.data.length) {
      throw { errCode: -2, errMsg: '无管理员权限' }
    }
    this.auth.isAdmin = true
  },

  async getDashboard() {
    const [users, markers, markersWithCheckins] = await Promise.all([
      db.collection('users').count(),
      db.collection('tourism_markers').count(),
      db.collection('tourism_markers')
        .where({ 'checkedBy.0': db.command.exists(true) }).count()
    ])
    const allMarkers = await db.collection('tourism_markers')
      .field({ checkinCount: true }).get()
    const totalCheckins = allMarkers.data.reduce((sum, m) => sum + (m.checkinCount || 0), 0)

    return {
      errCode: 0,
      data: {
        totalUsers: users.total,
        totalMarkers: markers.total,
        totalMarkersWithCheckins: markersWithCheckins.total,
        totalCheckins
      }
    }
  },

  async getUsers(data) {
    const { offset = 0, limit = 20 } = data || {}
    const res = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .skip(offset).limit(limit).get()
    return { errCode: 0, data: res.data }
  },

  async getCheckins(data) {
    const { offset = 0, limit = 20 } = data || {}
    const res = await db.collection('tourism_markers')
      .where({ 'checkedBy.0': db.command.exists(true) })
      .field({ title: true, checkedBy: true, latitude: true, longitude: true })
      .orderBy('updatedAt', 'desc')
      .skip(offset).limit(limit).get()
    return { errCode: 0, data: res.data }
  },

  async updateMarker(data) {
    const { _id, ...updates } = data
    await db.collection('tourism_markers').doc(_id).update({ ...updates, updatedAt: Date.now() })
    return { errCode: 0 }
  },

  async deleteMarker(data) {
    await db.collection('tourism_markers').doc(data._id).remove()
    return { errCode: 0 }
  },

  async batchImport(data) {
    const results = []
    for (const item of data.list) {
      const res = await db.collection('tourism_markers').add(item)
      results.push(res.id)
    }
    return { errCode: 0, data: { ids: results } }
  },

  async getTasks() {
    const res = await db.collection('tourism_tasks').get()
    return { errCode: 0, data: res.data }
  },

  async updateTask(data) {
    const { _id, ...updates } = data
    await db.collection('tourism_tasks').doc(_id).update(updates)
    return { errCode: 0 }
  }
}
