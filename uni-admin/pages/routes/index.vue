<template>
  <view class="routes-page">
    <AdminHeader
      title="主题路线管理"
      subtitle="新增、编辑、归档主题路线，串联多个打卡点"
      @refresh="reload"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <view v-if="loading && routes.length === 0" class="notice">正在加载路线...</view>

    <view class="summary-grid">
      <view class="summary-card">
        <text class="summary-value">{{ total }}</text>
        <text class="summary-label">云端路线</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ activeCount }}</text>
        <text class="summary-label">进行中</text>
      </view>
      <view class="summary-card">
        <text class="summary-value">{{ archivedCount }}</text>
        <text class="summary-label">已归档</text>
      </view>
    </view>

    <view class="toolbar">
      <view class="toolbar-actions">
        <button class="btn-sm" @click="openCreate">新增路线</button>
      </view>
      <view class="filter-tabs">
        <text class="filter-tab" :class="statusFilter === 'all' ? 'active' : ''" @click="setFilter('all')">全部</text>
        <text class="filter-tab" :class="statusFilter === 'active' ? 'active' : ''" @click="setFilter('active')">进行中</text>
        <text class="filter-tab" :class="statusFilter === 'archived' ? 'active' : ''" @click="setFilter('archived')">已归档</text>
      </view>
    </view>

    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索路线名称" confirm-type="search" @confirm="reload" />
      <button class="btn-search" @click="reload">搜索</button>
    </view>

    <view v-if="!loading && routes.length === 0" class="empty">
      暂无主题路线。点击"新增路线"，选 N 个 marker 串成一条主题路线。
    </view>

    <view v-for="r in routes" :key="r._id" class="route-card">
      <view class="card-main">
        <view class="card-info">
          <view class="title-row">
            <text class="card-title">{{ r.name }}</text>
            <view class="badge" :class="r.status === 'active' ? 'active' : 'archived'">
              <text>{{ r.status === 'active' ? '进行中' : '已归档' }}</text>
            </view>
          </view>
          <text class="card-desc">{{ r.description || '无描述' }}</text>
          <text class="card-meta">奖励：{{ r.reward || '--' }}</text>
          <text class="card-meta">打卡点：{{ formatMarkerNames(r.markerIds) }}</text>
          <text class="card-meta">路线 ID：{{ r.id }} · 创建于 {{ formatTime(r.createdAt) }} · 更新于 {{ formatTime(r.updatedAt) }}</text>
          <text v-if="r.coverImage" class="card-meta">封面：{{ r.coverImage }}</text>
        </view>
        <view class="card-actions">
          <text class="act-btn edit" @click="startEdit(r)">编辑</text>
          <text class="act-btn toggle" @click="toggleStatus(r)">
            {{ r.status === 'active' ? '归档' : '激活' }}
          </text>
          <text class="act-btn del" @click="doDelete(r)">删除</text>
        </view>
      </view>
    </view>

    <view v-if="hasMore" class="load-more" @click="loadRoutes">
      <text>{{ loading ? '加载中...' : '加载更多' }}</text>
    </view>

    <view v-if="editing" class="modal-mask" @click="closeEdit">
      <view class="modal-box" @click.stop>
        <text class="modal-title">{{ editing._id ? '编辑路线' : '新增路线' }}</text>
        <input class="modal-input" v-model="editForm.name" placeholder="路线名称（≤30 字）" />
        <textarea class="modal-textarea" v-model="editForm.description" placeholder="简介（≤200 字，可选）" />
        <input class="modal-input" v-model="editForm.reward" placeholder="奖励文案，例如 20 积分 + 路线徽章" />
        <input class="modal-input" v-model="editForm.coverImage" placeholder="封面图 cloudURL（可选）" />
        <text class="modal-label">选择打卡点（按勾选顺序作为路线顺序，至少 1 个）</text>
        <view class="markers-select">
          <view
            v-for="m in availableMarkers"
            :key="m.id"
            class="marker-chip"
            :class="markerSelectionClass(m.id)"
            @click="toggleMarker(m.id)"
          >
            <text v-if="selectedIndex(m.id) >= 0" class="marker-order">{{ selectedIndex(m.id) + 1 }}</text>
            <text class="marker-text">{{ m.title }}</text>
          </view>
        </view>
        <text class="modal-hint">已选 {{ editForm.markerIds.length }} 个</text>
        <view class="modal-row">
          <text class="modal-label">状态</text>
          <view class="status-toggle">
            <text class="toggle-pill" :class="editForm.status === 'active' ? 'on' : ''" @click="editForm.status = 'active'">进行中</text>
            <text class="toggle-pill" :class="editForm.status === 'archived' ? 'on' : ''" @click="editForm.status = 'archived'">已归档</text>
          </view>
        </view>
        <view class="modal-btns">
          <button class="btn-cancel" @click="closeEdit">取消</button>
          <button class="btn-primary" @click="saveRoute">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'

