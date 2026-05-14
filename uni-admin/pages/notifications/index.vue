<template>
  <view class="broadcast-page">
    <AdminHeader title="通知管理" subtitle="查看通知记录、发送广播" @refresh="reload" />

    <view class="composer card">
      <text class="composer-title">发送广播通知</text>
      <input class="composer-input" v-model="broadcastTitle" placeholder="通知标题" />
      <input class="composer-input" v-model="broadcastBody" placeholder="通知正文（选填）" />
      <view class="composer-row">
        <input class="composer-input uid" v-model="broadcastAudience" placeholder="全部用户 或 uid1,uid2" />
        <view class="btn-send" @click="doBroadcast"><text class="btn-send-text">发送</text></view>
      </view>
    </view>

    <view class="filter-row">
      <text class="filter-chip" :class="typeFilter == '' ? 'active' : ''" @click="setType('')">全部</text>
      <text class="filter-chip" :class="typeFilter == 'system.broadcast' ? 'active' : ''" @click="setType('system.broadcast')">广播</text>
      <text class="filter-chip" :class="typeFilter == 'friend.accepted' ? 'active' : ''" @click="setType('friend.accepted')">好友</text>
      <text class="filter-chip" :class="typeFilter == 'route.completed' ? 'active' : ''" @click="setType('route.completed')">路线</text>
    </view>

    <view v-if="rows.length == 0" class="empty"><text class="empty-text">暂无通知记录</text></view>

    <view v-for="row in rows" :key="row._id" class="row-card">
      <view class="row-head">
        <text class="row-type" :class="'type-' + row.type">{{ row.type }}</text>
        <text class="row-time">{{ fmtTime(row.createdAt) }}</text>
      </view>
      <text class="row-uid">用户: {{ row.userId }}</text>
      <text v-if="row.payload" class="row-payload">{{ JSON.stringify(row.payload) }}</text>
      <text class="row-read" :class="row.read ? 'read-yes' : 'read-no'">{{ row.read ? '已读' : '未读' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AdminHeader from '@/components/AdminHeader.vue'

const typeFilter = ref('')
const rows = ref([])
const broadcastTitle = ref('')
const broadcastBody = ref('')
const broadcastAudience = ref('all')

const adminApi = uniCloud.importObject('admin-center')

function setType(t) { typeFilter.value = t; reload() }
function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

async function reload() {
  try {
    const payload = {}
    if (typeFilter.value) payload.type = typeFilter.value
    const res = await adminApi.getNotifications(payload)
    const data = res.result || res
    rows.value = (data.rows || [])
  } catch (e) {
    console.error('getNotifications failed', e)
  }
}

async function doBroadcast() {
  if (!broadcastTitle.value.trim()) {
    uni.showToast({ title: '请输入标题' })
    return
  }
  try {
    const payload = { title: broadcastTitle.value.trim(), body: broadcastBody.value.trim() }
    const audience = broadcastAudience.value.trim()
    payload.audience = audience || 'all'
    const res = await adminApi.broadcastNotification(payload)
    const data = res.result || res
    uni.showToast({ title: '已发送 ' + (data.sent || 0) + ' 条' })
    broadcastTitle.value = ''
    broadcastBody.value = ''
    broadcastAudience.value = 'all'
    reload()
  } catch (e) {
    uni.showToast({ title: '发送失败' })
  }
}

onMounted(() => reload())
</script>

<style scoped>
.broadcast-page { padding: 24rpx; }
.card { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.composer-title { font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 16rpx; }
.composer-input { height: 60rpx; border: 1px solid #ddd; border-radius: 8rpx; padding: 0 16rpx; margin-bottom: 12rpx; font-size: 24rpx; }
.composer-input.uid { flex: 1; margin-bottom: 0; }
.composer-row { display: flex; align-items: center; }
.btn-send { padding: 0 28rpx; height: 60rpx; background: #2ecc71; border-radius: 8rpx; display: flex; align-items: center; margin-left: 12rpx; }
.btn-send-text { font-size: 24rpx; color: #fff; font-weight: 500; }
.filter-row { display: flex; margin-bottom: 16rpx; }
.filter-chip { padding: 8rpx 20rpx; border-radius: 999rpx; background: #f0f0f0; margin-right: 12rpx; font-size: 24rpx; cursor: pointer; }
.filter-chip.active { background: #2ecc71; color: #fff; }
.empty { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #999; }
.row-card { background: #fff; border-radius: 12rpx; padding: 20rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.row-head { display: flex; justify-content: space-between; margin-bottom: 8rpx; }
.row-type { font-size: 22rpx; padding: 2rpx 12rpx; border-radius: 999rpx; }
.type-system\.broadcast { background: #e8f4fd; color: #0d6efd; }
.type-friend\.accepted { background: #d4edda; color: #155724; }
.type-friend\.requested { background: #fff3cd; color: #856404; }
.type-route\.completed { background: #e3f2fd; color: #1565c0; }
.row-time { font-size: 20rpx; color: #aaa; }
.row-uid { font-size: 22rpx; color: #666; }
.row-payload { font-size: 20rpx; color: #999; margin-top: 4rpx; word-break: break-all; }
.row-read { font-size: 20rpx; margin-top: 4rpx; }
.read-yes { color: #2ecc71; }
.read-no { color: #ff3b30; }
</style>
