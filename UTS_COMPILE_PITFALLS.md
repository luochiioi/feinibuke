# UTS 开发避坑指南 — uni-app x 地图打卡项目

> **Phase 1 实战验证（12+ 轮编译修复 + 3 个运行时错误）。所有条目均触发过真实错误并已修复。**

---

## 零、黄金法则（先读！）

| # | 法则 | 理由 |
|---|------|------|
| **1** | **永远用 `UTSJSONObject` + `["prop"]` 访问 JSON 数据** | `Record` = Kotlin `Map`；`any` 无 `.prop` 访问 |
| **2** | **但原生 SDK 回调永远用 `.prop`，绝不 cast 到 UTSJSONObject** | `GetLocationSuccess`/`UniMapEvent` 等原生对象 cast 到 UTSJSONObject 会运行时 `ClassCastException` |
| **3** | **永远直接 `export const/function`** | Pinia/defineStore/compat 层全部在 UTS 中崩溃 |
| **4** | **模板中只用本地变量/函数** | 导入的 ref/fn 模板中不可用 |
| **5** | **用 Write 工具写文件** | PS `Set-Content` 截断 UTF-8 |

---

## 一、CSS 层

同之前版本（略）

## 二、UTS 语言层（核心 19 条）

同之前版本（略）

## 三、模板层（7 条）

同之前版本（略）

## 四、运行时层（新增 — 编译通过但运行崩溃）

| # | 规则 | 错误示例 | 正确写法 |
|---|------|---------|---------|
| **1** | **原生 API 回调参数是类型化对象，不是 UTSJSONObject** | `uni.onLocationChange((res: any) => applyLocation(res as UTSJSONObject))` | `uni.onLocationChange((res: any) => applyLocation(res))` 直接用 `res.latitude` |
| **2** | **`<map :markers="">` 需要原始 Marker 数组，不要 JSON 转换** | `JSON.parse(JSON.stringify(marker))` 产生 UTSJSONObject | 直接传 `markers.value`（Ref<Marker[]>） |
| **3** | **`uni.showModal` 的 `res.confirm` 需 bracket 访问** | `res.confirm`（`res` 是 `any`） | `(res as UTSJSONObject)["confirm"]` |

### 如何区分 "用 UTSJSONObject" vs "用 .prop"？

| 数据类型 | 访问方式 | 示例 |
|---------|---------|------|
| `uni.getStorageSync` 返回值 | `UTSJSONObject` + `["prop"]` | `(data as UTSJSONObject)["key"]` |
| `getCurrentPages()[].$page.options` | `UTSJSONObject` + `["prop"]` | `pg["options"]` |
| `uni.getLocation` success 回调参数 | `.prop` | `res.latitude` |
| `uni.onLocationChange` 回调参数 | `.prop` | `res.accuracy` |
| `map @regionchange` 事件对象 | `.prop` | `e.detail.centerLocation` |
| `map @markertap` 事件对象 | `.prop` | `e.detail.markerId` |
| `uni.chooseImage` success 回调 | `.prop` | `res.tempFilePaths[0]` |
| `uni.showActionSheet` success 回调 | `.prop` | `res.tapIndex` |
| `uni.showModal` success 回调 | `UTSJSONObject` + `["prop"]` | `(res as UTSJSONObject)["confirm"]` |

---

## 五、架构层

| # | 规则 |
|---|------|
| 1 | 不用任何 Store 包装器 — 直接 `export const/function` |
| 2 | 页面直接 import store exports |
| 3 | `cover-view` 必须在 `<map>` 内 |
| 4 | `defineProps`/`defineEmits` 用 option 语法 |
| 5 | Write 工具写文件 |

---

## 六、常见错误速查

| 错误 | 类型 | 解决 |
|------|------|------|
| `ClassCastException: Xxx cannot be cast to UTSJSONObject` | **运行时** | 原生回调参数用 `.prop` 访问，不要 cast 到 UTSJSONObject |
| `UTSJSONObject cannot be cast to Marker` | **运行时** | 不要 JSON.parse/stringify 转换 Marker；直接传原始数组 |
| `找不到名称 "xxx"` (模板) | 编译 | 创建本地 wrapper/alias |
| `Function invocation ... expected` | 编译 | lambda 包装 或 本地 wrapper |
| `找不到名称 "confirm"` | 编译 | `(res as UTSJSONObject)["confirm"]` |
| `找不到名称 "invoke"` | 编译 | 模板中不能调用导入函数，用本地 wrapper |
| `Condition type mismatch` | 编译 | `if (x != null)` |
| `Null cannot be a value` | 编译 | `UTSJSONObject\|null` 或 boolean flag |
| `Only safe (?.) or non-null (!!.)` | 编译 | `!!.` 或 `?.` |
