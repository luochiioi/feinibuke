# P8 鉴权链路 / 好友请求 / 排行榜显示 / 地图状态修复(2026-05-15)

> **For agentic workers**: REQUIRED SUB-SKILL: `superpowers:executing-plans`。严格遵守 `UTS_COMPILE_PITFALLS.md §41-§49` + 本轮新加的 §规则 50 / §规则 51。
>
> **本轮全部都是 P7 真机验收反馈的 bug 修复**,不引入新功能,不动云函数 collection。

**Goal**: 让 P7 加的"我的主页 + 编辑资料 + 加好友"链路在真机能稳定跑通。具体:
- 上传头像不再 NOT_LOGIN
- 退出登录/切账号不再黑屏
- 排行榜信息密度恢复正常(三个数字并列展示而非切换语义)
- 加好友拒绝幽灵 ID 并触发被请求方消息中心通知

**P7 起点 commit**: `70773e4` (`fix(app): profile.uvue 5.07 编译错三处修复`)

---

## Bug 清单与根因摘要

| ID | 用户报告 | 根因 | 影响层 |
|---|---|---|---|
| B1 | 编辑资料上传头像 → NOT_LOGIN | `user-center/index.obj.js:34` 的 `_before` 是**空函数**,从未调 `authUtil.checkAuth`,`this.auth.uid` 永远 null;但 P7 新增的 `updateProfile` 读 `this.auth.uid` 判鉴权 | server |
| B2 | 退出登录后地图不渲染;切账号登录后地图黑屏只剩按钮 | 待诊断 — 怀疑 `<checkin-map>` SDK marker layer 跨 reLaunch 状态残留,或 `useMarkerStore.markers` 模块 singleton 在切账号场景下没清空 | client |
| B3 | 排行榜副标题切换 metric 时换语义,用户期望"同时展示 3 个维度" | P7 commit `e4b5d8f` 的 `subTextFor` 把副标题做成"另一个维度"切换式,与用户语义不符 | client(UI 决策) |
| B4 | 加好友的反馈不够直观 | requestFriend 自动接受文案 `已自动成为好友` 与 `请求已发送` 在客户端 toast 太接近,用户分不清 | client(文案) |
| B5 | 不存在的用户 ID 也能创建 pending 请求,出现在"发出的请求"列表 | `marker-center/index.obj.js:490` 的 `requestFriend` 服务端**完全没验证 `targetUid` 在 `uni-id-users` 表是否存在**,任意字符串都被 `colFriendships.add()` 落库 | server |
| B6 | 被请求添加好友的一方,消息中心收不到 'friend.requested' 通知 | `requestFriend` 服务端**漏调 `emitNotification('friend.requested', ...)`**;前端 `pages/notifications/notifications.uvue:64` 已经有渲染 case,只是服务端没发 | server |

---

## Task 0: 修 user-center._before 鉴权链路(B1 → 服务端)

### 0.1 引入 authUtil 并完成 _before

**File**: `uniCloud-aliyun/cloudfunctions/user-center/index.obj.js`

Current:
```js
const db = uniCloud.database()
const uniId = require('uni-id-common')
const { buildProfileUpdate, needsUserDoc } = require('./profile-service')

// ...

module.exports = {
  _before: function() {
  },
  // ...
}
```

Target(对齐 marker-center L147-154 的"catch 不抛"模板):
```js
const db = uniCloud.database()
const uniId = require('uni-id-common')
const authUtil = require('auth-util')
const { buildProfileUpdate, needsUserDoc } = require('./profile-service')

// ...

module.exports = {
  // login/sign/checkToken 不需登录;updateProfile 自己检查 auth.uid。
  // 因此 _before 失败 catch 不抛,保留 this.auth.uid = null。
  _before: async function() {
    this.auth = { uid: null }
    try {
      this.auth.uid = await authUtil.checkAuth(this)
    } catch (e) {
      // intentional: login/sign 走未登录路径
    }
  },
  // ...
}
```

### 0.2 cloudfunction.json 加 common 引用

**File**: `uniCloud-aliyun/cloudfunctions/user-center/package.json`

确认 `dependencies` 里有 uni-id-common 之类。auth-util 是 `common/` 公共模块,uniCloud 自动 link 到引用它的云函数。如果云函数运行时报 `Cannot find module 'auth-util'`,把这个云函数推到云端时勾选"上传公共模块"。

### 0.3 单测

新增 `user-center/index.obj.test.js`(节制使用,优先扩 `profile-service.test.js` 覆盖)。
本轮其实不需要新单测 — `buildProfileUpdate` 已经覆盖了 NOT_LOGIN 之外的所有分支。
`_before` 只能在云端跑,本地 mock 价值低。

