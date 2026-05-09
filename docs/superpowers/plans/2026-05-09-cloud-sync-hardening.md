# P3.1 Cloud Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make App, uniCloud, and uni-admin agree on check-in records, task data, user stats, and photos after default marker/task sync.

**Architecture:** Treat `tourism_markers` as the cloud source of truth for check-ins. The App pulls cloud markers, compares them with local marker state, submits only current-user repair payloads through authenticated cloud objects, then pulls cloud data again before updating UI. The admin backend remains admin-only and is used for management and diagnostics, not for ordinary user writes.

**Tech Stack:** uni-app x / UTS 5.07 for App pages and stores, uniCloud cloud objects on Aliyun, Vue3 H5 for `uni-admin`, Node.js built-in test runner for cloud helper tests.

---

## File Map

- Modify `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`: add authenticated idempotent repair endpoint and helper tests where practical.
- Modify `uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js`: keep pure helpers for marker/user stats reusable and testable.
- Modify `uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js`: add pure tests for repair payload decisions if helper logic lands here.
- Modify `utils/cloudSync.uts`: compare local checked markers against cloud `checkedBy[]`, enqueue or submit repair actions, then re-pull cloud markers.
- Modify `stores/useMarkerStore.uts`: expose safe local check-in records needed for repair without leaking arbitrary `checkedBy[]` mutation.
- Modify `stores/useTaskStore.uts`: refresh cloud task progress after check-in repair or normal check-in.
- Modify `pages/index/index.uvue`: call cloud pull/repair flow from `onShow` without blocking first render forever.
- Modify `pages/checkin/checkin.uvue`: ensure successful check-in writes enough local metadata for later repair if cloud write fails.
- Modify `uniapp_x_map_checkin_prompt.md`: record P3.1 actual completion and verification.
- Modify `UTS_COMPILE_PITFALLS.md`: record any new UTS/H5 boundary issues.

---

### Task 0: Clear Known H5 Lifecycle Import Warnings

**Files:**
- Modify: `pages/index/index.uvue`
- Modify: `pages/checkin/checkin.uvue`
- Modify: `pages/tasks/tasks.uvue`
- Modify: `pages/task-detail/task-detail.uvue`
- Modify: `pages/stats/stats.uvue`

- [ ] **Step 1: Remove lifecycle imports from `vue` in App `.uvue` pages**

Use this pattern in each App page:

```ts
import { computed, ref } from 'vue'
```

Do not import lifecycle hooks from `vue` in App `.uvue` pages:

```ts
import { computed, onHide, onShow } from 'vue'
```

Keep existing global lifecycle calls in place:

```ts
onShow((): void => {
  loadMarkers()
})

onHide((): void => {
  stopTracking()
})
```

- [ ] **Step 2: Compile in HBuilderX Web and Android**

Expected: no H5 runtime error like `does not provide an export named 'onHide'` from App pages.

- [ ] **Step 3: Commit**

```bash
git add pages/index/index.uvue pages/checkin/checkin.uvue pages/tasks/tasks.uvue pages/task-detail/task-detail.uvue pages/stats/stats.uvue
git commit -m "fix(app): use global page lifecycle hooks"
```

---

### Task 1: Add An Idempotent Cloud Repair Endpoint

**Files:**
- Modify: `uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`
- Test: `node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js`

- [ ] **Step 1: Add a repair endpoint shape before changing the App**

Add an authenticated method beside `checkin(data)`:

```js
async repairCheckin(data) {
  if (!this.auth.uid) return { errCode: -1, errMsg: '请先登录' }
  const { markerId, checkedAt, photoCloudURL, note, latitude, longitude } = data || {}
  if (markerId == null) return { errCode: -1, errMsg: '缺少打卡点 ID' }

  const markerRes = await col.where({ id: Number(markerId) }).limit(1).get()
  if (!markerRes.data.length) return { errCode: -1, errMsg: '打卡点不存在' }
  const marker = markerRes.data[0]

  const alreadyChecked = (marker.checkedBy || []).some(entry => entry.userId === this.auth.uid)
  if (alreadyChecked) {
    return { errCode: 0, errMsg: '记录已存在', data: { repaired: false, existed: true } }
  }

  const checkedEntry = {
    userId: this.auth.uid,
    checkedAt: Number(checkedAt || Date.now()),
    photoCloudURL: photoCloudURL || null,
    note: note || null,
    repaired: true
  }

  await col.doc(marker._id).update({
    checked: true,
    checkinCount: db.command.inc(1),
    checkedBy: db.command.push([checkedEntry]),
    updatedAt: Date.now()
  })

  await incrementUserStats(this.auth.uid, {
    totalCheckins: 1,
    totalPhotos: photoCloudURL ? 1 : 0
  })

  const completedTasks = await this._checkTasks(marker)
  return { errCode: 0, errMsg: '补传成功', data: { repaired: true, completedTasks } }
}
```

