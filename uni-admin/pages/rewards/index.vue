<template>
  <view class="rewards-page">
    <AdminHeader
      title="奖励记录"
      subtitle="查看用户通过任务和主题路线获得、兑换的积分奖励"
      @refresh="reload"
    />

    <view class="filter-row">
      <text class="filter-chip" :class="statusFilter === '' ? 'active' : ''" @click="setStatus('')">全部</text>
      <text class="filter-chip" :class="statusFilter === 'pending' ? 'active' : ''" @click="setStatus('pending')">待兑</text>
      <text class="filter-chip" :class="statusFilter === 'claimed' ? 'active' : ''" @click="setStatus('claimed')">已兑</text>
      <text class="filter-chip" :class="sourceFilter === 'route' ? 'active' : ''" @click="toggleSource('route')">路线</text>
      <text class="filter-chip" :class="sourceFilter === 'task' ? 'active' : ''" @click="toggleSource('task')">任务</text>
    </view>

    <view class="search-bar">
      <input class="search-input" v-model="userIdInput" placeholder="按 userId 筛选" confirm-type="search" @confirm="reload" />
      <button class="btn-search" @click="reload">筛选</button>
      <button class="btn-reset" @click="resetFilters">重置</button>
    </view>

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading && list.length === 0" class="notice">正在加载奖励记录...</view>

    <text class="page-desc">共 {{ total }} 条奖励记录</text>

    <view v-if="!loading && list.length === 0" class="empty">
      暂无奖励记录。用户完成任务或主题路线后会在这里沉淀奖励明细。
    </view>

    <view v-for="row in list" :key="row._id" class="reward-card">
      <view class="card-head">
        <view>
          <text class="user-name">{{ row.userName || row.userId || '--' }}</text>
          <text class="user-id">UID: {{ row.userId || '--' }}</text>
        </view>
        <text class="status-pill" :class="row.rewardClaimed ? 'claimed' : 'pending'">{{ row.statusText }}</text>
      </view>
      <view class="card-body">
        <text class="source-pill" :class="row.sourceType">{{ sourceLabel(row.sourceType) }}</text>
        <text class="source-title">{{ row.sourceTitle || '--' }}</text>
      </view>
      <view class="meta-grid">
        <view class="meta-item">
          <text class="meta-label">积分</text>
          <text class="meta-value points">{{ row.rewardPoints }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">奖励</text>
          <text class="meta-value">{{ row.reward || '--' }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">获得时间</text>
          <text class="meta-value">{{ formatTime(row.earnedAt) }}</text>
        </view>
        <view class="meta-item">
          <text class="meta-label">兑换时间</text>
          <text class="meta-value">{{ formatTime(row.claimedAt) }}</text>
        </view>
      </view>
    </view>

    <view v-if="hasMore" class="load-more" @click="fetchData">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const list = ref([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const statusFilter = ref('')
const sourceFilter = ref('')
const userIdInput = ref('')
let offset = 0
const limit = 20
const api = uniCloud.importObject('admin-center')

onShow(() => { reload() })

function setStatus(status) {
  statusFilter.value = status
  reload()
}

function toggleSource(source) {
  sourceFilter.value = sourceFilter.value === source ? '' : source
  reload()
}

function resetFilters() {
  statusFilter.value = ''
  sourceFilter.value = ''
  userIdInput.value = ''
  reload()
}

function reload() {
  offset = 0
  list.value = []
  total.value = 0
  fetchData()
}

async function fetchData() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const payload = {
      offset,
      limit
    }
    if (statusFilter.value) payload.status = statusFilter.value
    if (sourceFilter.value) payload.source = sourceFilter.value
    if (userIdInput.value.trim().length > 0) payload.userId = userIdInput.value.trim()
    const res = await api.getRewardRecords(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '奖励记录加载失败')
    const data = res.data || {}
    const rows = data.list || []
    list.value = offset === 0 ? rows : [...list.value, ...rows]
    total.value = data.total || list.value.length
    hasMore.value = list.value.length < total.value
    offset += limit
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = getErrorMessage(e, '连接服务器失败，请确认 admin-center 已上传')
  } finally {
    loading.value = false
  }
}

function goLogin() {
  goAdminLogin()
}

function sourceLabel(source) {
  if (source === 'route') return '路线'
  return '任务'
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style>
.rewards-page { padding: 24rpx; }

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.filter-chip {
  background: #fff;
  border: 1rpx solid #d9e2dc;
  border-radius: 999rpx;
  color: #4a5b54;
  font-size: 24rpx;
  padding: 8rpx 22rpx;
}

.filter-chip.active {
  background: #2ecc71;
  border-color: #2ecc71;
  color: #fff;
}

.search-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.search-input {
  flex: 1;
  background: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 16rpx 20rpx;
}

.btn-search,
.btn-reset {
  border: none;
  border-radius: 8rpx;
  font-size: 24rpx;
  padding: 8rpx 22rpx;
}

.btn-search {
  background: #2ecc71;
  color: #fff;
}

.btn-reset {
  background: #eef2f3;
  color: #4a5b54;
}

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

.page-desc {
  color: #888;
  display: block;
  font-size: 22rpx;
  margin-bottom: 12rpx;
}

.empty {
  color: #999;
  font-size: 26rpx;
  line-height: 1.7;
  padding: 80rpx 20rpx;
  text-align: center;
}

.reward-card {
  background: #fff;
  border-radius: 14rpx;
  margin-bottom: 16rpx;
  padding: 24rpx;
}

.card-head,
.card-body {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.card-body {
  justify-content: flex-start;
  margin-top: 16rpx;
}

.user-name {
  color: #123322;
  display: block;
  font-size: 30rpx;
  font-weight: 700;
}

.user-id {
  color: #8a9891;
  display: block;
  font-size: 22rpx;
  margin-top: 4rpx;
}

.status-pill,
.source-pill {
  border-radius: 999rpx;
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  white-space: nowrap;
}

.status-pill.pending {
  background: #fff7e6;
  color: #d48806;
}

.status-pill.claimed {
  background: #e6f9ed;
  color: #1f7a45;
}

.source-pill.route {
  background: #eaf3ff;
  color: #1677ff;
}

.source-pill.task {
  background: #eef9f2;
  color: #2e9f5f;
}

.source-title {
  color: #333;
  flex: 1;
  font-size: 28rpx;
  font-weight: 600;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 18rpx;
}

.meta-item {
  background: #f8faf9;
  border-radius: 10rpx;
  padding: 14rpx;
}

.meta-label {
  color: #8a9891;
  display: block;
  font-size: 20rpx;
}

.meta-value {
  color: #333;
  display: block;
  font-size: 24rpx;
  margin-top: 4rpx;
  word-break: break-all;
}

.meta-value.points {
  color: #2ecc71;
  font-size: 30rpx;
  font-weight: 700;
}

.load-more {
  color: #2ecc71;
  font-size: 26rpx;
  padding: 24rpx;
  text-align: center;
}
</style>
