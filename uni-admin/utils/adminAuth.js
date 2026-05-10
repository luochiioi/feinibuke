export function getErrorMessage(e, fallbackMessage = '') {
  return String((e && (e.errMsg || e.message)) || fallbackMessage || '')
}

export function isAuthError(e, fallbackMessage = '') {
  const msg = getErrorMessage(e, fallbackMessage)
  return msg.includes('请先登录')
    || msg.includes('未登录')
    || msg.includes('无管理员权限')
    || msg.includes('token')
}

export function goAdminLogin() {
  uni.reLaunch({ url: '/pages/login/index' })
}
