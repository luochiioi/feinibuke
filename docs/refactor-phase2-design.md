# 第二阶段 · 重构设计方案

> 文档版本：v1.0 · 2026-04-25
> 设计范围：`pages/ai-canva/` + `pages/map/` + 关联 `utils/`、`components/`
> 设计依据：第一阶段分析报告（`refactor-phase1-analysis.md`）
> 规范依据：`README重构流程.md` 第二阶段「重构设计（核心）」

---

## 0. 设计总原则

| 原则 | 落地方式 |
|------|---------|
| UI 与逻辑完全分离 | UI 仅消费 hooks 暴露的响应式状态 + 方法；不直接调云函数、不直接读写 storage |
| 单一职责 | 每个 hook / service 只解决一件事 |
| 无副作用泄漏 | hook 内部 `setInterval` / 事件监听必须在 `onUnmounted` 自动清理 |
| 范式统一 | 全部使用 Vue 3 `<script setup>` + Composition API |
| 平台适配 | Web / APP / MP-WEIXIN 差异下沉到 service 层条件编译 |
| 保留全部既有功能 | 不删除任何用户可见能力（按第一阶段清单逐条核对） |

---

## 1. 目录结构设计

### 1.1 顶层结构（新增层）

```
app-dev/
├── pages/
│   ├── ai-canva/         （UI 层 · 仅 .uvue）
│   └── map/              （UI 层 · 仅 .uvue）
├── components/           （已存在）
│   ├── ai-canva/         （新增 · 模块私有组件）
│   └── map/              （新增 · 模块私有组件）
├── hooks/                【新增】组合式逻辑层
│   ├── ai-canva/
│   └── map/
├── services/             【新增】数据 / 云函数 / 平台 SDK 封装
│   ├── ai-handler.uts
│   └── markers.uts
├── store/                【新增】跨页状态（uni-app x 兼容方式）
│   ├── canvasDraftStore.uts
│   ├── markerStore.uts
│   └── taskStore.uts
└── utils/                （已存在 · 收敛纯函数工具）
    ├── geo.uts           【新增】Haversine + GCJ02 转换
    ├── map-storage.uts   （保留 · 数据层）
    ├── map-tasks.uts     （保留 · 任务种子，迁出硬编码）
    └── (删除) map-utils.uts、coordinate.uts
```

> **删除说明**：
> - `utils/map-utils.uts` 全部函数已被 `map-storage.uts` / `geo.uts` 覆盖；
> - `utils/coordinate.uts` 中坐标转换属死代码，距离计算迁入 `geo.uts`。

### 1.2 `pages/ai-canva/` 模块完整结构

```
pages/ai-canva/
├── index.uvue                        画板主页（仅装配 + 模板，目标 ≤ 350 行）
├── result.uvue                       任务结果页（仅装配 + 模板，目标 ≤ 200 行）
│
components/ai-canva/
├── CanvasSurface.uvue                画布渲染面（条件编译 Web/APP/MP）
├── BrushToolbar.uvue                 笔刷颜色 / 粗细 / 撤销重做
├── ModeSwitcher.uvue                 预设 / 自定义模式切换
├── PromptPanel.uvue                  Prompt 输入 + styleOptions + ideaOptions
├── ActionBar.uvue                    底部「清空 / 提交」操作栏
├── TaskProgress.uvue                 result 页的进度条 + 状态文案
└── ResultPreview.uvue                生成图预览 + 下载 / 分享
│
hooks/ai-canva/
├── useCanvas.uts                     画布 ref / 初始化 / 平台分支收敛
├── useStrokes.uts                    strokes / redoStack / 当前笔画 + 撤销重做
├── usePointer.uts                    触摸 + 鼠标 + Web 指针统一抽象
├── useDraft.uts                      草稿持久化（恢复 / 自动保存 / 清空）
├── usePromptBuilder.uts              预设/自定义 → 最终 prompt 字符串
└── useAITask.uts                     提交 / 轮询 / 取消（result 页直接复用）
│
services/
└── ai-handler.uts                    submitTask / queryTask / cancelTask 云函数封装
```

