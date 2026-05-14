<template>
  <view class="tasks-page">
    <AdminHeader
      title="任务管理"
      subtitle="同步默认任务，并管理任务启用状态"
      @refresh="fetchTasks"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <button v-if="needsLogin" class="login-cta" @click="goLogin">去登录</button>
    <view v-if="loading" class="notice">正在加载任务...</view>

    <view class="toolbar">
      <text class="page-desc">共 {{ tasks.length }} 个任务</text>
      <view class="toolbar-actions">
        <button class="btn-sm" @click="openCreate">新增任务</button>
        <button class="btn-sm" @click="syncTasks">同步默认任务</button>
        <button class="btn-sm ghost" @click="goRoutes">主题路线</button>
      </view>
    </view>

    <view v-if="!loading && tasks.length === 0" class="empty">
      暂无任务数据。点击“同步默认任务”会写入与本地 starter tasks 对齐的 6 个云端任务。
    </view>

    <view v-for="t in tasks" :key="t._id" class="task-card">
      <view class="task-header">
        <text class="task-name">{{ t.name }}</text>
        <view class="task-status" :class="t.status === 'active' ? 'active' : 'archived'">
          <text>{{ t.status === 'active' ? '进行中' : '已归档' }}</text>
        </view>
      </view>
      <text class="task-desc">{{ t.description || '无描述' }}</text>
      <view class="task-meta">
        <text>任务 ID: {{ t.id || '--' }}</text>
        <text>目标: {{ resolveMarkerTitle(t) }}</text>
        <text>目标点 ID: {{ t.targetMarkerId || '--' }}</text>
        <text>奖励: {{ taskRewardText(t) }}</text>
      </view>
      <view class="task-actions">
        <text class="tact" @click="startEdit(t)">编辑</text>
        <text class="tact" @click="toggleStatus(t)">
          {{ t.status === 'active' ? '归档任务' : '激活任务' }}
        </text>
      </view>
    </view>

    <view v-if="editing" class="modal-mask" @click="closeEdit">
      <view class="modal-box" @click.stop>
        <text class="modal-title">{{ editing._id ? '编辑任务' : '新增任务' }}</text>
        <view class="id-hint">
          <text class="id-hint-label">任务 ID</text>
          <text class="id-hint-value">{{ editing._id ? editForm.id : '保存时自动生成' }}</text>
        </view>
        <input class="modal-input" v-model="editForm.name" placeholder="任务名称" />
        <textarea class="modal-textarea" v-model="editForm.description" placeholder="任务描述（可选）" />
        <view class="marker-picker">
          <text class="modal-label">目标打卡点</text>
          <view class="picker-button" @click="openMarkerPicker">
            <text v-if="editForm.targetMarkerId" class="picker-button-text">
              {{ selectedMarkerLabel || ('ID ' + editForm.targetMarkerId) }}
            </text>
            <text v-else class="picker-button-text placeholder">请选择目标打卡点</text>
            <text class="picker-button-caret">›</text>
          </view>
          <text v-if="markerPickerError" class="picker-error">{{ markerPickerError }}</text>
        </view>
        <view class="modal-row modal-row-stack">
          <text class="modal-label">奖励类型</text>
          <view class="status-toggle">
            <text class="toggle-pill" :class="editForm.rewardKind === 'none' ? 'on' : ''" @click="editForm.rewardKind = 'none'">无</text>
            <text class="toggle-pill" :class="editForm.rewardKind === 'prize' ? 'on' : ''" @click="editForm.rewardKind = 'prize'">奖品</text>
            <text class="toggle-pill" :class="editForm.rewardKind === 'points' ? 'on' : ''" @click="editForm.rewardKind = 'points'">积分</text>
            <text class="toggle-pill" :class="editForm.rewardKind === 'both' ? 'on' : ''" @click="editForm.rewardKind = 'both'">奖品+积分</text>
          </view>
        </view>
        <input v-if="editForm.rewardKind !== 'none'" class="modal-input" v-model="editForm.reward" placeholder="奖励文案（可选）" />
        <input v-if="editForm.rewardKind === 'points' || editForm.rewardKind === 'both'" class="modal-input" type="number" v-model="editForm.rewardPoints" placeholder="积分数量" />
        <view class="modal-row">
          <text class="modal-label">状态</text>
          <view class="status-toggle">
            <text class="toggle-pill" :class="editForm.status === 'active' ? 'on' : ''" @click="editForm.status = 'active'">进行中</text>
            <text class="toggle-pill" :class="editForm.status === 'archived' ? 'on' : ''" @click="editForm.status = 'archived'">已归档</text>
          </view>
        </view>
        <view class="modal-btns">
          <button class="btn-cancel" @click="closeEdit">取消</button>
          <button class="btn-primary" @click="saveTask">保存</button>
        </view>
      </view>
    </view>

    <view v-if="markerPickerOpen" class="modal-mask" @click="closeMarkerPicker">
      <view class="modal-box picker-box" @click.stop>
        <text class="modal-title">选择目标打卡点</text>
        <input class="modal-input" v-model="markerKeyword" placeholder="按名称搜索" />
        <view v-if="markersLoading" class="notice">正在加载打卡点...</view>
        <view v-else-if="filteredMarkers.length === 0" class="empty">没有匹配的打卡点</view>
        <scroll-view v-else scroll-y class="picker-list">
          <view
            v-for="m in filteredMarkers"
            :key="m._id || m.id"
            class="picker-row"
            :class="m.id === editForm.targetMarkerId ? 'on' : ''"
            @click="selectMarker(m)"
          >
            <text class="picker-row-title">{{ m.title }}</text>
            <text class="picker-row-id">#{{ m.id }}</text>
          </view>
        </scroll-view>
        <view class="modal-btns">
          <button class="btn-cancel" @click="closeMarkerPicker">关闭</button>
          <button class="btn-sm ghost" @click="loadMarkers(true)">刷新</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'
