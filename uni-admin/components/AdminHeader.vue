<template>
  <view class="admin-header">
    <text class="back-btn" @click="goBack">‹ 返回</text>
    <view class="header-main">
      <text class="header-title">{{ title }}</text>
      <text v-if="subtitle" class="header-subtitle">{{ subtitle }}</text>
    </view>
    <text v-if="showRefresh" class="refresh-btn" @click="emit('refresh')">刷新</text>
  </view>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  showRefresh: { type: Boolean, default: true }
})

const emit = defineEmits(['refresh'])

function goBack() {
  // #ifdef H5
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  // #endif

  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.switchTab({ url: '/pages/dashboard/index' })
    }
  })
}
</script>

<style>
.admin-header {
  background: #fff;
  border-radius: 16rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(24, 60, 36, 0.06);
}

.back-btn,
.refresh-btn {
  color: #1f8f54;
  font-size: 26rpx;
  white-space: nowrap;
}

.header-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.header-title {
  color: #123322;
  font-size: 34rpx;
  font-weight: 700;
}

.header-subtitle {
  color: #7b8c83;
  font-size: 22rpx;
}
</style>