### 1.3 `pages/map/` 模块完整结构

```
pages/map/
├── index.uvue                        地图主页（目标 ≤ 300 行）
├── add-marker.uvue                   添加打卡点（目标 ≤ 250 行）
├── checkin.uvue                      打卡提交（目标 ≤ 250 行）
├── tasks.uvue                        任务 + 打卡点双 tab（目标 ≤ 400 行）
├── task-detail.uvue                  任务详情（目标 ≤ 250 行）
└── stats.uvue                        统计（目标 ≤ 250 行）
│
components/map/
├── MapCanvas.uvue                    地图容器（marker 渲染 / 事件冒泡）
├── MarkerBubble.uvue                 marker 气泡
├── BottomSheet.uvue                  底部抽屉（替代散落的 absolute 弹层）
├── FloatingActionButton.uvue         右下角 + 按钮（保留 absolute · 业内惯例）
├── MapToolbar.uvue                   左上工具组（图层 / 定位）
├── TaskCard.uvue                     任务卡片（tasks / task-detail 共用）
├── SpotCard.uvue                     打卡点卡片
├── CheckinForm.uvue                  打卡表单（图片压缩 / 距离校验显示）
├── DebugPanel.uvue                   tasks 页同步菜单专用（非生产可见）
└── TimelineList.uvue                 stats 时间线
│
hooks/map/
├── useMap.uts                        地图实例 / 缩放 / 中心点
├── useLocation.uts                   连续定位（含定时器自动清理）
├── useMarkers.uts                    marker 列表（CRUD + 与 markerStore 同步）
├── useTasks.uts                      任务列表（合并 task_list + user_tasks）
├── useCheckin.uts                    打卡事务（doCheckin → triggerTask → reward）
├── useFocusMarker.uts                替代 uni.$emit/$once，改用路由 query 语义
└── useStats.uts                      时间线 + Array.sort 排序
│
services/
└── markers.uts                       从 utils/map-storage.uts 平移过来（保留逻辑）
```

> **改名说明**：`utils/map-storage.uts` 的所有函数迁到 `services/markers.uts`，并按职责拆为 `markerService` / `taskService` / `rewardService` / `syncQueue` 四个命名空间。原文件作为薄壳保留 30 天兼容期（仅做转发 import），过渡期结束后删除。

---

## 2. 模块拆分方案（职责契约）

### 2.1 ai-canva 模块

#### 2.1.1 组件职责

| 组件 | 输入（props） | 输出（emit） | 不做的事 |
|------|--------------|-------------|----------|
| `CanvasSurface` | `width / height / strokes` | `pointer-down/move/up` | 不维护笔画状态、不调云函数 |
| `BrushToolbar` | `color / size / canUndo / canRedo` | `change-color / change-size / undo / redo` | 不直接修改 strokes |
| `ModeSwitcher` | `mode: 'preset' \| 'custom'` | `change-mode` | 不构造 prompt |
| `PromptPanel` | `mode / styleOptions / ideaOptions / customText` | `update-prompt` | 不知道 prompt 最终怎么拼 |
| `ActionBar` | `loading / canSubmit` | `clear / submit` | 不调云函数 |
| `TaskProgress` | `status / progress` | — | 无 |
| `ResultPreview` | `imageUrl` | `download / share / retry` | 不轮询 |

#### 2.1.2 Hook 职责

| Hook | 暴露 | 内部职责 |
|------|-----|---------|
| `useCanvas` | `surfaceRef, ctx, ready, exportToBase64()` | 平台分支初始化（Web 2D / App native / MP legacy）；导出 1024px 高分图 |
| `useStrokes` | `strokes, redoStack, currentStroke, addPoint(), endStroke(), undo(), redo(), clear()` | 不可变更新；不触碰 DOM |
| `usePointer` | `bind(surfaceEl), unbind()` | 触摸 / 鼠标 / Web pointer 统一为 `(x, y, pressure)` 流；自动 cleanup；删除 `__aiCanvaBound` 魔法标志 |
| `useDraft` | `restore(), saveNow(), clearDraft()` | 节流写入 storage；页面 mount 时尝试恢复 |
| `usePromptBuilder` | `buildPrompt(mode, opts) -> string` | 集中 `PRESET_TILE_PROMPT_SAFE` + 选项拼接；中文使用源码字面量（删除 `\uXXXX` 转义） |
| `useAITask` | `submit(prompt, image), status, progress, result, cancel(), reset()` | 内部维护轮询定时器、最大次数、错误重试；result 页直接复用 |

