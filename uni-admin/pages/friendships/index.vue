<template>
  <view class="friendships-page">
    <AdminHeader title="好友关系管理" subtitle="查看、撤销用户好友关系" @refresh="reload" />

    <view class="filter-row">
      <text class="filter-chip" :class="statusFilter == '' ? 'active' : ''" @click="setStatus('')">全部</text>
      <text class="filter-chip" :class="statusFilter == 'pending' ? 'active' : ''" @click="setStatus('pending')">待处理</text>
      <text class="filter-chip" :class="statusFilter == 'accepted' ? 'active' : ''" @click="setStatus('accepted')">已接受</text>
    </view>

    <view class="filter-row">
      <input class="uid-input" v-model="uidFilter" placeholder="按用户ID筛选" />
    </view>

    <view v-if="rows.length == 0" class="empty"><text class="empty-text">暂无好友关系记录</text></view>

    <view v-for="row in rows" :key="row._id" class="row-card">
      <view class="row-info">
        <text class="row-uid">{{ row.userId }}</text>
        <text class="row-status" :class="'status-' + row.status">{{ statusLabel(row.status) }}</text>
        <text class="row-fid">→ {{ row.friendUserId }}</text>
      </view>
      <text class="row-time">{{ fmtTime(row.createdAt) }}</text>
      <view v-if="row.status != 'rejected'" class="row-actions">
        <view class="btn-revoke" @click="doRevoke(row._id)"><text class="btn-text-revoke">撤销</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AdminHeader from '@/components/AdminHeader.vue'

const statusFilter = ref('')
const uidFilter = ref('')
const rows = ref([])

const adminApi = uniCloud.importObject('admin-center')

function setStatus(s) { statusFilter.value = s; reload() }
function statusLabel(s) {
  if (s == 'pending') return '待处理'
  if (s == 'accepted') return '已接受'
  if (s == 'rejected') return '已拒绝'
  return s
}
function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

async function reload() {
  try {
    const payload = {}
    if (statusFilter.value) payload.status = statusFilter.value
    if (uidFilter.value.trim()) payload.userId = uidFilter.value.trim()
    const res = await adminApi.getFriendships(payload)
    const data = res.result || res
    rows.value = (data.rows || [])
  } catch (e) {
    console.error('getFriendships failed', e)
  }
}

async function doRevoke(id) {
  try {
    await adminApi.revokeFriendship({ _id: id })
    uni.showToast({ title: '已撤销' })
    reload()
  } catch (e) {
    uni.showToast({ title: '撤销失败' })
  }
}

onMounted(() => reload())
</script>

<style scoped>
.friendships-page { padding: 24rpx; }
.filter-row { display: flex; margin-bottom: 16rpx; }
.filter-chip { padding: 8rpx 20rpx; border-radius: 999rpx; background: #f0f0f0; margin-right: 12rpx; font-size: 24rpx; cursor: pointer; }
.filter-chip.active { background: #2ecc71; color: #fff; }
.uid-input { flex: 1; height: 52rpx; border: 1px solid #ddd; border-radius: 8rpx; padding: 0 12rpx; font-size: 24rpx; }
.empty { padding: 80rpx 0; text-align: center; }
.empty-text { font-size: 26rpx; color: #999; }
.row-card { background: #fff; border-radius: 12rpx; padding: 20rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.row-info { display: flex; align-items: center; margin-bottom: 8rpx; }
.row-uid { font-size: 24rpx; color: #333; font-weight: 500; }
.row-status { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 999rpx; margin: 0 12rpx; }
.status-pending { background: #fff3cd; color: #856404; }
.status-accepted { background: #d4edda; color: #155724; }
.row-fid { font-size: 22rpx; color: #666; }
.row-time { font-size: 20rpx; color: #aaa; }
.row-actions { margin-top: 12rpx; }
.btn-revoke { padding: 8rpx 20rpx; background: #ff3b30; border-radius: 999rpx; display: inline-block; }
.btn-text-revoke { font-size: 22rpx; color: #fff; }
</style>
