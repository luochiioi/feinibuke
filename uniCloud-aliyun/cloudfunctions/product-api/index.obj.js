const db = uniCloud.database() ;
const _ = db.command;

const { checkAuth } = require('auth-util') // 引入CommonJS 逻辑

module.exports = {
	// _before 钩子：只要调用这个对象的任何方法，都会先跑这里
	_before: async function() {
	  // 1. 获取当前方法的名称
	  const methodName = this.getMethodName()
	  
	  // 2. 白名单逻辑：有些方法不需要登录（比如获取商品列表）
	  const whiteList = ['filteredProducts']
	  
	  if (!whiteList.includes(methodName)) {
	    // 3. 执行通用的 CommonJS 校验逻辑
	    // 我们把 this（云对象上下文）传过去，方便里面读取 token
	    const uid = await checkAuth(this) 
	    
	    // 4. 将 UID 挂载到 this 上，后面的业务函数可以直接用
	    this.auth = { uid }
	  }
	},
	
	async filteredProducts(keyword){
		//排除异常
		if(typeof keyword !== 'string' || keyword.trim() === ""){
			return{
				errCode : 0 ,
				errMsg : '输入的关键词为空' ,
				data : []
			}
		}
		
		const cleanKeyword = keyword.trim() ;
		
		//创建正则表达式
		const searchKeyword = new RegExp(cleanKeyword, 'i'); //忽略大小写的正则表达式 用于模糊搜索
		
		//搜索要求清单
		const queryCode = _.and([
			{status: true} , 
			_.or([	{itemName : searchKeyword} ,
		 			{itemId : searchKeyword} ,
					{title : searchKeyword} ,
					{subtitle : searchKeyword} ,
					{POO : searchKeyword} ,
					{category : searchKeyword}])
				]) ;
				
		try{
			const searchResult = await db.collection('goods')
			.where(	queryCode
			)
			.limit(20)
			.get();
			
			return{
				errCode : 0 ,
				errMsg : '搜索成功',
				data : searchResult.data,	//把商品的全部信息打包给前端
			}
		}
		catch(e){
			return{
				errCode : 'SEARCH_FAILED' ,
				errMsg : '搜索失败' ,
				data : []
			} 
		}
	}
}