import { getErrorMessage, goAdminLogin, isAuthError } from '@/utils/adminAuth.js'

const tasks = ref([])
const loading = ref(false)
const errorText = ref('')
const needsLogin = ref(false)
const editing = ref(null)
const editForm = ref({
  id: '',
  name: '',
  description: '',
  targetMarkerId: 0,
  reward: '',
  rewardKind: 'points',
  rewardPoints: 0,
  status: 'active'
})
const markers = ref([])
const markersLoading = ref(false)
const markersLoaded = ref(false)
const markerPickerOpen = ref(false)
const markerKeyword = ref('')
const markerPickerError = ref('')
const api = uniCloud.importObject('admin-center')

onShow(() => { fetchTasks() })

const markerMap = computed(() => {
  const map = new Map()
  for (const m of markers.value) {
    if (m && typeof m.id === 'number') map.set(m.id, m)
  }
  return map
})

const filteredMarkers = computed(() => {
  const kw = markerKeyword.value.trim().toLowerCase()
  if (kw.length === 0) return markers.value
  return markers.value.filter(m => {
    const title = String(m.title || '').toLowerCase()
    const idStr = String(m.id || '')
    return title.includes(kw) || idStr.includes(kw)
  })
})

const selectedMarkerLabel = computed(() => {
  const id = Number(editForm.value.targetMarkerId || 0)
  if (!id) return ''
  const m = markerMap.value.get(id)
  return m ? `${m.title}（#${id}）` : ''
})

