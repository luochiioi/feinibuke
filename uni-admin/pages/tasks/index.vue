<template>
  <view class="tasks-page">
    <AdminHeader
      title="任务管理"
      subtitle="同步默认任务，并管理任务启用状态"
      @refresh="fetchTasks"
    />

    <view v-if="errorText" class="notice error">{{ errorText }}</view>
    <view v-if="loading" class="notice">正在加载任务...</view>

    <view class="toolbar">
      <text class="page-desc">共 {{ tasks.length }} 个任务</text>
      <button class="btn-sm" @click="syncTasks">同步默认任务</button>
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
        <text>目标: {{ t.targetTitle || '--' }}</text>
        <text>目标点 ID: {{ t.targetMarkerId || '--' }}</text>
        <text>奖励: {{ t.reward || '--' }}</text>
      </view>
      <view class="task-actions">
        <text class="tact" @click="toggleStatus(t)">
          {{ t.status === 'active' ? '归档任务' : '激活任务' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AdminHeader from '@/components/AdminHeader.vue'

const tasks = ref([])
const loading = ref(false)
const errorText = ref('')
const api = uniCloud.importObject('admin-center')

onShow(() => { fetchTasks() })

async function fetchTasks() {
  loading.value = true
  errorText.value = ''
  try {
    const res = await api.getTasks()
    if (res.errCode !== 0) throw new Error(res.errMsg || '任务加载失败')
    tasks.value = res.data || []
  } catch (e) {
    errorText.value = e.message || '连接服务器失败，请确认 admin-center 已上传'
  } finally {
    loading.value = false
  }
}

async function syncTasks() {
  try {
    const res = await api.syncDefaultTasks()
    if (res.errCode !== 0) throw new Error(res.errMsg || '同步失败')
    const data = res.data || {}
    uni.showToast({ title: `新增 ${data.created.length}，更新 ${data.updated.length}`, icon: 'none' })
    fetchTasks()
  } catch (e) {
    uni.showToast({ title: e.message || '同步失败', icon: 'none' })
  }
}

async function toggleStatus(t) {
  const newStatus = t.status === 'active' ? 'archived' : 'active'
  try {
    const res = await api.updateTask({ _id: t._id, status: newStatus, updatedAt: Date.now() })
    if (res.errCode !== 0) throw new Error(res.errMsg || '操作失败')
    t.status = newStatus
    uni.showToast({ title: newStatus === 'active' ? '已激活' : '已归档', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
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

.btn-sm {
  background: #2ecc71;
  color: #fff;
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  border: none;
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
  border-top: 1rpx solid #f5f5f5;
  padding-top: 12rpx;
}

.tact {
  font-size: 26rpx;
  color: #2ecc71;
}

.empty { text-align: center; color: #999; line-height: 1.7; padding: 80rpx 20rpx; font-size: 26rpx; }
</style>
