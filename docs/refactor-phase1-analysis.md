# 第一阶段 · 代码分析报告

> 文档版本：v1.0 · 2026-04-23
> 适用范围：`pages/ai-canva/` + `pages/map/` + 相关 `utils/`
> 规范依据：`README重构流程.md`（三阶段流程）

---

## 一、模块结构图

```
app-dev/
├── pages/
│   ├── ai-canva/                        【AI 画布模块】
│   │   ├── index.uvue          1790 行  ⚠️ 上帝组件（UI + 逻辑 + API 全混）
│   │   └── result.uvue          455 行  ⚠️ 轮询逻辑硬编码（setInterval 3s × 40）
│   │
│   └── map/                             【地图 / 任务 / 打卡 模块】
│       ├── index.uvue           403 行  ⚠️ Options API（与 ai-canva 范式冲突）
│       ├── add-marker.uvue              ⚠️ Options API + 哨兵值 -1
│       ├── checkin.uvue                 ⚠️ 单个 submit() 编排 4 个云函数
│       ├── tasks.uvue           834 行  ⚠️ 超 800 行红线；tab + 同步菜单混合
│       ├── task-detail.uvue             ⚠️ 重复 tasks.uvue 的合并逻辑
│       └── stats.uvue                   ⚠️ O(n²) 冒泡排序
│
└── utils/
    ├── map-storage.uts          394 行  ✅ 数据层（云函数封装 + 离线队列）
    ├── map-utils.uts             60 行  ⚠️ 重复 map-storage 的 getMarkers
    ├── map-tasks.uts            112 行  ✅ 任务/奖励种子数据 + 触发器
    └── coordinate.uts            96 行  ⚠️ WGS84↔GCJ02 函数从未被调用

                    ┌──────────────────────────────┐
                    │     数据流（现状·耦合）      │
                    └──────────────────────────────┘

  ┌─ai-canva/index.uvue─┐     uniCloud.callFunction('ai-handler')
  │   1790 行上帝组件   │────▶  submitTask / queryTask / cancelTask
  │   Canvas + AI + UI  │          │
  │   ↓ navigateTo      │          ▼
  └─────────┬───────────┘     ai-canva/result.uvue（轮询）
            │
            ▼
   直接耦合 aiService  ×  没有抽象层

  ┌─map/index.uvue────┐
  │ uni.getLocation   │───▶ uni.$emit('focus-marker') ──┐
  │ setInterval 8s    │     （跨页 event bus）           │
  │ 未清理 ⚠️         │                                 ▼
  └──────┬────────────┘                         map/task-detail.uvue
         │                                      uni.$once('focus-marker')
         ▼
  map-storage.uts (数据层)      ←──┐
         ▲                          │ 重复
         │                          │
  map-utils.uts  ────── 重复 getMarkers / Haversine

  ┌─map/checkin.uvue──────────────────┐
  │ submit() 串行调用：               │
  │  1. doCheckin                     │
  │  2. triggerTaskCheck              │ ← 事务逻辑写在 UI 事件里
  │  3. completeTaskCloud             │
  │  4. addRewardCloud                │
  └───────────────────────────────────┘
```

---

## 二、逐文件职责分析

### 2.1 `pages/ai-canva/index.uvue` —— 主入口（需重点重构）

| 职责类别 | 当前位置 | 问题 |
|---------|---------|------|
| Canvas 初始化 | 行内 Web/APP/MP-WEIXIN 条件编译分支 | 3 套平台代码混写，无分层 |
| 笔画状态 | `strokes[]`、`redoStack[]`、`currentStroke` | 散落在 setup 中，无 store |
| 触摸/鼠标事件 | `handleTouchStart` 等 6 个函数 | 平台差异未抽象 |
| 草稿持久化 | `STORAGE_KEY = 'ai-canva-draft'` | 直接 uni.setStorage，散点调用 |
| Prompt 构造 | `PRESET_TILE_PROMPT_SAFE` + `styleOptions` + `ideaOptions` | 静态数据与 UI 紧耦合 |
| AI 提交 | `uniCloud.callFunction({ name: 'ai-handler' })` | 未抽象服务层 |
| Web 指针绑定 | `surfaceNode.__aiCanvaBound` | 在 DOM 上挂魔法标志 |
| 中文字符 | `\u9884\u8bbe\u6a21\u5f0f` Unicode 转义 | 编码问题的 workaround |
| 调试 UI | `canvas-debug` 元素 | 生产可见 |

