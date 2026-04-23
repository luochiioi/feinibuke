// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129

const db = uniCloud.database() ;
const { checkAuth } = require('auth-util') // 引入CommonJS 逻辑

module.exports = {
	_before: async function() {
	  //获取当前方法的名称
	  const methodName = this.getMethodName()
	  
	  //白名单(有些方法不需要登录 比如获取商品列表)
	  const whiteList = []
	  
	  //如果不在白名单里面就需要先获取uid
	  if (!whiteList.includes(methodName)) {
	    //执行通用的 CommonJS 校验逻辑
	    //我们把 this（云对象上下文）传过去，方便里面读取 token
	    const uid = await checkAuth(this)	//获取uid(也就是用户的_id)
	    
	    //将 UID 挂载到 this 上，后面的业务函数可以直接用
	    this.auth = { uid }
	  }
	},
	
	async submitOrder(order){
		try{
			order.userId = this.auth.uid ;	//写入订单的userId
			const res = await db.collection('orders').add(order);	//把订单写入数据库
			return {
				errCode : 0 ,
				errMsg : '订单提交成功' ,
				data : res.orderId 
			} ;
		}
		catch(e){
			return {
				errCode : -1 ,
				errMsg : '提交失败：' + e.message ,
				data : null
			}
		}
		
		
	}
}
