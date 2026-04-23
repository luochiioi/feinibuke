//导入uni-id-common
<<<<<<< HEAD
const uniID = require('uni-id-common')
=======
const uniID = require('../../../../uni_modules/uni-id-common/uniCloud/cloudfunctions/common/uni-id-common')
>>>>>>> 84cc042fa35c54028adc1cea4914753f19db77f4

//导出名为 checkAuth 的方法
module.exports = {
  checkAuth: async function(context) {
    const uniIDIns = uniID.createInstance({ context })	//创建实例
    const token = context.getUniIdToken() // 自动从请求头/context获取token(获取前端发来的token)
    
    const payload = await uniIDIns.checkToken(token)	//检查token是否正确
    
    if (payload.code !== 0) {
      // 如果校验失败，直接抛出异常。
      // 注意：在 _before 中抛出异常，后面的业务函数就不会再执行了。
      throw payload 
    }
    
    // 校验成功，返回用户 UID
    return payload.uid
  }
}
