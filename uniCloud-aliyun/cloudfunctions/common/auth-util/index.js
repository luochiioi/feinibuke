const uniID = require('uni-id-common')

module.exports = {
  checkAuth: async function(context) {
    const uniIDIns = uniID.createInstance({ context })
    const token = context.getUniIdToken()
    const payload = await uniIDIns.checkToken(token)
    if (payload.code !== 0) {
      throw payload
    }
    return payload.uid
  }
}
