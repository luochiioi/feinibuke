'use strict';

const db = uniCloud.database();
const col         = db.collection('tourism_markers');
const colTasks    = db.collection('user_tasks');
const colRewards  = db.collection('rewards');

exports.main = async (event) => {
	const { action, data = {} } = event;

	try {
		switch (action) {

			// ══════════════════════════════════════════════════
			//  打卡点（tourism_markers）
			// ══════════════════════════════════════════════════

			case 'getAll': {
				const res = await col.orderBy('createdAt', 'asc').get();
				return { code: 0, data: res.data };
			}

			case 'count': {
				const res = await col.count();
				const total = res.total ?? res.affectedDocs ?? 0;
				return { code: 0, total };
			}

			case 'add': {
				const res = await col.add(data);
				return { code: 0, id: res.id };
			}

			case 'addBatch': {
				const { list = [] } = data;
				const ids = [];
				for (const item of list) {
					const res = await col.add(item);
					ids.push(res.id);
				}
				return { code: 0, ids };
			}

			case 'update': {
				const { _id, ...updates } = data;
				const res = await col.doc(_id).update(updates);
				return { code: 0, updated: res.updated ?? res.affectedDocs ?? 0 };
			}

			case 'upsertById': {
				const { id, ...updates } = data;
				const whereRes = await col.where({ id }).update(updates);
				const updated = whereRes.updated ?? whereRes.affectedDocs ?? 0;
				if (updated > 0) return { code: 0, updated };
				const full = { id, ...updates, createdAt: id };
				const addRes = await col.add(full);
				return { code: 0, inserted: true, newId: addRes.id };
			}

			case 'delete': {
				const { _id, id } = data;
				if (_id) {
					await col.doc(_id).remove();
					return { code: 0 };
				}
				if (id !== undefined) {
					await col.where({ id }).remove();
					return { code: 0 };
				}
				return { code: -1, msg: '缺少 _id 或 id 参数' };
			}

			case 'deleteAll': {
				const all = await col.get();
				for (const doc of all.data) {
					await col.doc(doc._id).remove();
				}
				return { code: 0, deleted: all.data.length };
			}

			// ── 诊断测试 ──────────────────────────────────────
			case 'test': {
				const testDoc = {
					id: -999,
					title: '__DIAGNOSTIC_TEST__',
					latitude: 0,
					longitude: 0,
					checked: false,
					createdAt: Date.now()
				};
				const addRes  = await col.add(testDoc);
				const readRes = await col.where({ id: -999 }).get();
				await col.where({ id: -999 }).remove();
				return {
					code:        0,
					addId:       addRes.id ?? addRes._id ?? null,
					recordFound: readRes.data.length > 0,
					record:      readRes.data[0] ?? null
				};
			}

			// ══════════════════════════════════════════════════
			//  任务进度（user_tasks）
			// ══════════════════════════════════════════════════

			/** 读取所有任务进度 */
			case 'getUserTasks': {
				const res = await colTasks.get();
				return { code: 0, data: res.data };
			}

			/** 新增或更新单条任务进度（按 taskId upsert） */
			case 'upsertUserTask': {
				const { taskId, status, completedAt } = data;
				const existing = await colTasks.where({ taskId }).get();
				if (existing.data.length > 0) {
					await colTasks.doc(existing.data[0]._id).update({ status, completedAt });
					return { code: 0, updated: true };
				}
				await colTasks.add({ taskId, status, completedAt });
				return { code: 0, inserted: true };
			}

			/** 批量覆写所有任务进度（先清空再插入） */
			case 'batchUpsertUserTasks': {
				const { tasks = [] } = data;
				// 删除旧记录
				const old = await colTasks.get();
				for (const doc of old.data) {
					await colTasks.doc(doc._id).remove();
				}
				// 插入新记录
				const ids = [];
				for (const t of tasks) {
					const res = await colTasks.add(t);
					ids.push(res.id);
				}
				return { code: 0, ids };
			}

			// ══════════════════════════════════════════════════
			//  奖励记录（rewards）
			// ══════════════════════════════════════════════════

			/** 读取所有奖励 */
			case 'getRewards': {
				const res = await colRewards.orderBy('earnedAt', 'desc').get();
				return { code: 0, data: res.data };
			}

			/** 新增一条奖励（按 taskId 检查去重） */
			case 'addReward': {
				const { taskId } = data;
				const existing = await colRewards.where({ taskId }).get();
				if (existing.data.length > 0) {
					return { code: 0, skipped: true };
				}
				const res = await colRewards.add(data);
				return { code: 0, id: res.id };
			}

			default:
				return { code: -1, msg: `未知操作: ${action}` };
		}
	} catch (e) {
		return { code: -1, msg: e.message };
	}
};
