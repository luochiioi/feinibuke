<template>
  <view class="heritage-page">
    <AdminHeader
      title="非遗内容管理"
      subtitle="新增、编辑、删除非遗内容条目"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && items.length === 0" class="notice">正在加载非遗内容...</view>

    <view class="summary-grid">
      <view class="summary-card">
        <text class="summary-value">{{ total }}</text>
        <text class="summary-label">全部条目</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ publishedCount }}</text>
        <text class="summary-label">已发布</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ draftCount }}</text>
        <text class="summary-label">草稿</text>
      </view>
    </view>

    <view class="toolbar">
      <view class="toolbar-actions">
        <button class="btn-sm" @click="openCreate">新增非遗内容</button>
        <button class="btn-sm ghost" @click="syncSeeds">同步种子数据</button>
      </view>
    </view>

    <view v-if="!loading && items.length === 0" class="empty">
      暂无非遗内容。请先点击"同步种子数据"写入澳门/湖南示例条目，或点击"新增非遗内容"手动创建。
    </view>

    <view v-for="item in items" :key="item._id" class="heritage-card">
      <view class="card-main">
        <view class="card-info">
          <view class="title-row">
            <text class="card-marker">打卡点 ID：{{ item.markerId }}</text>
            <text class="badge" :class="item.status === 'published' ? 'published' : 'draft'">
              {{ item.status === 'published' ? '已发布' : '草稿' }}
            </text>
          </view>
          <view class="cat-row">
            <text class="cat-badge-text">{{ item.category }}</text>
          </view>
          <text class="card-summary">{{ truncate(item.summary, 60) }}</text>
        </view>
        <view class="card-actions">
          <text class="act-btn edit" @click="startEdit(item)">编辑</text>
          <text class="act-btn del" @click="doDelete(item)">删除</text>
        </view>
      </view>
    </view>

    <view v-if="hasMore" class="load-more" @click="loadItems">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const items = ref([])
const total = ref(0)
const publishedCount = ref(0)
const draftCount = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
let offset = 0
const limit = 50

const api = uniCloud.importObject('heritage-center')

onShow(() => { reload() })

function reload() {
  offset = 0
  items.value = []
  total.value = 0
  loadItems()
}

async function loadItems() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await api.adminList({ offset, limit })
    if (res.errCode !== 0) throw new Error(res.errMsg || '非遗内容加载失败')
    const list = res.data || []
    items.value = offset === 0 ? list : [...items.value, ...list]
    total.value = items.value.length
    hasMore.value = list.length >= limit
    offset += list.length
    recalcSummary()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '连接服务器失败，请确认 heritage-center 已上传')
  } finally {
    loading.value = false
  }
}

function goLogin() {
  goAdminLogin()
}

function recalcSummary() {
  publishedCount.value = items.value.filter(item => item.status === 'published').length
  draftCount.value = items.value.filter(item => item.status !== 'published').length
}

function truncate(str, maxLen) {
  if (!str) return '--'
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

function openCreate() {
  uni.navigateTo({ url: '/pages/heritage/edit' })
}

function startEdit(item) {
  uni.navigateTo({ url: '/pages/heritage/edit?markerId=' + item.markerId })
}

async function doDelete(item) {
  const res = await uni.showModal({
    title: '确认删除',
    content: '确定删除打卡点 ' + item.markerId + ' 的非遗内容？此操作不可恢复。'
  })
  if (!res.confirm) return
  try {
    const delRes = await api.remove({ _id: item._id })
    if (delRes.errCode !== 0) throw new Error(delRes.errMsg || '删除失败')
    uni.showToast({ title: '已删除', icon: 'success' })
    reload()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '删除失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '删除失败'), icon: 'none' })
  }
}

async function syncSeeds() {
  try {
    const res = await api.seedDefaults()
    if (res.errCode !== 0) throw new Error(res.errMsg || '同步失败')
    const data = res.data || {}
    uni.showToast({
      title: '打卡点 +' + (data.markerWrites || 0) + '，非遗 +' + (data.heritageWrites || 0),
      icon: 'none',
      duration: 3000
    })
    reload()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '同步失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '同步失败'), icon: 'none' })
  }
}
</script>

<style>
.heritage-page { padding: 24rpx; }

.notice {
  background: #eef9f2;
  border-radius: 12rpx;
  color: #2e9f5f;
  font-size: 24rpx;
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
}

.notice.error {
  background: #fff1f0;
  color: #d93026;
}

.login-cta {
  background: #2ecc71;
  border: none;
  border-radius: 999rpx;
  color: #fff;
  font-size: 24rpx;
  margin: 0 0 16rpx 0;
  padding: 12rpx 28rpx;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.summary-card {
  background: #fff;
  border-radius: 14rpx;
  padding: 22rpx 12rpx;
  text-align: center;
}

.summary-value {
  display: block;
  color: #2ecc71;
  font-size: 38rpx;
  font-weight: 700;
}

.summary-label {
  color: #8a9a90;
  font-size: 22rpx;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16rpx;
}

.toolbar-actions { display: flex; gap: 10rpx; flex-wrap: wrap; justify-content: flex-end; }

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-sm.ghost {
  background: #ecf9f1;
  color: #2e9f5f;
}

.heritage-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.card-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
}

.card-info { flex: 1; }

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.card-marker {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.badge {
  border-radius: 999rpx;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
}

.badge.published {
  background: #e6f9ed;
  color: #27ae60;
}

.badge.draft {
  background: #f4f4f4;
  color: #999;
}

.cat-row {
  margin-bottom: 6rpx;
}

.cat-badge-text {
  font-size: 22rpx;
  color: #1a73e8;
  background: #e8f0fe;
  padding: 4rpx 16rpx;
  border-radius: 24rpx;
}

.card-summary {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  margin-top: 8rpx;
}

.card-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
}

.act-btn { font-size: 26rpx; padding: 8rpx 16rpx; }
.act-btn.edit { color: #2ecc71; }
.act-btn.del { color: #ff3b30; }

.load-more { text-align: center; padding: 24rpx; color: #2ecc71; font-size: 26rpx; }
.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
</style>
