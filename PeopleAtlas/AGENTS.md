# People Atlas · 代理协作规则

开始任务前阅读本文件、RULES.md、REQUIREMENTS.md、PLAN.md，并检查父仓库 git status。此目录为独立的原生 Apple 应用，父目录的网站技术基线不适用于此目录；不得覆盖网站代码或既有用户数据。

## 技术约定

- SwiftUI，最低 iOS/iPadOS 17、macOS 14；原生 Mac，不使用网页包装。
- MVVM：Domain 纯业务规则，Data 持久化，ViewModels 使用 Observation 的 `@Observable` 和 `@MainActor`，Views 只负责呈现与交互。
- SwiftData 第一版本地存储；显式 `.none` 关闭 CloudKit，后续另行启用 iCloud。不得伪造登录或同步成功状态。
- 用户文案中英双语，系统语言优先；动态字体、VoiceOver、深浅色和键盘操作须可用。
- 业务代码提供解释意图的注释；核心规则、数据写入、失败路径和 ViewModel 都必须有单元测试。
- 不引入第三方依赖、遥测、广告或凭据；新增依赖需说明理由。

## 验收

- 每次改动运行相关 XCTest；完成阶段运行全部测试与 iOS/macOS Release 构建。
- iPhone、iPad、Mac 均验证关键流程；不得用单个平台构建代替三端验收。
- 存储失败必须告知用户，不能删除数据库、回退空库或覆盖原数据；批量关系保存必须原子完成。
- 自动化测试统一通过 `bash Tools/test.sh`，产物/报告/工作目录放入系统用户临时目录的 `PeopleAtlasQA/`，不得再次把测试 Runner 放在“文稿”里的工程 build 目录运行。不要修改 TCC 数据库、清除权限或开启完全磁盘访问来消除提示；仍有权限提示时停止并说明具体权限。
- 本轮为 V1，无历史迁移需求；备份导入导出属于数据保护，不是迁移。
- PLAN.md 如实记录进度、验证命令、失败及未完成事项。上架签名、账户配置和审核通过不等于代码完成，不得虚报。