**行数**：1790 → 超规范 800 行上限 **2.2 倍**。

### 2.2 `pages/ai-canva/result.uvue` —— AI 任务轮询页

- `queryTaskStatus()` 使用 `setInterval(3000)`，最大 `maxPollCount = 40`；
- 状态机（SUCCEEDED/FAILED/CANCELED）内联在 UI 组件；
- 无法被其他页面复用 → 应提取为 `useAITask()` hook。

### 2.3 `pages/map/index.uvue` —— 地图主页

- **范式冲突**：Options API（与 ai-canva 的 Composition API 不一致）；
- `calculateLiveDistance()` 内联 Haversine 公式（第 1 处重复）；
- `mounted()` 中 `setInterval(() => this.getRealLocation(), 8000)` **从未清理**（内存泄漏）；
- `onShow` 使用 `uni.$once('focus-marker', ...)` 接收跨页事件（隐式耦合）；
- UI 大量 `position: absolute`：`.back-btn` / `.map-tools` / `.floating-add` / `.bottom-sheet` ——违反 README「禁止乱用 absolute」。

### 2.4 `pages/map/tasks.uvue` —— 任务 + 打卡点双 tab

- **834 行**，超 README 800 行上限；
- 合并逻辑：`task_list` + `user_tasks` 在 `refresh()` 中合并（与 `task-detail.uvue` 重复）；
- 菜单挂载 5 个同步操作（`syncToCloud` / `doForceResync` / `checkCloudCount` / `runDiagnostic` / `showLocalData`）—— 应拆到「调试面板」独立组件。

### 2.5 `pages/map/task-detail.uvue` —— 任务详情

- `loadTask()` **重复** tasks.uvue 的 `task_list + user_tasks` 合并逻辑；
- 使用 `uni.$emit('focus-marker', ...)` 跨页触发 —— 隐式依赖无法静态分析。

### 2.6 `pages/map/add-marker.uvue` —— 添加打卡点

- Options API；
- 坐标来源切换（center / current / manual）逻辑分散；
- 使用 `mapCenterLat = -1` 作为「空值哨兵」——坐标合法值本身就可能是负数，语义歧义；
- 直接调用 `addMarkerCloud`（未走 store / hook 中间层）。

### 2.7 `pages/map/checkin.uvue` —— 打卡提交

- 常量 `CHECKIN_RADIUS = 500` 米硬编码；
- `submit()` 顺序调用 4 个云函数（事务逻辑写在 UI 事件里）：
  1. `doCheckin`
  2. `triggerTaskCheck`
  3. `completeTaskCloud`
  4. `addRewardCloud`
- `uni.compressImage` 质量固定 70。

### 2.8 `pages/map/stats.uvue` —— 统计

- **冒泡排序 O(n²)**（应直接用 `Array.sort`）；
- 自定义 `TimelineItem` 类与 UI 耦合。

### 2.9 `utils/map-storage.uts` —— 数据层（质量较好）

- `_call(action, data)` 统一封装 `uniCloud.callFunction({ name: 'markers' })`；
- `_fmt` 格式化 marker；
- `_enqueue` 离线队列（`QUEUE_KEY = 'cloud_sync_queue'`）；
- 乐观更新：临时 `_id = "" + numId`，成功后替换为云端 ObjectId；
- `isObjectId = /^[0-9a-f]{24}$/` 区分本地/云端 ID。
- **建议保留，作为新架构 `services/markerService.ts` 的基础**。

### 2.10 `utils/map-utils.uts` —— 工具（重度重复）

- **重复** `getMarkers` / `saveMarkers`（已在 map-storage.uts）；
- **重复** `calculateDistance`（Haversine 第 2 处）；
- 硬编码 8 个默认景点（故宫 / 迪士尼 / 岳麓书院 / 大三巴 / 橘子洲 / 广州塔 / 中大 / 北交大）。

### 2.11 `utils/map-tasks.uts` —— 任务种子

