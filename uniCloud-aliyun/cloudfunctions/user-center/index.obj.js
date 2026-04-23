// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129

const db = uniCloud.database() ;

const uniId = require('uni-id-common') ;

// 检查是否存在Id重复
async function checkIdExist(userName){
	try{
		//查找数据库是否有这个用户
		//result 的数据类型是 {data:{} , ...}(getOne : true)
		//result 的数据类型是 {data:[{}] , ...}(如果没写getOne : true)
		const result = await db.collection('uni-id-users')
		.where({nickname : userName.trim()})
		.get() ;	//用户昵称登录
			
		//查找结果数量大于0(名称存在)
		if(result.data.length > 0){
			return {errCode : 'HAS_EXIST' ,
					errMsg : '名称已存在' ,
					data : result.data[0] ,	//返回第一条查询记录
			} ;	
		}
		else{	//名称不存在
			return {errCode : 'NOT_EXIST' ,
					errMsg : '名称不存在' ,
					data : null ,
			} ;
		}
	}
	catch(e){
		return {errCode : 'DATABASE_QUERY_FAILED' ,
				errMsg : '数据库查询错误' ,
				data : null ,
		} ;
	}
}

module.exports = {
	_before: function () { // 通用预处理器

	},
	
	//登录函数
	async login(userName , userPassword){
		//处理输入异常
		if(userName === '' || userPassword === ''){
			return {
					errCode: 'PARAM_IS_NULL',
					errMsg: '账号或密码不能为空',
					data: null
			}
		}
		
		//检查是否存在这名用户
		const isIdExist = await checkIdExist(userName) ;
		
		//根据检查结果返回
		if(isIdExist.errCode === 'NOT_EXIST'){	//没有这个userName的记录
			return {
				errCode : 'USERNAME_FAILED' ,
				errMsg : '用户名称错误' ,
				data : null
			} ;
		}
		else if(isIdExist.errCode === 'DATABASE_QUERY_FAILED'){	//查询数据库时出错
			return isIdExist ;
		}
		
		//获取查找到的数据
		const resUserInfo = isIdExist.data ;	
		
		//检查密码是否一致
		if(resUserInfo.password === userPassword){
			//用于创建token的实例的同步方法
			const uniIdIns = uniId.createInstance({context : this}) ;
			//使用用户的uid创建token
			//token的payload部分由 uid 和 token有效时间 共同组成
			const tokenResult = await uniIdIns.createToken({uid : resUserInfo._id}) ;	
			
			return {
					errCode: 0,
					errMsg: '登录成功',
					data: {
						token: tokenResult.token,
						tokenExpired: tokenResult.tokenExpired,
						userId: resUserInfo.username,
						userName: resUserInfo.nickname
					}
			}
		}
		else{
			return {
					errCode: 'PASSWORD_ERROR',
					errMsg: '密码错误',
					data: null
			}
		}
	},
	
	async sign(userName , userPassword){
		//处理输入异常
		if(userName === '' || userPassword === ''){
			return {errCode : 'PARAM_IS_NULL' ,
					errMsg : '名称和密码都不能为空' ,
					data : null ,
			}
		}
		
		//检查是否存在这名用户
		const isIdExist = await checkIdExist(userName) ;
		
		//根据检查结果返回
		if(isIdExist.errCode === 'DATABASE_QUERY_FAILED'){
			return {errCode : 'DATABASE_QUERY_FAILED' ,
					errMsg : '数据库查询错误' ,
					data : null ,
			} ;
		}
		else if(isIdExist.errCode === 'HAS_EXIST'){
			return {errCode : 'HAS_EXIST' ,
					errMsg : '名称已存在' ,
					data : null ,
			} ;	//名称存在
		}
		
		try{
			//查询用户数量
			const countUser = await db.collection('uni-id-users').count() ;	//count是一个对象
			const nextUserId = countUser.total + 1 ;
			
			let userId ;
			//根据用户数量生成格式为XXX_XXX的userId
			if(nextUserId <= 999){
				userId = '000_' + String(nextUserId).padStart(3, '0') ;
			}
			else{
				const nextUserIdHead = Math.floor(nextUserId/1000) ;
				const nextUserIdTail = nextUserId%1000 ;
				userId = String(nextUserIdHead).padStart(3,'0') + '_' + String(nextUserIdTail).padStart(3,'0')
			}
			
			//往数据库添加刚注册的数据
			await db.collection('uni-id-users').add({
				username : userId.trim() ,
				nickname : userName.trim() ,
				password : userPassword.trim() ,
			}) ;
			
			return {errCode : 0 ,
					errMsg : '注册成功' ,
					data : null ,
			} ;
		}
		catch(e){
			return {errCode : 'FAILED_TO_WRITE_TO_DATABASE' ,
					errMsg : '数据库写入错误' ,
					data : null ,
			} ;
		}
	},
	
	async checkToken(){
		
		
	}
}
