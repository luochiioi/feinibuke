# 非遗文旅打卡 App

这是一个基于 uni-app x / UTS 5.07 开发的非遗文旅打卡应用，用地图打卡把非遗内容、路线游览、任务奖励、好友互动和后台管理串成完整闭环。

## 核心功能

- 地图打卡：在地图上浏览文旅点位，支持 GPS 定位、点位详情、打卡备注和云端同步。
- 非遗内容：将打卡点扩展为非遗条目，包含项目简介、历史故事、图文内容、非遗类别、传承人信息、相关条目和介绍视频。
- 非遗名录：提供全部非遗条目浏览，支持按类别筛选和按名称/传承人搜索。
- 任务与成就：围绕打卡点配置任务、奖励和成就统计，形成游览激励。
- 主题路线：支持路线列表、路线详情、完成进度和路线奖励。
- 好友与排行：支持好友关系、好友资料、通知、排行榜和用户 ID 展示。
- 个人中心：支持登录、资料编辑、头像上传、我的打卡、积分和奖励记录。
- 后台管理：uni-admin 提供点位、任务、路线、奖励、用户、打卡记录、好友、通知、审计日志和非遗内容管理。

## 技术栈

- App：uni-app x、UTS、`.uvue`
- 后台：uni-admin
- 云端：uniCloud 阿里云服务空间、云对象、数据库 schema
- 测试：Node.js `node:test`

## 主要目录

- `pages/`：App 页面，包括首页地图、打卡、非遗详情、非遗名录、任务、路线、好友、排行等。
- `stores/`：App 状态管理。
- `utils/`：云端调用、同步、深链、地图工具等客户端工具。
- `types/`：UTS 类型定义。
- `uniCloud-aliyun/`：App 使用的云函数、云对象和数据库 schema。
- `uni-admin/`：后台管理端工程。
- `docs/superpowers/plans/`：各阶段实施计划与验收记录。

## 运行说明

1. 使用 HBuilderX 5.07 或兼容版本打开项目。
2. 绑定并部署 uniCloud 阿里云服务空间。
3. 上传数据库 schema，并部署 `marker-center`、`user-center`、`admin-center`、`heritage-center`、`photo-center` 等云对象。
4. 运行 App 到 Android 真机或调试基座。
5. 运行 `uni-admin` 后台，使用管理员账号登录后维护点位、任务、路线和非遗内容。

## 验证

业务层 Node 测试可用以下方式运行：

```bash
node --test
```

如果裸跑扫到第三方插件或工具目录测试，可按项目约定排除 `uni_modules`、`code-review`、`node_modules`、`unpackage` 后运行业务测试。

## 注意事项

- `.uvue` / `.uts` 代码需要遵守项目内 `UTS_COMPILE_PITFALLS.md` 记录的 UTS 编译规则。
- `.hbuilderx/launch.json`、`uni-admin/.hbuilderx/`、本地 `.param.js` 等 HBuilderX 生成文件不应提交。
- 真机运行时如果出现 `PrePayResourceExhausted` / `FC invoke failed, resource exhausted`，通常是 uniCloud 服务空间资源、余额或套餐问题，不是本地编译错误。
