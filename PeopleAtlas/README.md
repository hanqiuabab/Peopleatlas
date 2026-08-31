# 关系图谱 · People Atlas

独立的原生 SwiftUI 应用，支持 iPhone、iPad 和 Mac。现有网站仍保留在上一级目录；运行本应用不需要 `npm`、Web 服务或服务器。

## 打开与运行

用 Xcode 打开 `PeopleAtlas.xcodeproj`，选择 **PeopleAtlas** scheme，选择 iPhone/iPad 模拟器或 **My Mac**，点击运行。最低系统 iOS/iPadOS 17、macOS 14；本工程使用 Xcode 16 的同步文件分组，实际验证环境为 Xcode 26.6。

真机运行时在 Signing & Capabilities 中选择自己的付费开发者团队并确认唯一 Bundle ID；也可复制 `Config/Signing.example.xcconfig` 为 `Config/Signing.xcconfig`，填写团队与 `ATLAS_BUNDLE_IDENTIFIER`。后者已被 git 忽略。不要在仓库保存证书、私钥、密码或 API Key。

## 功能

- 人物卡片、搜索、性别筛选、备注与详情。
- 11 种关系、性别约束、成对反向关系、直接删除关系。
- 智能补全直系家庭关系；未知长幼由用户选择或跳过。
- 圆环、等级、星球、星云图谱，筛选、选择、缩放、旋转与全屏。
- SwiftData 本地优先存储、私有 CloudKit 跨设备同步与 JSON 备份；读取/保存失败不覆盖原数据。
- 中文/英文，系统深浅色，VoiceOver 与动态字体。
- 设置页内置中英文隐私政策，可离线查看；正式上架仍需提供公开隐私政策与支持网址。
- `Docs/PublicSite/` 提供无需服务器程序的中英文隐私与支持静态页面模板；填写开发者名称、邮箱和生效日期后即可部署到 HTTPS 静态托管服务。

应用不提供独立账号登录；iCloud 同步使用系统 Apple 账户。数据不会从旧网站自动导入；本轮没有历史数据迁移需求。

## 架构

```text
App/
  Domain/       纯值模型、关系规则、智能补全、布局、备份格式
  Data/         SwiftData 模型与 Repository 协议/实现
  ViewModels/   @MainActor @Observable 状态与操作
  Views/        原生页面与交互
  Shared/       视觉组件、双语资源加载
  Resources/    本地化、图标、隐私清单
Tests/          领域、SwiftData、ViewModel、布局与本地化测试
UITests/        人物/关系增删改、中英文、大字体及图谱筛选界面测试
Tools/          隔离测试入口与可复现的矢量图标渲染源文件
Docs/           发布清单、隐私与商店文案草稿
```

页面不直接修改 SwiftData。业务先产生完整候选快照，Repository 验证后单次保存，成功后才发布新界面状态。失败回滚；反向关系不会只保存一半。

## 测试

在此目录执行：

```sh
bash Tools/test.sh unit
bash Tools/test.sh ui
bash Tools/test.sh all 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh backup 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh spouse 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh gestures 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh privacy 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh accessibility 'platform=iOS Simulator,name=PeopleAtlas QA iPhone'
bash Tools/test.sh store-shots 'platform=iOS Simulator,name=iPhone 17 Pro Max'
bash Tools/test.sh store-shots 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)'
bash Tools/test.sh analyze
bash Tools/test.sh analyze 'generic/platform=iOS'
bash Tools/test.sh release
bash Tools/test.sh release 'generic/platform=iOS'
bash Tools/verify_privacy_claims.sh
bash Tools/verify_public_site.sh template
```

模拟器名称以本机安装的设备为准。UI 测试用 `--uitesting` 开启隔离内存库；`--uitesting-demo` 只在此条件下添加测试样本。Release 不包含这些入口。持久化测试使用独立临时数据库。

脚本中的 Debug 测试另外使用稳定的 `com.peopleatlas.app.qa` 标识，隔离普通 App 的启动注册、窗口恢复和沙盒容器；不会迁移或覆盖普通 App 的数据。`release` 不覆盖正式标识，仅做本地构建、不上传。

