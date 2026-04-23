// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129

const db = uniCloud.database() ;

const { checkAuth } = require('auth-util') // 引入CommonJS 逻辑

module.exports = {
	// _before 钩子：只要调用这个对象的任何方法，都会先跑这里
	_before: async function() {
	  // 1. 获取当前方法的名称
	  const methodName = this.getMethodName()
	  
	  // 2. 白名单逻辑：有些方法不需要登录（比如获取商品列表）
	  const whiteList = []
	  
	  if (!whiteList.includes(methodName)) {
	    // 3. 执行通用的 CommonJS 校验逻辑
	    // 我们把 this（云对象上下文）传过去，方便里面读取 token
	    const uid = await checkAuth(this) 
	    
	    // 4. 将 UID 挂载到 this 上，后面的业务函数可以直接用
	    this.auth = { uid }
	  }
	},
	
	async filteredOrder(keyword){
	
	},
	
	async getOrder(){
		try{
			const res = await db.collection('orders')
			.where({
				userId : this.auth.uid
			})
			.get() ;
			
			return {
				errCode : 0 ,
				errMsg : '成功获取订单数据' ,
				data : res.data
			}
		}
		catch(e){
			return {
				errCode : -1 ,
				errMsg : '未能从数据库获取订单' ,
				data : null 
				
			}
		}
	}
}