- 硬编码 6 个任务（task_001 ~ task_006）；
- `triggerTaskCheck(marker)` 通过 `targetMarkerId` **或** `targetTitle` 匹配（OR 语义易误判）；
- 自动创建 rewards，写 `task_list` + `user_tasks` + `rewards` 三处存储。

### 2.12 `utils/coordinate.uts` —— 坐标转换（死代码）

- `transformLat` / `transformLng` / WGS84↔GCJ02 转换（Krasovsky `AXIS = 6378245.0`）；
- **导出但从未被任何文件调用**（死代码）；
- 内含 `calculateDistanceWithAccuracy` —— Haversine 第 3 处重复。

---

## 三、必须重构的点（按优先级）

### 🔴 P0 · 阻断性问题（必须修）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **上帝组件 1790 行** | `ai-canva/index.uvue` | 超 800 行上限 2.2 倍，任何改动都有连锁风险 |
| 2 | **范式混用**（Composition vs Options API） | ai-canva vs map | hook/store 无法跨模块复用 |
| 3 | **800 行红线超标** | `map/tasks.uvue` (834) | 同上 |
| 4 | **setInterval 未清理** | `map/index.uvue` mounted | 每次 onShow 都会叠加，内存泄漏 |
| 5 | **Haversine 重复 3 处** | map/index + map-utils + coordinate | DRY 严重破坏 |
| 6 | **getMarkers / saveMarkers 重复 2 处** | map-storage + map-utils | 双写风险 |
| 7 | **task 合并逻辑重复** | tasks.uvue + task-detail.uvue | 修改时漏改一处 |

### 🟠 P1 · 结构性问题（应修）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 8 | **无集中状态层** | 全局 | 无 Pinia/composable store，状态分散 |
| 9 | **`uni.$emit`/`$once` 跨页事件** | map/index ↔ task-detail | 隐式耦合，静态分析失效 |
| 10 | **`absolute` 定位滥用** | map/index.uvue 4 处 | 违反 README flex-first 原则 |
| 11 | **事务逻辑写在 UI 事件** | checkin.uvue submit() | 无法复用、无法测试 |
| 12 | **UI 调试元素生产可见** | ai-canva canvas-debug | 用户可见调试信息 |
| 13 | **DOM 魔法标志** | `__aiCanvaBound` | 在 DOM 节点上挂自定义属性 |

### 🟡 P2 · 质量性问题（建议修）

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 14 | **O(n²) 冒泡排序** | stats.uvue | 时间线条目多时性能劣化 |
| 15 | **哨兵值 -1** | add-marker.uvue | 坐标合法值可为负，语义歧义 |
| 16 | **Unicode `\uXXXX` 转义中文** | ai-canva/index.uvue | 编码问题 workaround，可读性差 |
| 17 | **硬编码种子数据** | map-utils (8 景点) + map-tasks (6 任务) | 数据与代码耦合，应迁移到云端 DB 或 `assets/seed/` |
| 18 | **死代码** | coordinate.uts WGS84 转换 | 从未被调用 |

---

## 四、重构方向预览（留待第二阶段详细设计）

1. **统一范式**：全部切换到 Vue 3 `<script setup>` + Composition API。
2. **分层抽象**：
   - `services/` — 云函数封装（ai-handler / markers）
   - `hooks/` — `useCanvas` / `useAI` / `useMap` / `useLocation` / `useCheckin`
   - `store/` — 集中状态（marker / task / reward / draft）
   - `components/` — UI 碎片
3. **数据层合并**：`map-utils.uts` 的重复函数并入 `map-storage.uts`。
4. **Haversine 提取**：`utils/geo.ts` 统一提供 `haversineDistance` / `coordConvert`。
5. **事件总线 → 路由参数**：替换 `uni.$emit('focus-marker')` 为显式 query 参数。
6. **UI 改造**：flex 主布局，保留必要的 `absolute`（如 FAB）并加注释说明。

---

## 五、等待用户确认

本阶段输出完毕，**按 README 规范此阶段不写代码**。

请确认：

1. 以上问题清单是否符合预期？有无遗漏 / 过度敏感的点？
2. P0/P1/P2 的优先级划分是否认可？
3. 是否可以进入 **第二阶段（重构设计）**？

> 第二阶段将产出：新目录结构、模块拆分方案、状态管理方案、UI 改造方案 —— 仍然不写完整代码，仅输出设计文档。