### 避免测试反复申请“文稿”权限

不要使用工程目录中的 `build-*` 作为 UI 测试产物目录。本工程位于 Documents，测试 Runner 从这里加载文件可能触发 macOS“文稿”访问弹窗。

`Tools/test.sh` 将构建产物、测试结果和运行工作目录统一放到 `getconf DARWIN_USER_TEMP_DIR` 返回的系统用户临时目录下 `PeopleAtlasQA/`，不移动源码、不读取个人文稿、不更改系统权限。固定缓存可重复使用，报告不覆盖旧结果。临时目录可能被系统清理，仅放可再生成的测试产物，不存放人物数据库或备份。

默认只运行单元测试；`smoke` 只检查一次启动/编辑表单，`interactions` 聚焦关系编辑删除和图谱筛选，`graph` 验证各布局的选中/取消及 iOS 全屏，`family` 聚焦智能确认/免确认补全以及 iOS 备份文件选择器的取消流程，`spouse` 运行全部单元测试和“先添加父子，再添加妻子”自动补齐母子的界面回归，`backup` 专门在 iOS 模拟器验证系统选择器取消和真实 JSON 文件往返，`ui` / `all` 执行完整界面自动化。可先用 `bash Tools/test.sh build 'platform=macOS,arch=arm64' --dry-run` 查看命令。备份测试只导出带 UUID 的测试文件，并尝试在结束时删除这一份文件；失败中断可能留下测试文件，不影响真实人物数据。

本地 Mac 测试使用 ad-hoc 签名。若将来测试确实需要受保护数据，稳定的开发者证书签名有助于系统识别程序身份，但仍需用户首次授权。这个脚本不保证所有系统权限永不提示，也不会自动点击、删除 TCC 授权记录或要求完全磁盘访问权限。

`gestures` 仅用于 iOS 模拟器，实际执行双指缩放、四种排列的拖拽/复位，以及选择暂停和手动暂停保留；Mac 目标会明确拒绝，避免零项触控测试被误记为通过。手势逻辑的边界和重叠状态另由跨平台单元测试覆盖。

`store-shots` 在隔离内存样本库中生成中英文各 5 张原始商店截图草稿，覆盖人物、关系、圆环、星球和隐私政策；英文截图使用专用英文姓名，普通 UI 测试仍沿用其稳定 fixture。图片作为测试附件保存在对应 `.xcresult`，可用 `xcrun xcresulttool export attachments` 导出；系统用户临时目录可能被清理。该模式用于稳定复现和规格核验，不代表截图已获营销审批，也不会上传到 App Store Connect。

`verify_public_site.sh template` 检查静态支持站点模板完整且不加载远程资源；应用所有者填写公开身份、联系邮箱、生效日期与版权年份后，使用 `verify_public_site.sh ready` 确认没有残留占位符。发布说明见 `Docs/PublicSite/README.md`。

`verify_privacy_claims.sh` 对照隐私清单检查源码是否仍符合“本地优先 + Apple 私有 CloudKit 同步、无跟踪、无开发者数据收集、无通讯录/广告分析 API、无第三方 Swift 包”的当前声明。它是发布前预警，不替代对最终归档包和 App Store 隐私问卷的人工复核。

## iCloud 配置

正式数据库配置为私有 CloudKit，测试、预览和显式临时数据库仍配置 `.none`。默认容器为 `iCloud.<Bundle ID>`，当前正式标识对应 `iCloud.com.hanqiu.peopleatlas`。Debug 的 iPhone 与 Mac 都连接 Development；Release 都连接 Production，因此需要使用同一环境的两端应用进行同步测试。发布前还须在 CloudKit Dashboard 将开发环境 schema 部署到生产环境，并完成两台真实设备的离线、合并和删除测试。仅编译成功不代表后台容器或跨设备同步已经就绪。

原始要求与验收缺口逐项记录于 `Docs/V1_ACCEPTANCE.md`。正式发布前核对 `Docs/RELEASE_CHECKLIST.md`；本地编译或测试成功不能替代真机、签名及 App Store 审核。