async function fetchTasks() {
  loading.value = true
  errorText.value = ''
  needsLogin.value = false
  try {
    const res = await api.getTasks()
    if (res.errCode !== 0) throw new Error(res.errMsg || '任务加载失败')
    tasks.value = res.data || []
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

async function syncTasks() {
  try {
    const res = await api.syncDefaultTasks()
    if (res.errCode !== 0) throw new Error(res.errMsg || '同步失败')
    const data = res.data || {}
    uni.showToast({ title: `新增 ${data.created.length}，更新 ${data.updated.length}`, icon: 'none' })
    fetchTasks()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '同步失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '同步失败'), icon: 'none' })
  }
}

function goRoutes() {
  uni.navigateTo({ url: '/pages/routes/index' })
}

async function loadMarkers(force) {
  if (markersLoaded.value && !force) return
  markersLoading.value = true
  try {
    const res = await api.getMarkers({ offset: 0, limit: 100 })
    if (res.errCode !== 0) throw new Error(res.errMsg || '打卡点加载失败')
    markers.value = (res.data && res.data.list) || []
    markersLoaded.value = true
  } catch (e) {
    uni.showToast({ title: getErrorMessage(e, '打卡点加载失败'), icon: 'none' })
  } finally {
    markersLoading.value = false
  }
}

function openMarkerPicker() {
  markerPickerOpen.value = true
  markerKeyword.value = ''
  loadMarkers(false)
}

function closeMarkerPicker() {
  markerPickerOpen.value = false
}

function selectMarker(m) {
  editForm.value.targetMarkerId = Number(m.id || 0)
  markerPickerError.value = ''
  markerPickerOpen.value = false
}

function resolveMarkerTitle(task) {
  const id = Number(task && task.targetMarkerId)
  if (id > 0) {
    const m = markerMap.value.get(id)
    if (m && m.title) return m.title
  }
  if (task && task.targetTitle) return task.targetTitle
  return '--'
}

function taskRewardText(task) {
  const kind = task.rewardKind || 'points'
  const points = Number(task.rewardPoints || 0)
  if (kind === 'none') return '无'
  if (kind === 'points') return points > 0 ? `${points} 积分` : (task.reward || '积分')
  if (kind === 'both') return `${task.reward || '--'} / ${points} 积分`
  return task.reward || '--'
}

function openCreate() {
  editing.value = { _id: '' }
  editForm.value = {
    id: '',
    name: '',
    description: '',
    targetMarkerId: 0,
    reward: '',
    rewardKind: 'points',
    rewardPoints: 0,
    status: 'active'
  }
  markerPickerError.value = ''
  loadMarkers(false)
}

function startEdit(task) {
  editing.value = task
  editForm.value = {
    id: task.id || '',
    name: task.name || '',
    description: task.description || '',
    targetMarkerId: Number(task.targetMarkerId || 0),
    reward: task.reward || '',
    rewardKind: task.rewardKind || 'points',
    rewardPoints: Number(task.rewardPoints || 0),
    status: task.status || 'active'
  }
  markerPickerError.value = ''
  loadMarkers(false)
}

function closeEdit() {
  editing.value = null
}

async function saveTask() {
  if (!editing.value) return
  if (!editForm.value.name.trim()) {
    uni.showToast({ title: '请填写任务名称', icon: 'none' })
    return
  }
  const targetMarkerId = Number(editForm.value.targetMarkerId || 0)
  if (!targetMarkerId) {
    markerPickerError.value = '请选择目标打卡点'
    uni.showToast({ title: '请选择目标打卡点', icon: 'none' })
    return
  }
  if (markersLoaded.value && markers.value.length > 0 && !markerMap.value.has(targetMarkerId)) {
    markerPickerError.value = `目标点 #${targetMarkerId} 不在当前打卡点列表中`
    uni.showToast({ title: markerPickerError.value, icon: 'none' })
    return
  }
  try {
    const payload = {
      _id: editing.value._id || '',
      id: editing.value._id ? editForm.value.id : '',
      name: editForm.value.name,
      description: editForm.value.description,
      targetMarkerId,
      reward: editForm.value.reward,
      rewardKind: editForm.value.rewardKind,
      rewardPoints: Number(editForm.value.rewardPoints || 0),
      status: editForm.value.status
    }
    const res = await api.upsertTask(payload)
    if (res.errCode !== 0) throw new Error(res.errMsg || '保存失败')
    uni.showToast({ title: '保存成功', icon: 'success' })
    editing.value = null
    markerPickerError.value = ''
    fetchTasks()
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '保存失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '保存失败'), icon: 'none' })
  }
}

async function toggleStatus(t) {
  const newStatus = t.status === 'active' ? 'archived' : 'active'
  try {
    const res = newStatus === 'archived'
      ? await api.deleteTask({ _id: t._id })
      : await api.upsertTask({ ...t, status: newStatus })
    if (res.errCode !== 0) throw new Error(res.errMsg || '操作失败')
    t.status = newStatus
    uni.showToast({ title: newStatus === 'active' ? '已激活' : '已归档', icon: 'success' })
  } catch (e) {
    needsLogin.value = isAuthError(e)
    errorText.value = needsLogin.value ? getErrorMessage(e, '操作失败') : errorText.value
    uni.showToast({ title: getErrorMessage(e, '操作失败'), icon: 'none' })
  }
}
</script>

<style>
.tasks-page { padding: 24rpx; }

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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  gap: 16rpx;
}

.page-desc {
  font-size: 24rpx;
  color: #888;
}

.toolbar-actions {
  display: flex;
  gap: 12rpx;
}

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
}