### 验收

- 客户端真机进 profile-edit 上传头像 → toast "头像已更新"(原 NOT_LOGIN 不应再现)
- 改昵称、改密码同理走通

---

## Task 1: 服务端 requestFriend 加 targetUid 存在性校验(B5 → 服务端)

**File**: `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`(`requestFriend` 方法,L490 开始)

在 L495(`不能添加自己为好友` check 之后)插入:

```js
// P8 B5:服务端兜底拦截"幽灵 ID"。不能等 colFriendships.add 默默成功后,
// 让客户端在 outgoing 列表看到一个永远不会有人响应的 pending 行。
const userExistRes = await db.collection('uni-id-users').doc(targetUid).get()
if (!userExistRes.data || userExistRes.data.length === 0) {
  return { errCode: -1, errMsg: '目标用户不存在' }
}
```

**测试**: 现有 `friendship-service.test.js` 是纯函数测试,这条逻辑发生在 `index.obj.js` 调用之前,不直接测;集成走真机验收。

### 验收

- 客户端 friends.uvue 输入不存在的 ID → toast "目标用户不存在",outgoing 列表无变化

---

## Task 2: 服务端 requestFriend 发 'friend.requested' 通知(B6 → 服务端)

**File**: `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`(`requestFriend` 方法末尾)

四个返回点都要补 `emitNotification(...)`:

| 返回点 | 行号(P7 起点参考) | 是否发通知 |
|---|---|---|
| 已是好友(L527) | L526-528 | ✗ 不发(双方已经是好友) |
| 自动接受(L513) | L509-513 | **发 'friend.accepted' 给 targetUid**(我接受了对方) |
| 已 rejected 复活为 pending(L530) | L530-531 | **发 'friend.requested' 给 targetUid** |
| 新建 fresh pending(L537) | L534-537 | **发 'friend.requested' 给 targetUid** |
| 既有 pending(L524) | L523-524 | ✗ 不发(避免刷屏) |

通知 payload 取当前 user 的 nickname/avatar(查 uni-id-users.doc(this.auth.uid)):
```js
const meRes = await db.collection('uni-id-users').doc(String(this.auth.uid))
  .field({ nickname: 1, avatar: 1 }).get()
const me = (meRes.data || [])[0] || {}
emitNotification('friend.requested', targetUid, {
  fromUserId: String(this.auth.uid),
  fromNickname: String(me.nickname || ''),
  fromAvatar: String(me.avatar || '')
})
```

`emitNotification` 已在 L862 实现,直接调即可。

### 验收

- B 用户 friends.uvue 点添加 A → A 的消息中心多一条"有新的好友请求"

---

## Task 3: 排行榜副标题改 3 维度并列(B3 → 客户端)

**File**: `pages/leaderboard/leaderboard.uvue`

`subTextFor` 现在是"切换语义",改为"展示另外 2 个维度":

Current(P7 e4b5d8f):
```ts
function subTextFor(row: LeaderboardRow): string {
  if (metric.value == 'points') return '完成 ' + row.routes.toString() + ' 条路线'
  if (metric.value == 'routes') return '打卡 ' + row.checkins.toString() + ' 次'
  return '积分 ' + row.points.toString()
}
```

Target:
```ts
function subTextFor(row: LeaderboardRow): string {
  if (metric.value == 'points') {
    return '路线 ' + row.routes.toString() + ' · 打卡 ' + row.checkins.toString()
  }
  if (metric.value == 'routes') {
    return '积分 ' + row.points.toString() + ' · 打卡 ' + row.checkins.toString()
  }
  // metric == 'checkins'
  return '积分 ' + row.points.toString() + ' · 路线 ' + row.routes.toString()
}
```

CSS 副标题字号已 22rpx,需放大到 24rpx 否则两个数字密度太挤。

### 验收

- metric=积分 时,副标题"路线 X · 打卡 Y",右侧大号是积分
- metric=路线 时,副标题"积分 Z · 打卡 Y",右侧大号是路线数
- metric=打卡 时,副标题"积分 Z · 路线 X",右侧大号是打卡数
- 每一行都同时展示 3 个维度信息

---

## Task 4: 加好友反馈文案优化(B4 → 客户端)

**File**: `pages/friends/friends.uvue`(`doAddFriend`)

收紧 toast 文案,减少措辞模糊:

| 服务端返回 | P7 文案 | P8 文案 |
|---|---|---|
| autoAccepted=true | 已自动成为好友 | 对方此前已发起请求,你们已成为好友 |
| status=accepted(L527) | 已自动成为好友 | 你们已是好友(无需重复发送) |
| status=pending fresh | 请求已发送 | 请求已发送,等待对方响应 |
| status=pending dup(L524) | 请求已发送 | 请求已发送(此前已存在记录) |
| -1 目标用户不存在(P8 新增) | 请求失败 | 目标用户不存在 |
| -1 不能加自己 | 不能添加自己 | 不能添加自己 |

文案逻辑需要前端 + 服务端协作 — 服务端 `errMsg` 传准确字符串,前端不再做 `result.autoAccepted ? A : B` 这种二选一。

### 验收

- 5 类反馈 toast 全部清晰可分辨

---

## Task 5: 排查 + 修复退出登录/切账号后地图黑屏(B2 → 客户端,最棘手)

### 现象
1. 退出登录 → reLaunch /pages/index/index → 地图不显示
2. 切换账号登录 → index 加载 → 地图黑屏,只有 chip / bell / 路线按钮 / 缩放按钮显示

### 怀疑链

1. `<checkin-map>` 组件(在 `components/CheckinMap.uvue` 内)持有的 SDK marker layer 状态跨 reLaunch 没释放
2. `stores/useMarkerStore.uts` 的 `markers` ref 是 module-level singleton,reLaunch 不会重新 import → 旧账号 markers 可能残留
3. `clearUserData()` 清了 storage 但 markers ref 没同步清空 → `loadFromStorage()` 走"storage 空 → 落 defaults"路径,但 ref 在 clearUserData 之后、loadFromStorage 之前的窗口是旧账号数据
4. `syncFromCloud` 在切账号场景下用了旧 uid 拉云端数据,可能拉到空数组覆盖 ref

### 诊断步骤(本任务的"先做这个")

在 `pages/index/index.uvue:onShow` 末尾加诊断日志(临时,排查后删):
```ts
console.log('[index/onShow] userInfo=', userState.userInfo != null ? userState.userInfo.userId : 'null')
console.log('[index/onShow] markers.length=', markers.length)
console.log('[index/onShow] markersJson=', markersJson.value.substring(0, 200))
```

`<checkin-map>` 实际接的是 markersJson,如果它非空但地图依旧黑 → 是 SDK 组件问题;
如果它是 "[]" → 是 store/storage 问题。

### 可能修复方案

**方案 A(store 清空时机)**:`user/index.uts:clearUserInfo` 里清掉 markers ref:
```ts
import { markers } from '@/stores/useMarkerStore'
// ... 在 clearUserInfo 末尾
markers.value = []
```

**方案 B(reLaunch 后强制重新 loadFromStorage)**:profile.uvue 退出登录链路从 `reLaunch /pages/index/index` 改为 `reLaunch /pages/index/index?reset=1`,index.uvue:onLoad 读 query 显式重置 store。

**方案 C(强制 sync 走 currentUid)**: 检查 `syncMarkers(currentUid)` 在切账号时的行为 — 若 null → 走 cache,若新 uid → 拉新数据。

**优先 A**,A 不行试 B,C 留作兜底。

### 验收

- 退出登录后 index 页正常显示种子 markers
- 切账号登录后 index 页显示新账号的 markers(若新账号无打卡 → 显示默认 8 个种子点的未打卡状态)
- 地图地图块本身可见(不是只有按钮浮在黑底上)

---

## Task 6: PITFALLS 加 §规则 50 + §规则 51(B1 / B5 教训)

**File**: `UTS_COMPILE_PITFALLS.md`

### §规则 50: 鉴权云对象必须在 _before 注入 this.auth.uid

要点:新增需要登录的云函数方法时,先检查同 cloudfunctions/<name>/index.obj.js 的 `_before` 是否调了 `authUtil.checkAuth(this)`。

**反模式**: `_before: function() {}`(空函数)+ 方法体读 `this.auth.uid` 判鉴权。这是 P8 B1 的根因:user-center 此前只挂 login/sign/checkToken(都不需要 token),`_before` 一直留空;P7 加 updateProfile 时没察觉。

**正解**: marker-center / admin-center / photo-center 的统一模板:
```js
_before: async function() {
  this.auth = { uid: null }
  try {
    this.auth.uid = await authUtil.checkAuth(this)
  } catch (e) {
    // catch 不抛:让"无需登录的方法"能继续跑,需要登录的方法自己判 this.auth.uid
  }
}
```

