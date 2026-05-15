# P11 非遗内容富化与发现增强 — 设计文档（2026-05-16）

> 本文是经 brainstorming 确认的 **设计/规格**。下一步用 writing-plans 技能产出实施计划 `2026-05-XX-p11-*.md`，再 Subagent-Driven 分阶段实现。
>
> 起点 commit `0bd9171`，分支 `dev`。严格遵守 `UTS_COMPILE_PITFALLS.md §规则 41-§规则 56`。

## 目标

P10 把打卡点升级为有图文内容的非遗条目。P11 做两件事：

- **F1 非遗视频** — 后台上传视频，App 详情页用 `<video>` 播放（P10 明确延后项）。
- **F2 名录搜索** — App 名录页、后台列表页按名称 / 传承人模糊搜索。

顺带修复 P10 遗留缺口：`tourism_heritage` 没有"名称"字段，非遗条目的名字一直借住在关联的 `tourism_markers.title`，名录/详情页也不显示标题。F2"按名称搜索"逼出该缺口，本轮补上 `title` 字段。

## 已确认决策（brainstorming）

| # | 决策 | 取舍 |
|---|---|---|
| 1 | P11 范围 = F1 视频 + F2 搜索 | F3 主题路线留 P12 |
| 2 | 视频走 `uni.uploadFile` / `uniCloud.uploadFile` **直传云存储** | 绕开云函数请求体上限；`photo-center.upload` 不动 |
| 3 | 视频字段 = 单 `videoUrl` + `videoCover` | 每条目一个介绍视频，结构简单，UTS 好处理 |
| 4 | F2 搜索同时覆盖 App 名录页与后台列表页 | `list` 与 `adminList` 都加 `keyword` |
| 5 | 给 `tourism_heritage` 加 `title` 字段 | 搜索变单集合 `RegExp`；名录/详情页显示真实标题 |

## 架构

不新增集合 / 云对象。在 P10 既有结构上做增量字段与方法扩展：

- 数据层：`tourism_heritage` schema 加 3 个**可选**字段（不破坏既有 10 条文档读取）。
- 云端：`heritage-center` 的 `list` / `adminList` 加 `keyword` 过滤；`seedDefaults` 增强为给老文档补 `title`。纯逻辑进 `heritage-service.js` + node:test。
- App 端：`types/heritage.uts` / `utils/heritageCloud.uts` / 详情页 / 名录页 增量改。
- 后台：`edit.vue` 加 title + 视频上传，`list.vue` 加搜索框。

## 第 1 节 — 数据层变更

`tourism_heritage.schema.json` 新增字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string，maxLength 80 | 非遗项目名称。F2 搜索主字段；名录/详情页显示标题 |
| `videoUrl` | string | 视频云存储 URL（客户端直传产出） |
| `videoCover` | string | 视频封面图 URL（走 `photo-center.upload` base64，封面是小图） |

三字段均为可选，无 `required` 变更。

`heritage-service.js` 配套改：

- `HERITAGE_UPDATE_WHITELIST` 加 `title`、`videoUrl`、`videoCover`。
- `buildHeritageDoc`：加 `title: toStr(data.title)`、`videoUrl: toStr(data.videoUrl)`、`videoCover: toStr(data.videoCover)`。
- `buildHeritageUpdate`：白名单已含三字段，字符串字段走默认 `out[key] = data[key]` 分支即可。
- `normalizeHeritageDetail`：补齐 `title` / `videoUrl` / `videoCover`（`toStr` 兜底）。
- `DEFAULT_SEED_HERITAGE`：10 条补真实 `title`（种子对象 P10 本就带 `title`，只是 `buildHeritageDoc` 当时丢弃了）；`videoUrl` / `videoCover` 留空字符串。

**迁移点（关键）：** `seedDefaults` 幂等——已存在的种子文档会被跳过，线上现有 10 条非遗文档不会自动拿到新 `title`。因此 `seedDefaults` 增强：对已存在的种子文档，若 `title` 为空则 `update({ title })` 补写。新增写入计数 `titleBackfills` 返回。

## 第 2 节 — F2 搜索后端

`heritage-service.js` 新增纯函数 `buildHeritageQuery(filters)` 承载查询条件构造：

- 输入 `{ status, category, keyword }`，输出描述查询的普通对象（`{ status, category?, keyword? }`，已规范化、keyword trim、非法 category 丢弃）。
- 纯函数便于 node:test 覆盖；云对象侧把它的输出翻译成 `db.command` 查询。

`heritage-center/index.obj.js`：

- `list(data)`：取 `keyword`，经 `buildHeritageQuery` 规范化。有 keyword 时用 `db.command.or` 对 `title` / `inheritorName` 做大小写不敏感 `RegExp` 匹配，与 `status: 'published'`（+ 可选 `category`）`and` 组合。
- `adminList(data)`：同样加 `keyword`，匹配 `title` / `inheritorName`，不限 `status`。
- `RegExp` 用 `new db.RegExp({ regexp: kw, options: 'i' })`；keyword 为空时行为与现状完全一致。