.btn-sm.ghost {
  background: #fff;
  color: #2ecc71;
  border: 1rpx solid #2ecc71;
}

.task-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 12rpx;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.task-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.task-status {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
}

.task-status.active { background: #e6f9ed; color: #27ae60; }
.task-status.archived { background: #f0f0f0; color: #999; }

.task-desc {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 8rpx;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  font-size: 22rpx;
  color: #aaa;
  margin-bottom: 12rpx;
}

.task-actions {
  display: flex;
  gap: 24rpx;
  border-top: 1rpx solid #f5f5f5;
  padding-top: 12rpx;
}

.tact {
  font-size: 26rpx;
  color: #2ecc71;
}

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
}

.modal-box {
  width: 88%;
  max-height: 80vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
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
  padding: 20rpx;
  font-size: 28rpx;
  min-height: 80rpx;
  margin-bottom: 16rpx;
  width: 100%;
  box-sizing: border-box;
}

.id-hint {
  background: #f7f8fa;
  border-radius: 8rpx;
  padding: 18rpx 20rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.id-hint-label {
  color: #666;
  font-size: 24rpx;
}

.id-hint-value {
  color: #123322;
  font-size: 24rpx;
  font-weight: 600;
}

.modal-textarea {
  display: block;
  width: 100%;
  min-height: 120rpx;
  background: #f7f8fa;
  border-radius: 8rpx;
  padding: 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.modal-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 12rpx 0;
}

.modal-row-stack {
  align-items: flex-start;
  flex-direction: column;
}

.modal-label {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-bottom: 4rpx;
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
  margin-top: 24rpx;
}

.btn-cancel,
.btn-primary {
  flex: 1;
  border-radius: 8rpx;
  font-size: 28rpx;
  padding: 16rpx 0;
  border: none;
}

.btn-cancel { background: #f2f3f5; color: #666; }
.btn-primary { background: #2ecc71; color: #fff; }

.marker-picker { margin-bottom: 16rpx; }

.picker-button {
  background: #f7f8fa;
  border: 1rpx solid #e3e6eb;
  border-radius: 8rpx;
  padding: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-button-text {
  flex: 1;
  font-size: 28rpx;
  color: #123322;
}

.picker-button-text.placeholder { color: #999; }

.picker-button-caret {
  color: #999;
  font-size: 32rpx;
  margin-left: 16rpx;
}

.picker-error {
  display: block;
  font-size: 22rpx;
  color: #d93026;
  margin-top: 6rpx;
}

.picker-box { max-height: 86vh; }

.picker-list {
  max-height: 60vh;
  margin: 12rpx 0;
}

.picker-row {
  padding: 18rpx 20rpx;
  border-bottom: 1rpx solid #f0f1f3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.picker-row.on {
  background: #e6f9ed;
}

.picker-row-title {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.picker-row-id {
  font-size: 22rpx;
  color: #999;
  margin-left: 16rpx;
}
</style>