#### 2.1.3 数据流

```
┌────────────────────── index.uvue（装配） ──────────────────────┐
│                                                                │
│  useStrokes() ───┐                                             │
│                  │                                             │
│  useCanvas() ────┼──▶ <CanvasSurface :strokes="strokes"        │
│                  │                   @pointer-* />             │
│                  │                                             │
│  usePointer()  ──┘                                             │
│                                                                │
│  useDraft(strokes)         ← 自动保存                          │
│                                                                │
│  usePromptBuilder() ──▶ <PromptPanel @update-prompt="..." />   │
│                                                                │
│  useAITask() ──▶ <ActionBar @submit /> ──▶ navigateTo result   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ taskId 经路由传递
┌──────────────────────── result.uvue ──────────────────────────┐
│  useAITask(taskId) ──▶ <TaskProgress /> + <ResultPreview />   │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 map 模块

#### 2.2.1 组件职责

| 组件 | 用在哪 | 职责边界 |
|------|-------|---------|
| `MapCanvas` | index | 地图渲染、marker 点击冒泡；不查询数据 |
| `BottomSheet` | index、task-detail | 通用底部抽屉容器；接管原本 `position:absolute` 的 4 个浮层 |
| `FloatingActionButton` | index | 右下 + 按钮；唯一允许保留 `absolute` 的元素 |
| `TaskCard` | tasks、task-detail | 显示任务信息 + 状态徽章 |
| `SpotCard` | tasks | 打卡点条目 |
| `CheckinForm` | checkin | 表单 UI；提交逻辑走 `useCheckin` |
| `DebugPanel` | tasks | 同步 / 诊断 5 个菜单（仅在 `__DEV__` 编译时挂载） |
| `TimelineList` | stats | 时间线显示 |

#### 2.2.2 Hook 职责

| Hook | 暴露 | 关键约束 |
|------|-----|---------|
| `useMap` | `mapCtx, center, zoom, focus(id)` | 不维护 marker 列表 |
| `useLocation` | `position, accuracy, isLocating, start(), stop()` | `setInterval` 在 `onUnmounted` 必须 `clearInterval`（修复 P0-#4）|
| `useMarkers` | `markers, add(), update(), remove(), refresh()` | 唯一写入 markerStore 的入口；离线队列对 UI 透明 |
| `useTasks` | `tasks, refresh(), getById(id)` | 集中 `task_list + user_tasks` 合并逻辑（修复 P0-#7）|
| `useCheckin` | `submit(payload), progress, error` | 串行 `doCheckin → triggerTaskCheck → completeTask → addReward`；任一失败回滚优化 UI（修复 P1-#11） |
| `useFocusMarker` | `consumeFocusFromQuery()` | 通过路由 query `?focusId=xxx` 实现，移除 `uni.$emit/$once`（修复 P1-#9） |
| `useStats` | `timeline, totals` | 内部 `Array.sort`（修复 P2-#14） |

#### 2.2.3 数据流

```
   云函数（uniCloud）
         ▲
         │
  services/markers.uts ──▶ store/markerStore.uts ──▶ useMarkers ──▶ 各 .uvue
         │                                ▲
         │                                │
         └────── store/taskStore.uts ─── useTasks
                                          │
                          useCheckin ─── 触发 store.markers.update + store.tasks.complete + store.rewards.add

  uni.getLocation ──▶ useLocation（自带 cleanup）──▶ index.uvue
