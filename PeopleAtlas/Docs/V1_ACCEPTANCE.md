# V1 验收矩阵

更新：2026-08-31。以当前源码和实际测试报告为准；“已实现”不等于所有设备已验收。完整运行记录见 `../PLAN.md`。

| 原始要求 | 实现 / 证据位置 | 当前结论 |
| --- | --- | --- |
| 独立目录及 Xcode 工程，协作/规则/需求/进度文档 | `PeopleAtlas.xcodeproj`、目录根部四份文档 | 已建立；现有 React 网站未改动 |
| SwiftUI、MVVM、Observation | `App/Views`、`App/ViewModels`，两个 `@Observable @MainActor` ViewModel | 已实现，非网页包装 |
| SwiftData 与 iCloud | `App/Data/AtlasRepository.swift`、`Config/PeopleAtlas.entitlements` | 本地优先 Repository、稳定 ID、原子保存；正式库使用私有 CloudKit，测试与临时库显式关闭；后台容器关联、Production schema 与双真机同步仍待验收 |
| iPhone / iPad 最低 iOS 17、原生 Mac | `Config/App.xcconfig`、共享 Scheme、平台构建报告 | 编译目标满足；最低版本运行、真机及 Mac 完整 UI 验收仍缺失 |
| 卡片 / 网格呈现，人物 CRUD | `PeopleView.swift`、`AtlasRulesTests`、界面编辑/删除测试 | 已实现；iPhone/iPad 常规与大字截图已有记录 |
| 11 种关系、反向关系、性别校验、编辑和删除 | `AtlasRules.swift`、`AtlasModels.swift`、规则及界面测试 | 单元覆盖所有类型/性别组合；界面验证成对编辑、直接删除和人物级联确认 |
| 智能家庭补全、未知长幼确认、取消安全 | `SmartRelationships.swift`、`RelationshipsView.swift`、智能补全测试 | 核心算法和失败重试通过；返回/取消/逐项选择、确定补全及新增夫妻后补齐直接子女 UI 已在 iPhone/iPad 验证，当前 iPhone 全量通过 |
| 图谱模式、家庭距离、筛选、旋转、缩放、全屏 | `GraphLayout.swift`、`GraphViewModel.swift`、`GraphView.swift` | 当前单元覆盖 8/60/180 人间距和一万人排序；iPhone/iPad 真实手势验证四种布局缩放、拖拽、复位与暂停。平面默认姓名/双向标签及避让已验收；Mac 正常应用已验证有数据人物/关系选择、暂停恢复、滚轮缩放、横向拖拽和星球全屏。节点按钮已补独立 hover 监听，仍需人工纯鼠标移动复核；更大规模屏幕效果仍待验收 |
| 重启恢复、数据失败保护、备份 | `AtlasRepository.swift`、`SettingsView.swift`、`RepositoryAndViewModelTests` | 真实 SwiftData 重开、失败回滚、损坏数据拒绝及导入重试单元通过；异常原始姓名被拒绝。iPhone 当前实际 JSON 往返/清理全量通过；iPad 全量唯一 signal term 发生在恢复成功后的 Files 清理，随后备份 2/2 针对性重跑通过 |
| 简体中文 / 英文、深浅色 | `App/Resources/{en,zh-Hans}.lproj`、`Localization.swift`、`RootView.swift`、`SettingsView.swift` | 已实现系统/中文/英文及跟随系统/浅色/深色选择；Mac 正常应用已验证语言、三种外观及最新中文深色隐私政策，iPhone/iPad 专项 UI 均完成浅/深/系统切换并目检截图；星球/星云现显式使用深色工作区及 iOS 系统栏配色，最终中英文商店截图已验证深色对比度；全页面组合仍需人工审核 |
| iPhone / iPad 辅助功能 | `PeopleAtlasUITests.testPrimaryScreensPassAccessibilityAudit()`、各主页面的辅助功能修复 | 系统审计覆盖人物、关系、图谱、设置及应用内隐私政策的对比度、元素识别、点击区域、描述、裁切与 trait；最终 iPhone/iPad 均 1/1 通过，完整 iPhone UI 16/16 通过。精确系统例外和报告见 `../PLAN.md`；Mac VoiceOver/键盘与纯鼠标 hover 仍待人工验证 |
| 应用内隐私政策 | `SettingsView.swift`、`Docs/PRIVACY.md`、`Tools/verify_privacy_claims.sh`、中英文资源及隐私 UI 测试 | 设置页政策已更新为本地 SwiftData + Apple 私有 CloudKit、无开发者服务器/跟踪、JSON 备份风险和删除语义；新增文案仍须重新完成 iPhone/iPad 双语与系统审计。源码预检允许 CloudKit 但继续拒绝通讯录、跟踪、广告分析 API和远程 Swift 包；公开政策 URL、开发者身份及联系渠道仍须发布前由应用所有者提供 |
| 业务注释与单元测试 | `App/Domain`、`App/Data`、`App/ViewModels`、`Tests` | 当前 44 项单元测试在 Mac 与 iPhone 全量中通过；覆盖新增夫妻补全、密集布局和手势状态，仍不用数量代替需求覆盖 |
| 可上架的代码、UI 与发布材料 | `Docs/RELEASE_CHECKLIST.md`、`Docs/PublicSite`、图标、隐私清单、双语商店草稿 | Mac 普通 Finder 冷启动、隔离数据 CRUD、长姓名卡片及有数据图谱交互已验证；iPhone/iPad/Mac 均已有符合像素规格、无 alpha 的中英原始截图草稿。公开隐私与支持静态页面模板及占位符校验已建立；尚不能宣称可直接提交：模板真实主体信息与 HTTPS 部署、完整 Mac VoiceOver/键盘、最低系统、真机、签名及最终商店资料未齐备 |
| 第一版，无历史数据迁移 | Repository 与 JSON 备份约定 | 未实现旧网站导入/迁移；备份用于本地数据保护，不声称网站数据会自动出现 |

## 后续验收顺序

1. 检查更大规模图谱；Mac 有数据鼠标交互、浅色人物空态、深色长姓名、三种外观切换和全屏已通过，纯 hover 仍需人工鼠标移动复核；当前源码的 Mac 单元 44/44、iPhone 完整 UI 16/16、iPhone/iPad 系统辅助功能审计各 1/1；此前 iPad 56/57 加备份 2/2 覆盖全部业务范围。
2. Mac 普通应用侧栏方向键、表单自动聚焦/Tab 及 Escape 取消已经通过；开启“键盘导航所有控件”后的按钮焦点链、VoiceOver 实际朗读和纯鼠标 hover 仍待用户允许或人工操作。自动化启动仍单独列为测试环境问题。
3. 分离 Mac 普通启动与测试环境问题，完成正常应用和界面自动化验收；若出现权限弹窗停止，不反复重试。
4. 真机、最低系统版本、VoiceOver/键盘；取得开发者确认的签名和公开支持/隐私资料后，填写并部署 `PublicSite/`，再做正式归档验证。

所有测试只使用隔离内存库、专用临时数据库或专用模拟器中明确创建的测试备份；不修改用户人物数据、不重置系统权限、不上传构建。