## 第 3 节 — App 端

- `types/heritage.uts`：`HeritageDetail` 与 `HeritageListItem` 均加 `title: string`、`videoUrl: string`、`videoCover: string`。
- `utils/heritageCloud.uts`：
  - `injectHeritageDefaults` 与 `fetchHeritageList` 列表项默认值注入补 `title` / `videoUrl` / `videoCover`（§52）。
  - `fetchHeritageList` 签名加 `keyword: string` 参数，透传给 `list`。
  - 全程保持 §56 try/catch，封装函数承诺"绝不 throw"。
- `pages/heritage-detail/heritage-detail.uvue`：
  - `title` 作页面内主标题文本（类别徽章之上或并列）。
  - 视频区：`<video v-if="detail!!.videoUrl.length > 0" :src="detail!!.videoUrl" :poster="detail!!.videoCover">`。无视频的旧条目不渲染播放器。
  - `<video>` 真机兼容性是实施时第一个编译验证点。
- `pages/heritage-list/heritage-list.uvue`：
  - 顶部加搜索框，`@confirm` 触发搜索（不做实时输入搜索），keyword 存 `ref<string>('')`。
  - 切类别 tab 与搜索复用同一条 `fetchHeritageList(category, keyword, offset, limit)` 调用。
  - 列表项显示 `title`（标题）+ 类别徽章 + 简介截断。

## 第 4 节 — 后台 uni-admin

- `pages/heritage/edit.vue`：
  - 加 `title` 输入框（必填，保存前校验非空）。
  - 视频上传：选视频文件 → `uniCloud.uploadFile({ filePath, cloudPath: 'heritage-video/...' })` **直传云存储** → 取返回的 `fileID` 写入 `videoUrl`（阿里云 `fileID` 即 https 可访问地址，`<video :src>` 可直接用）。绕开 `photo-center` 云函数请求体上限。
  - 视频封面：复用现有图片 base64 上传（`photo-center.upload`，`folder: 'heritage-media'`），写入 `videoCover`。
- `pages/heritage/list.vue`：顶部加搜索框，调 `adminList({ keyword })`，回车或按钮触发。

## 错误处理

- 视频直传失败：admin 端 `try/catch`，给可见错误提示（不静默吞）。
- UTS 云封装：§56——`heritageCloud.uts` 所有云调用 try/catch，失败返回安全空值。
- `<video>` src 为空：`v-if` 守卫，不渲染空 src 播放器。
- keyword 含正则元字符：服务端构造 `RegExp` 前对 keyword 做基本转义或限制（纯函数 `buildHeritageQuery` 内处理），避免非法正则。

## 测试

- `heritage-service.test.js` 补：
  - `buildHeritageDoc` / `normalizeHeritageDetail` 含 `title` / `videoUrl` / `videoCover`。
  - `buildHeritageUpdate` 白名单保留三新字段、仍拒 `_id` / `markerId`。
  - `buildHeritageQuery`：keyword trim / 空 keyword / 非法 category 丢弃 / 正则元字符处理。
  - `DEFAULT_SEED_HERITAGE` 每条有非空 `title`。
- 云端全量 `node --test`：P10 基线 172 例，P11 预计 +6~8 例全绿。
- App / uni-admin 真机验收清单（实施计划末尾列出）。

## 合规约束（实施时强制）

- `UTS_COMPILE_PITFALLS.md §规则 41-§规则 56` 全部，改每个 `.uvue/.uts` 前 grep 自检。
- 客户端 `.uvue/.uts` 禁用 `Number()` / `switchTab` / `showModal`；emoji 不承载核心信息（§49）。
- 服务端 `.js`、uni-admin `.vue` 可用 `Number()` / 三元。
- `async` 显式 `Promise<T>`（§44）；`JSON.parse` 后判 null（§47）；跨云返回 `JSON.stringify`→`JSON.parse`。
- 视频字段为字符串，结构简单，避免 §43 联合类型坑。
- `.hbuilderx/launch.json` 不 commit。编译报错贴日志手改，不点 HBuilderX 内置 [AI修复]。

## 范围外（P11 不做）

- F3 非遗主题路线（留 P12）。
- 传承人信息补录、收藏/点赞/分享、多语言。
- 多视频（本轮单 `videoUrl`）。

## 文档维护（收尾）

- `uniapp_x_map_checkin_prompt.md` 追加 P11 章节。
- `changelog.md` 追加 P11 条目。
- 视频直传 / `<video>` 真机若踩坑，追加 `UTS_COMPILE_PITFALLS.md §规则 57+`。

## 参考

- P10 实施计划：`docs/superpowers/plans/2026-05-15-p10-heritage-content.md`
- P10 实施结果：`uniapp_x_map_checkin_prompt.md`「2026-05-16 P10」章节
- P11 提案：`docs/superpowers/plans/2026-05-16-p11-proposal.md`
- UTS 避坑：`UTS_COMPILE_PITFALLS.md §规则 41-§规则 56`