```

---

## 3. 状态管理方案

### 3.1 状态分级

| 层级 | 范围 | 实现 | 内容 |
|------|------|------|------|
| **L1 全局共享** | 跨页存活 | `store/*.uts`（reactive 单例 + 模块导出）| markerList、taskList、rewardList、syncQueue |
| **L2 页面共享** | 单页内多组件 | hook 内 `ref / reactive` | strokes、currentMode、location |
| **L3 组件局部** | 单组件 | `<script setup>` 内 ref | 输入框文本、临时 hover 态 |

### 3.2 全局 store 设计（uni-app x 兼容写法）

```
store/markerStore.uts
  ├─ state:    markers (UTSArray<Marker>) · loadedAt · isSyncing
  ├─ actions:  loadFromCloud() · upsert(m) · removeById(id) · applyOptimistic(m)
  └─ getters:  byId(id) · within(bbox) · favorited()

store/taskStore.uts
  ├─ state:    tasks · userTaskMap (taskId → progress)
  ├─ actions:  refresh() · markComplete(id) · attachReward(id, reward)
  └─ getters:  merged() · ofMarker(markerId)

store/canvasDraftStore.uts
  ├─ state:    draft (strokes + mode + prompt)
  ├─ actions:  save(partial) · restore() · clear()
  └─ derived:  hasDraft
```

> **uni-app x 不支持 Pinia**，采用「reactive 模块单例」模式：
> ```
> // store/markerStore.uts (示意)
> const _state = reactive({ markers: [] as UTSArray<Marker> })
> export const markerStore = {
>   get markers() { return _state.markers },
>   upsert(m) { /* 不可变写法 */ },
>   ...
> }
> ```

### 3.3 重复状态消除清单

| 旧位置 | 重复内容 | 新归属 |
|-------|---------|-------|
| `tasks.uvue` + `task-detail.uvue` | 合并 task_list + user_tasks | `taskStore.merged()` 唯一来源 |
| `map-storage.uts` + `map-utils.uts` | `getMarkers / saveMarkers` | `services/markers.uts` 唯一实现 |
| `map/index.uvue` + `map-utils.uts` + `coordinate.uts` | Haversine 公式 | `utils/geo.uts: haversine(a, b)` 唯一实现 |
| `ai-canva/index.uvue`（reactive 笔画 + 散落 ref） | 画布相关 state | `useStrokes` + `useDraft` 双 hook 分担 |

### 3.4 跨页传值策略

| 旧方式 | 问题 | 新方式 |
|-------|-----|-------|
| `uni.$emit('focus-marker', id)` + `uni.$once` | 隐式耦合，时序不可控 | URL query：`navigateTo('/pages/map/index?focusId=xxx')`，目的页 `useFocusMarker` 消费 |
| 直接 `getApp().globalData` | uni-app x 不推荐 | `store/*` 模块单例 |
| 依赖 storage 间接通信 | 易脏读 | store action 内统一持久化 |

---

## 4. UI 改造方案

### 4.1 页面结构（统一三段式）

所有页面采用 flex 纵向三段：

```
┌─────────────────────────┐
│  顶部（fixed/flex）      │  ← 导航栏 / 状态栏
├─────────────────────────┤
│  内容（flex:1, 滚动）    │  ← 主体
├─────────────────────────┤
│  底部（fixed/flex）      │  ← 操作栏 / tabbar
└─────────────────────────┘
```

### 4.2 布局策略

| 场景 | 旧实现 | 新实现 |
|------|-------|-------|
| `map/index.uvue` 的 `.back-btn` | `position:absolute; top:88rpx; left:32rpx;` | 顶部 flex 行 + `align-items:center` 内嵌 |
| `map/index.uvue` 的 `.map-tools` | absolute | 浮于地图层之上的 `MapToolbar` 组件，使用相对定位 + transform |
| `map/index.uvue` 的 `.bottom-sheet` | absolute + 手动 transform | `<BottomSheet>` 组件统一封装 |
| `map/index.uvue` 的 `.floating-add` | absolute | **保留** absolute（FAB 按钮是行业惯例），但加注释说明唯一性 |
| `ai-canva` 调试 div | DOM 中常驻 | 仅在 `process.env.NODE_ENV === 'development'` 渲染 |

> 量化目标：`map/index.uvue` 中 `position: absolute` 出现次数从 4 次降到 ≤ 1 次。

### 4.3 安卓真机适配要点

| 风险 | 应对 |
|------|------|
| 状态栏高度差异 | 统一使用 `var(--status-bar-height)` / `getSystemInfoSync().statusBarHeight` 计算顶部 padding |
| Canvas 在 APP 端的字体回退 | `useCanvas` 中先调 `setFontFamily('sans-serif')`，避免无字体导致空白 |
| 底部小白条 | 统一 `padding-bottom: env(safe-area-inset-bottom)` 工具类 |
| `setInterval` 在后台被挂起 | `useLocation` 在 `onHide` 暂停、`onShow` 恢复 |
| Canvas 1024px 高分导出内存峰值 | 导出前先 `await nextTick()`；导出完释放 ImageData 引用 |
| `uniCloud.callFunction` 在弱网超时 | service 层统一 30s timeout + 降级提示 |

### 4.4 视觉一致性

- 颜色 / 间距 / 圆角统一在 `uni.scss` 暴露 token：`$color-primary / $space-md / $radius-card`；
- 禁止行内 `style="..."` 字符串拼接（违反 README）；动态样式走 `:class` 切换或 CSS 变量；
- 触摸反馈：所有 tap 区 ≥ 88rpx × 88rpx；按下使用 `:active` 透明度变化。

---

## 5. 设计理由小结

| 决策 | 为什么这样拆 | 替代方案为什么不选 |
|------|-------------|-------------------|
| `useCanvas` 与 `useStrokes` 拆开 | 画布平台差异（Web/App/MP）与笔画状态是两套关注点；result 页只需 useCanvas 子集导出 | 合并会让 result 页被迫引入笔画相关代码 |
| 不引入 Pinia | uni-app x 当前对 Pinia 支持不稳定 | 自造 store 单例零依赖、可控 |
| 保留 `services/markers.uts` 而非彻底重写 | 现有数据层 394 行质量较高（封装 + 队列 + 乐观更新都健全） | 重写风险大、对 8 个调用点影响面广 |
| 路由 query 替代事件总线 | 显式可静态分析；浏览器/页面历史天然支持 | 全局事件总线在多 tab 场景易丢消息 |
| 调试面板改组件 + 编译条件 | 既保留运维能力，又不污染生产 UI | 完全删除会失去离线场景排障能力 |
| FAB 保留 absolute | FAB 的语义就是浮动 | 改成 flex 后视觉位置不达预期 |

---

## 6. 工作量估算（仅供参考）

| 模块 | 新建文件 | 改写文件 | 删除文件 | 风险 |
|------|---------|---------|---------|------|
| ai-canva | 7 组件 + 6 hook + 1 service | index.uvue / result.uvue | — | 中（Canvas 平台分支需真机验证） |
| map | 9 组件 + 7 hook + 1 service | 6 个 .uvue | map-utils.uts、coordinate.uts | 中（事务流回归测试） |
| store / utils | 3 store + 1 geo.uts | — | — | 低 |

合计约 30 + 个新文件，6 + 个核心改写。建议按以下顺序提交：

1. `feat: 新增 utils/geo.uts、删除重复 Haversine`
2. `feat: 新增 services/markers.uts、迁移 map-storage 逻辑`
3. `feat: 新增 store/* 三个 store 单例`
4. `refactor: ai-canva 拆分组件 + hooks`
5. `refactor: map 拆分组件 + hooks`
6. `chore: 删除 map-utils.uts、coordinate.uts`

每步独立可回滚。

---

## 7. 等待确认

按 README 规范，**第二阶段不写完整代码**。以下三项请明确回复：

1. 目录结构是否认可（特别是 `hooks/` `services/` `store/` 三个新增层）？
2. 状态管理的「reactive 模块单例」方案是否可接受（vs 等官方 Pinia 适配）？
3. 是否进入 **第三阶段（代码重构）**？

进入第三阶段后将按上述提交顺序逐步交付完整代码，每步独立 commit。