const routes = ref([])
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const errorText = ref('')
const keyword = ref('')
const statusFilter = ref('all')
const editing = ref(null)
const editForm = ref({
  name: '',
  description: '',
  reward: '',
  coverImage: '',
  markerIds: [],
  status: 'active'
})
const availableMarkers = ref([])
let offset = 0
const limit = 20

const api = uniCloud.importObject('admin-center')

const activeCount = computed(() => routes.value.filter(r => r.status === 'active').length)
const archivedCount = computed(() => routes.value.filter(r => r.status === 'archived').length)

onShow(() => { reload(); loadMarkerOptions() })

function setFilter(status) {
  statusFilter.value = status
  reload()
}

function reload() {
  offset = 0
  routes.value = []
  total.value = 0
  loadRoutes()
}

async function loadRoutes() {
  if (loading.value) return
  loading.value = true
  errorText.value = ''
  try {
    const payload = { offset, limit, keyword: keyword.value }
    if (statusFilter.value !== 'all') payload.status = statusFilter.value
    const res = await api.getRoutes(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '路线加载失败')
    const data = res.data || {}
    const list = data.list || []
    routes.value = offset === 0 ? list : [...routes.value, ...list]
    total.value = data.total || list.length
    hasMore.value = routes.value.length < total.value
    offset += limit
  } catch (e) {
    errorText.value = e.message || '连接服务器失败，请确认 admin-center 已上传'
  } finally {
    loading.value = false
  }
}

async function loadMarkerOptions() {
  try {
    const res = await api.getMarkers({ offset: 0, limit: 100 })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡点加载失败')
    availableMarkers.value = (res.data && res.data.list) || []
  } catch (e) {
    errorText.value = e.message || '打卡点选项加载失败'
  }
}