**审计**: `grep "_before:" uniCloud-aliyun/cloudfunctions/**/index.obj.js`,空体的云对象**不能**加新的需登录方法。

### §规则 51: 服务端写 friendship/任何 user-referenced 行,必须先验 user 存在

要点:`colFriendships.add({userId, friendUserId, ...})` 前必须先 `db.collection('uni-id-users').doc(friendUserId).get()` 确认目标存在,否则会落"幽灵行"。

**反模式**(P8 B5 根因):
```js
async requestFriend(data) {
  const targetUid = String(data.targetUid).trim()
  if (!targetUid) return { errCode: -1, errMsg: '缺少目标用户' }
  // 缺这步:验证 targetUid 在 uni-id-users 存在
  await colFriendships.add({ userId, friendUserId: targetUid, status: 'pending' })
}
```

任何乱输的字符串都会被 add 成功,客户端 outgoing 列表就出现一个永远不会响应的请求。

**正解**:
```js
const exists = await db.collection('uni-id-users').doc(targetUid).get()
if (!exists.data || exists.data.length === 0) {
  return { errCode: -1, errMsg: '目标用户不存在' }
}
```

**审计**: 任何 colFriendships / colNotifications / 任何 "userId 字段从 client 传来" 的 add() 调用,都需要前一步 doc(uid).get() 检查。

### 落地证据回填占位

`**落地证据**: P8 commit <hash> 在 user-center._before 落地 §规则 50;P8 commit <hash> 在 requestFriend 落地 §规则 51。`

P8 执行完后,把 placeholder 替换为实际 commit hash(参考 P7 §规则 49 的回填模式)。

---

## 接受标准(真机验收 checklist)

### A 上传头像
- [ ] 进入 profile-edit → 点头像 → 选图 → 提示"头像已更新"(无 NOT_LOGIN)
- [ ] profile 页头像立即同步
- [ ] 首页 chip 仍显示昵称(不被空头像覆盖)

### B 改昵称 / 改密码
- [ ] 改昵称 → 保存 → profile 页 + 首页 chip 立即同步
- [ ] 改密码 → 旧密码错 → toast "旧密码错误"
- [ ] 改密码 → 短密码 → 客户端 toast "新密码至少 6 位"

### C 退出登录 / 切换账号
- [ ] 退出登录后 index 页:地图块可见 / 种子 markers 显示 / chip 显示"登录"
- [ ] 切换账号登录后 index 页:地图块可见 / 新账号 markers 显示 / chip 显示新昵称
- [ ] 退出 → 重新登录同一个账号 → markers 与昵称都正确

### D 加好友
- [ ] 输入不存在 ID → toast "目标用户不存在",outgoing 列表无新行
- [ ] 输入自己 ID → toast "不能添加自己"
- [ ] 输入有效 ID → toast "请求已发送,等待对方响应"
- [ ] 对方此前已请求 → toast "对方此前已发起请求,你们已成为好友"
- [ ] 已是好友 → toast "你们已是好友(无需重复发送)"

### E 消息中心
- [ ] B 添加 A → A 的 bell 角标 +1
- [ ] A 进消息中心看到"有新的好友请求"卡片,附 B 的 nickname
- [ ] A 接受请求 → B 的消息中心多一条 friend.accepted

### F 排行榜
- [ ] 切积分/路线/打卡 metric → 每行副标题始终展示**另外两个**维度
- [ ] 切 metric 不再"换语义",右侧大号 + 副标题加起来始终是完整 3 维度

---

## 不在 P8 范围

- 真推送(uni-push 2.0): 仍延期到 P9
- 头像上传走 uniCloud.uploadFile 直传(目前复用 photo-center.upload base64 链路工作正常,延期改造)
- 排行榜分页或筛选: 50 条 hardcode 已足够
- friends.uvue 列表的 sub 文字需要包含什么(打卡 + 路线已经在了): 已确认无问题,不动

---

## Commit 切分建议

| commit | 范围 |
|---|---|
| `fix(cloud): user-center._before 接入 authUtil(B1)` | Task 0 |
| `fix(cloud): requestFriend 加 targetUid 存在性校验(B5)` | Task 1 |
| `feat(cloud): requestFriend 触发 friend.requested 通知(B6)` | Task 2 |
| `refactor(app): 排行榜副标题 3 维度并列(B3)` | Task 3 |
| `refactor(app): 加好友反馈文案细化(B4)` | Task 4 |
| `fix(app): 切账号 / 退出登录后 markers store 清空(B2)` | Task 5 |
| `docs: PITFALLS §规则 50 / §规则 51 + P8 commit hash 回填` | Task 6 |
