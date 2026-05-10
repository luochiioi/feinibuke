# P4：主题路线（Themed Routes）系统 P0

**起草**：2026-05-10
**前置**：P3.4 已在 commits `36012ed`..`428b7ae` 落地并真机验证；软件与后台主链路稳定。
**P5+ 不在本轮**：路线分支剧情、路线推送通知、路线照片合集、奖励兑换商城。

---

## 1. 业务定位

把产品从"打卡工具"升级到"主题旅游"。

- **task（已有）** = 原子，1 个 marker → 1 份奖励，**奖励驱动**。
- **route（P4 新增）** = 复合，N 个 marker 按主题串联 → 整体进度 + 完成奖励，**叙事/进度驱动**。

例：路线"湖湘文化之旅" 包含 marker_3 岳麓书院 + marker_5 橘子洲 + marker_7 中山大学东校区；用户全打完 → 解锁路线完成奖励 + 徽章。

## 2. 数据 Schema

### 2.1 `tourism_routes` 集合（admin 维护）

```
{ _id:           string,
  id:            number,                  // 业务主键，新建时 = Date.now()
  name:          string,                  // ≤ 30 字
  description:   string,                  // ≤ 200 字
  coverImage:    string | null,           // 可选封面 cloudURL
  markerIds:     number[],                // 有序，至少 1 项；id 必须存在于 tourism_markers.id
  reward:        string,                  // 自由文案，如 "20 积分 + 路线徽章"
  status:        'active' | 'archived',
  createdBy:     string,                  // admin uid
  createdAt:     number,                  // ms-epoch
  updatedAt:     number }
```

### 2.2 `user_routes` 集合（运行期写入）

```
{ _id:           string,
  userId:        string,                  // 完成者 uid
  routeId:       number,                  // tourism_routes.id
  completedAt:   number,                  // ms-epoch，完成最后一个 marker 时刻
  rewardClaimed: boolean }                // 第一版可恒为 false，留 P5 兑换页
```

唯一约束：`(userId, routeId)` 唯一；同一用户重复完成同一路线不重复写。

## 3. Task 拆分（5 commits 推荐）

### Task 1：纯函数 helper + admin-center CRUD + 单测

**新增文件**：
- `uniCloud-aliyun/cloudfunctions/admin-center/route-service.js`
  - `sanitizeRouteCreate(data, creatorId, now)` / `sanitizeRouteUpdate(data, now)` 白名单 + 字段长度校验
  - `validateRouteMarkerIds(markerIds, allMarkerIds)` 校验全部存在
  - `calcRouteProgress(route, userCheckedMarkerIds)` 返回 `{ total, done, ratio, doneMarkerIds, pendingMarkerIds }`
  - `isRouteCompleted(route, userCheckedMarkerIds)` boolean
- `uniCloud-aliyun/cloudfunctions/admin-center/route-service.test.js`：8-10 例覆盖 sanitize 边界、progress 计算、完成判定。

**修改文件**：
- `admin-center/index.obj.js` 新增方法：
  - `getRoutes({ offset, limit, status?, keyword? })`
  - `createRoute(data)`
  - `updateRoute({ _id, ...data })`
  - `deleteRoute({ _id })`
  - `getRouteProgressByUser({ userId, routeId })`（admin 排查用）

### Task 2：admin 路线管理页

**新增文件**：
- `uni-admin/pages/routes/index.vue`：列表 + 表单（新建/编辑/归档/删除）。markerIds 用多选下拉（选项来自 `getMarkers`），覆盖图用 `uniCloud.uploadFile` 直传 `route-covers/<adminUid>/<ts>_*.jpg`（与 photo-center 隔离命名空间）。

**修改文件**：
- `uni-admin/pages.json` 注册 `pages/routes/index`。
- `uni-admin/pages/dashboard/index.vue` "section-actions" 加"路线"入口。

### Task 3：App 路线列表页 + 详情页

**新增文件**：
- `pages/routes/routes.uvue`：拉 active 路线列表，每张卡片显示 `progress.done / progress.total` + 进度条 + 奖励文案。
- `pages/route-detail/route-detail.uvue`：marker 顺序列表，已打卡的标 ✓，未打卡显示距离当前位置 + "去这里"按钮（`requestFocus` + switchTab 回首页）。

**修改文件**：
- `pages.json` 注册两条新路由。
- `utils/cloudSync.uts` 新增 `pullActiveRoutes(): Promise<RouteWithProgress[]>` 拉路线列表 + 当前 uid 进度。
- `marker-center/index.obj.js` 新增公开方法 `getActiveRoutes()` 返回 `{ list: [{ ...route, progress }] }`，由 `marker-center` 而不是 `admin-center` 暴露——理由：App 端拉取路线属于公开读，不应进 admin 鉴权门。

### Task 4：路线完成检测 + reward 发放