- [ ] **Step 2: Verify syntax**

Run:

```bash
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
```

Expected: no output and exit code 0.

- [ ] **Step 3: Manually verify idempotency in HBuilderX**

Call `repairCheckin` twice with the same logged-in user and same marker.

Expected first result:

```json
{"errCode":0,"errMsg":"补传成功","data":{"repaired":true}}
```

Expected second result:

```json
{"errCode":0,"errMsg":"记录已存在","data":{"repaired":false,"existed":true}}
```

- [ ] **Step 4: Commit**

```bash
git add uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
git commit -m "feat(cloud): repair missing checkins"
```

---

### Task 2: Detect Local Check-Ins Missing From Cloud

**Files:**
- Modify: `utils/cloudSync.uts`
- Modify: `stores/useMarkerStore.uts`
- Test: HBuilderX Android/Web compile because this is UTS.

- [ ] **Step 1: Add a focused comparison helper**

In `utils/cloudSync.uts`, add a helper that accepts typed local/cloud marker arrays and returns marker IDs needing repair for the current user:

```ts
export function findRepairableCheckins(localList: CheckinMarker[], cloudList: CheckinMarker[], uid: string): number[] {
  const ids: number[] = []
  localList.forEach((localMarker: CheckinMarker): void => {
    if (!localMarker.checked) return
    const cloudMarker = cloudList.find((item: CheckinMarker): boolean => item.id == localMarker.id)
    if (cloudMarker == null) return
    const checkedBy = cloudMarker.checkedBy
    const exists = checkedBy != null && checkedBy.some((entry: CheckinEntry): boolean => entry.userId == uid)
    if (!exists) ids.push(localMarker.id)
  })
  return ids
}
```

If `CheckinEntry` is not exported where needed, export it from `types/marker.uts` or keep the helper in the file that already imports the right type.

- [ ] **Step 2: Use real JSON construction for cloud marker arrays**

When converting cloud response data, keep the existing safe pattern:

```ts
const raw = JSON.stringify(res.data)
const cloudMarkers = JSON.parse<CheckinMarker[]>(raw)
```

Do not write:

```ts
const cloudMarkers = res.data as CheckinMarker[]
```

- [ ] **Step 3: Compile in HBuilderX**

Run Android or Web compile from HBuilderX.

Expected: no UTS compile error for callbacks, `JSON.parse<T>()`, or missing type names.

- [ ] **Step 4: Commit**

```bash
git add utils/cloudSync.uts stores/useMarkerStore.uts types/marker.uts
git commit -m "feat(sync): detect repairable local checkins"
```

---

### Task 3: Submit Repair Queue And Re-Pull Cloud State

**Files:**
- Modify: `utils/cloudSync.uts`
- Modify: `pages/index/index.uvue`
- Modify: `stores/useTaskStore.uts`

- [ ] **Step 1: Add repair queue submission**

In `utils/cloudSync.uts`, add a function that imports `marker-center` and submits repair payloads one by one:

```ts
export async function repairMissingCheckins(uid: string): Promise<void> {
  const cloudMarkers = await pullCloudMarkers()
  const localMarkers = markers.value
  const repairIds = findRepairableCheckins(localMarkers, cloudMarkers, uid)
  const markerApi = uniCloud.importObject('marker-center')

  for (let i = 0; i < repairIds.length; i++) {
    const marker = localMarkers.find((item: CheckinMarker): boolean => item.id == repairIds[i])
    if (marker == null) continue
    await markerApi.repairCheckin({
      markerId: marker.id,
      checkedAt: marker.checkedAt,
      photoCloudURL: marker.photoCloudURL,
      note: marker.note,
      latitude: marker.latitude,
      longitude: marker.longitude
    })
  }

  await syncMarkers()
}
```

The current `CheckinMarker` fields are `id`, `checkedAt`, `photoCloudURL`, `note`, `latitude`, and `longitude`, so the payload above matches the current type definition.

- [ ] **Step 2: Wire it after login-aware page show**

In `pages/index/index.uvue`, after user state is loaded and before/after `loadMarkers()`:

```ts
onShow((): void => {
  loadMarkers()
  const user = userState.userInfo.value
  if (user != null) {
    repairMissingCheckins(user.userId).then((): void => {
      loadMarkers()
      loadTasks()
    }).catch((err: any): void => {
      console.log('repairMissingCheckins failed', err)
    })
  }
})
```

The current user store is imported as `state as userState`, and `userState.userInfo` is a nullable object with `userId` and `userName`. Keep any new helper functions declared before computed values that call them.

- [ ] **Step 3: Verify on Android/Web**

Scenario:

1. Sync default points in admin.
2. Log in to App.
3. Mark one point locally checked while cloud lacks the uid record, or use an old account that has such state.
4. Enter home page.

Expected: cloud `tourism_markers.checkedBy[]` gains one current-user record and admin checkins page shows it after refresh.

- [ ] **Step 4: Commit**

```bash
git add utils/cloudSync.uts pages/index/index.uvue stores/useTaskStore.uts
git commit -m "feat(sync): repair local checkins to cloud"
```

---

### Task 4: Harden Admin Publish And Diagnostics

**Files:**
- Modify: `uni-admin/pages/dashboard/index.vue`
- Modify: `uni-admin/pages/markers/index.vue`
- Modify: `uni-admin/pages/checkins/index.vue`
- Modify: `uni-admin/pages/users/index.vue`
- Modify: `uni-admin/pages/tasks/index.vue`

- [ ] **Step 1: Keep each page’s error message actionable**

Each `catch` should show a page-level message that names the likely failed cloud object:

```js
errorText.value = e.message || '连接服务器失败，请确认 admin-center 已上传、当前账号是管理员、服务空间一致'
```

- [ ] **Step 2: Add a dashboard checklist card**

On dashboard, add a small checklist section:

```vue
<view class="section">
  <text class="section-title">联调顺序</text>
  <text class="hint">1. 上传 admin-center / marker-center / users schema</text>
  <text class="hint">2. 打卡点页同步默认点</text>
  <text class="hint">3. 任务页同步默认任务</text>
  <text class="hint">4. App 重新打卡或执行补传</text>
</view>
```

- [ ] **Step 3: Run HBuilderX H5**

Run `uni-admin` in HBuilderX, not by opening `.vue` directly.

Expected: browser route loads `/pages/dashboard/index`, no `onShow` export error, no blank timeout page.

- [ ] **Step 4: Commit**

```bash
git add uni-admin/pages
git commit -m "chore(admin): add publish diagnostics"
```

---

### Task 5: End-To-End Verification Pass

**Files:**
- Modify: `uniapp_x_map_checkin_prompt.md`
- Modify: `UTS_COMPILE_PITFALLS.md`

- [ ] **Step 1: Run local cloud helper checks**

```bash
node --test uniCloud-aliyun/cloudfunctions/admin-center/marker-service.test.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/index.obj.js
node --check uniCloud-aliyun/cloudfunctions/admin-center/marker-service.js
node --check uniCloud-aliyun/cloudfunctions/marker-center/index.obj.js
```

Expected: tests pass and checks exit 0.

- [ ] **Step 2: Run HBuilderX device verification**

Verify:

- Admin dashboard shows non-zero users after login.
- Admin marker page shows the 8 default points after sync.
- Admin task page shows 6 tasks after sync.
- App normal check-in writes `tourism_markers.checkedBy[]`.
- App repaired old local check-in writes exactly one cloud record.
- Device B can pull the record created by device A.

- [ ] **Step 3: Update docs**

Add a dated note to `uniapp_x_map_checkin_prompt.md`:

```md
**2026-05-09 P3.1 已落地**：
- 客户端可识别本地已打卡但云端缺失的当前用户记录，并通过 `marker-center.repairCheckin()` 幂等补传。
- 多端拉取顺序固定为：拉云端 → 补传差异 → 再拉云端刷新 UI。
```

Add any new UTS/HBuilderX pitfalls to `UTS_COMPILE_PITFALLS.md` under §11.

- [ ] **Step 4: Commit**

```bash
git add uniapp_x_map_checkin_prompt.md UTS_COMPILE_PITFALLS.md
git commit -m "docs: record cloud sync hardening"
```

---

## Self-Review

- Spec coverage: The plan covers cloud repair, local/cloud diffing, admin diagnostics, and e2e verification.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: The plan uses existing names from the current codebase: `CheckinMarker`, `CheckinEntry`, `marker-center`, `admin-center`, `userState.userInfo`, `checkedAt`, `photoCloudURL`, and `note`.