function formatMarkerNames(markerIds) {
  if (!Array.isArray(markerIds) || markerIds.length === 0) return '--'
  const titleById = new Map()
  availableMarkers.value.forEach(m => titleById.set(Number(m.id), m.title))
  return markerIds.map(id => titleById.get(Number(id)) || `#${id}`).join(' → ')
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = n => n < 10 ? '0' + n : '' + n
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openCreate() {
  editing.value = { _id: '' }
  editForm.value = {
    name: '',
    description: '',
    reward: '',
    coverImage: '',
    markerIds: [],
    status: 'active'
  }
}

function startEdit(r) {
  editing.value = r
  editForm.value = {
    name: r.name || '',
    description: r.description || '',
    reward: r.reward || '',
    coverImage: r.coverImage || '',
    markerIds: Array.isArray(r.markerIds) ? r.markerIds.map(id => Number(id)) : [],
    status: r.status || 'active'
  }
}

function closeEdit() {
  editing.value = null
}

function selectedIndex(id) {
  return editForm.value.markerIds.indexOf(Number(id))
}

function markerSelectionClass(id) {
  return selectedIndex(id) >= 0 ? 'selected' : ''
}

function toggleMarker(id) {
  const n = Number(id)
  const idx = editForm.value.markerIds.indexOf(n)
  if (idx >= 0) {
    editForm.value.markerIds.splice(idx, 1)
  } else {
    editForm.value.markerIds.push(n)
  }
}

async function saveRoute() {
  if (!editing.value) return
  if (!editForm.value.name.trim()) {
    uni.showToast({ title: '请填写路线名称', icon: 'none' })
    return
  }
  if (!editForm.value.reward.trim()) {
    uni.showToast({ title: '请填写奖励文案', icon: 'none' })
    return
  }
  if (editForm.value.markerIds.length === 0) {
    uni.showToast({ title: '至少选择 1 个打卡点', icon: 'none' })
    return
  }
  try {
    const payload = {
      name: editForm.value.name,
      description: editForm.value.description,
      reward: editForm.value.reward,
      coverImage: editForm.value.coverImage || null,
      markerIds: editForm.value.markerIds,
      status: editForm.value.status
    }
    const res = editing.value._id
      ? await api.updateRoute({ _id: editing.value._id, ...payload })
      : await api.createRoute(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '保存失败')
    uni.showToast({ title: '保存成功', icon: 'success' })
    editing.value = null
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' })
  }
}

async function toggleStatus(r) {
  const newStatus = r.status === 'active' ? 'archived' : 'active'
  try {
    const res = await api.updateRoute({ _id: r._id, status: newStatus })
    if (res.errCode !== 0) throw new Error(res.errMsg || '操作失败')
    r.status = newStatus
    uni.showToast({ title: newStatus === 'active' ? '已激活' : '已归档', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  }
}

async function doDelete(r) {
  const res = await uni.showModal({
    title: '确认删除',
    content: `确定删除路线 "${r.name}"？该操作不会影响已发放给用户的奖励记录。`,
    confirmText: '删除',
    confirmColor: '#d93026'
  })
  if (!res.confirm) return
  try {
    const delRes = await api.deleteRoute({ _id: r._id })
    if (delRes.errCode !== 0) throw new Error(delRes.errMsg || '删除失败')
    uni.showToast({ title: '已删除', icon: 'success' })
    reload()
  } catch (e) {
    uni.showToast({ title: e.message || '删除失败', icon: 'none' })
  }
}
</script>

<style>
.routes-page { padding: 24rpx; }

.notice {
  background: #eef9f2;
  border-radius: 12rpx;
  color: #2e9f5f;
  font-size: 24rpx;
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
}

.notice.error { background: #fff1f0; color: #d93026; }

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.summary-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.summary-value { font-size: 38rpx; font-weight: bold; color: #2ecc71; }
.summary-label { font-size: 22rpx; color: #999; }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  gap: 16rpx;
}

.toolbar-actions { display: flex; gap: 12rpx; }

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
}

.filter-tabs { display: flex; gap: 16rpx; }
.filter-tab {
  font-size: 24rpx;
  color: #888;
  padding: 4rpx 8rpx;
}
.filter-tab.active {
  color: #2ecc71;
  border-bottom: 2rpx solid #2ecc71;
}

.search-bar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.search-input {
  flex: 1;
  background: #fff;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  font-size: 26rpx;
}

.btn-search {
  background: #fff;
  color: #2ecc71;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: 1rpx solid #2ecc71;
}

.empty {
  text-align: center;
  color: #999;
  line-height: 1.7;
  padding: 80rpx 20rpx;
  font-size: 26rpx;
}

.route-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.card-main {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.card-info { flex: 1; min-width: 0; }

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.card-title { font-size: 30rpx; font-weight: 500; color: #333; }

.badge {
  padding: 4rpx 14rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}

.badge.active { background: #e6f9ed; color: #27ae60; }
.badge.archived { background: #f0f0f0; color: #999; }

.card-desc {
  display: block;
  font-size: 24rpx;
  color: #888;
  margin-bottom: 6rpx;
}

.card-meta {
  display: block;
  font-size: 22rpx;
  color: #aaa;
  line-height: 1.6;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.act-btn {
  font-size: 24rpx;
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
  background: #f5f5f5;
  color: #555;
}

.act-btn.edit { background: #eef5ff; color: #1677ff; }
.act-btn.toggle { background: #fff7e6; color: #d48806; }
.act-btn.del { background: #fff1f0; color: #d93026; }

.load-more {
  text-align: center;
  color: #2ecc71;
  font-size: 24rpx;
  padding: 20rpx 0;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-box {
  width: 88%;
  max-height: 80vh;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx 28rpx;
  overflow-y: auto;
}

.modal-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.modal-input {
  display: block;
  background: #f7f8fa;
  border-radius: 8rpx;
  padding: 14rpx 16rpx;
  font-size: 26rpx;
  margin-bottom: 12rpx;
  width: 100%;
  box-sizing: border-box;
}

.modal-textarea {
  display: block;
  width: 100%;
  background: #f7f8fa;
  border-radius: 8rpx;
  padding: 14rpx 16rpx;
  font-size: 26rpx;
  min-height: 100rpx;
  margin-bottom: 12rpx;
  box-sizing: border-box;
}

.modal-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin: 8rpx 0;
}

.modal-hint {
  display: block;
  font-size: 22rpx;
  color: #2ecc71;
  margin-bottom: 12rpx;
}

.modal-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 12rpx 0;
}

.markers-select {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 8rpx;
}

.marker-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #f0f2f5;
  border: 1rpx solid #e0e3e8;
}

.marker-chip.selected {
  background: #e6f9ed;
  border-color: #2ecc71;
}

.marker-order {
  background: #2ecc71;
  color: #fff;
  font-size: 20rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 999rpx;
  text-align: center;
  line-height: 28rpx;
}

.marker-text {
  font-size: 24rpx;
  color: #333;
}

.status-toggle {
  display: flex;
  gap: 8rpx;
}

.toggle-pill {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: #f0f0f0;
  color: #888;
}

.toggle-pill.on { background: #2ecc71; color: #fff; }

.modal-btns {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.btn-cancel {
  flex: 1;
  background: #f0f0f0;
  color: #666;
  font-size: 26rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-primary {
  flex: 1;
  background: #2ecc71;
  color: #fff;
  font-size: 26rpx;
  border-radius: 8rpx;
  border: none;
}
</style>