**修改文件**：
- `marker-center/index.obj.js` `checkin()` 写库成功后异步：
  1. 查当前 uid 在 `checkedBy[]` 中累计的 markerIds（去重）
  2. 拉 active routes，对每条路线 `isRouteCompleted(route, doneMarkerIds)`
  3. 对所有刚刚完成（之前未完成）的路线，写 `user_routes`（用 `(userId, routeId)` 幂等）+ 在 `rewards` 集合追加奖励行
  4. 在 checkin 响应里返回 `{ ...原响应, completedRoutes: [{ id, name, reward }] }`
- `pages/checkin/checkin.uvue`：拿到 `completedRoutes` 后弹 modal 庆祝 + 跳路线详情或保留首页。
- `marker-center/repair-service.js` 配套：repairCheckin 也要走相同的"路线完成"检测，避免补传不触发奖励。

**新增 helper**：将"完成路线集合检测 + 写 user_routes/rewards"抽成 `marker-center/route-completion.js`（纯函数 + 单测），写库副作用集中在 obj.js。

### Task 5：首页入口 + my-checkins 路线 tag + 文档维护

**修改文件**：
- `pages/index/index.uvue` 底部 tool 按钮"任务"改 actionSheet：`['任务', '主题路线']`，或者顶栏 chip 的 actionSheet 多一项"主题路线"。
- `pages/my-checkins/my-checkins.uvue` 卡片下方加"属于 X 路线"小 tag（如果该 marker 在某 active 路线里）。需要 `marker-center.getMyCheckins` 返回每条 entry 关联的 routeIds（在 server 端 join 一次）。
- `UTS_COMPILE_PITFALLS.md` 加 §规则 32（如果 P4 实施过程中出新坑）。
- `uniapp_x_map_checkin_prompt.md` 加 "2026-05-XX P4 已落地" 段。

## 4. 验证策略

每个 Task 完成后必须跑（防 P3.4 那种"一气推完才发现编译错"的回头潮）：

```bash
# 测试
node --test uniCloud-aliyun/cloudfunctions/admin-center/route-service.test.js
node --test uniCloud-aliyun/cloudfunctions/marker-center/route-completion.test.js  # Task 4 之后
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --test uniCloud-aliyun/cloudfunctions/admin-center/audit-service.test.js
node --test uniCloud-aliyun/cloudfunctions/photo-center/photo-service.test.js
node --test uniCloud-aliyun/cloudfunctions/marker-center/repair-service.test.js
node --test uni-admin/pages/checkins/checkin-groups.test.js

# 语法
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/audit-service.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/route-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/repair-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/route-completion.js
node --check uniCloud-aliyun/cloudfunctions/photo-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/photo-center/photo-service.js
node --check uniCloud-aliyun/cloudfunctions/user-center/index.obj.js
```

每 Task 都跑一次，绿了再 commit。**不要等 5 个 task 全做完才统一验**。

## 5. UTS 5.07 提醒（重读 PITFALLS 后再写代码）

- **§规则 23 / §规则 29**：路线详情页若有"已打卡 marker 网格"，**不要**在外层 scroll-view 里嵌横向 scroll-view，用 flex-wrap 网格代替。
- **§规则 30**：`display` 仅 `flex|none`。`<text>` 的"块感"靠默认行为；想块状盒子用 `<view>`。
- **§规则 30 后半**：UTS 函数提升不稳，被引用的 async 函数必须先声明。新页里所有 `confirm*()` 配对的 `run*()` 都先写 run，再写 confirm。
- **§规则 16**：`onShow / onHide` 用 uni-app x 全局钩子，不要从 vue import。
- **§Phase 1.5/D / §九 法则 8**：云端响应到 App 类型边界一律 `JSON.parse<T[]>(JSON.stringify(raw))`，禁止 `as RouteWithProgress[]`。
- **§规则 14**：写库的 `userId` 必须取 `this.auth.uid`，不能信客户端传值。

## 6. 真机验收（HBuilderX 双账号）

1. 后台 → 路线管理页 → 创建一条"湖湘文化之旅" 路线（选 3 个种子 marker）。
2. App 用户 A：打卡前 2 个 marker → 路线列表卡片显示 2/3 进度条；打第 3 个 → checkin 响应返回 `completedRoutes`，弹"路线完成"庆祝 modal；`user_routes` 多一行；rewards 集合多一条。
3. 同一用户 A 删除其中一个打卡 → 路线进度回到 2/3；重新打卡同 marker → **不应**重复发奖（`(userId, routeId)` 唯一约束起作用）。
4. 用户 B 打完同一条路线 → 互不干扰，user_routes 两行。
5. 后台归档某路线 → App 路线列表不再显示该路线（`status: 'active'` 过滤）。
6. my-checkins 卡片 tag 显示该 marker 所属路线名。

## 7. 不做（明确踢出 P4 范围）

- 路线分支剧情（"完成 A → 解锁路线 B"的依赖图）—— 留 P5
- 路线推送通知 —— 留 P5（要先做 unipush 集成）
- 路线照片合集 / 旅行回忆录页 —— 留 P5
- 奖励兑换商城 —— `rewards.rewardClaimed` 留位即可
- 路线评论 / 点赞 —— 不属于本产品定位
