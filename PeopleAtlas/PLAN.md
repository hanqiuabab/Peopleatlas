# 原生 App 实施进度

更新：2026-08-31

## iCloud / CloudKit 同步（2026-08-31，开发环境真机已验证；生产部署待完成）

- [x] 正式 SwiftData 存储改用用户私有 CloudKit 数据库；测试、UI fixture 和显式临时文件库继续使用 `.none`，不接触真实 iCloud 数据。
- [x] 添加 iCloud/CloudKit entitlement、容器标识配置和 iOS 远程通知后台模式；默认正式容器为 `iCloud.com.hanqiu.peopleatlas`。
- [x] 补齐 CloudKit 环境 entitlement：Debug iPhone/Mac 均为 Development，Release 均为 Production。此前只声明了容器与服务，未声明环境，真机写入无法可靠地与 Mac 指向同一数据库。
- [x] 应用收到持久化远程变更或回到前台时重新读取快照；写入前先读取最新存储，智能确认对云端新变更执行过期保护，读取失败不清空可见数据。
- [x] 设置页展示 iCloud 可用、未登录、受限、暂时不可用和无法判断状态，并明确“账户可用不等于每项上传完成”；离线本地读写不依赖此状态。
- [x] 中英文应用文案、内置/公开隐私政策、商店草稿、README、需求规则和隐私预检已改为本地优先 + Apple 私有 CloudKit 的真实说明。
- [x] 现有 Apple Development 描述文件已包含 `iCloud.com.hanqiu.peopleatlas`、CloudKit 及 Development/Production 环境；不使用 `-allowProvisioningUpdates` 的 iOS/macOS 开发签名构建均成功，最终包已核对精确 entitlement。分发描述文件仍须发布前另行更新验证。
- [x] CloudKit Dashboard 已核对容器 `iCloud.com.hanqiu.peopleatlas` 与 Development 环境；SwiftData 在首次成功连接时创建私有同步区、订阅并拉取变更。
- [ ] 发布前将 Development schema 部署到 Production，并使用 Release 分发签名复验。
- [ ] 使用至少两台登录同一 Apple 账户的真实设备验证编辑、删除、离线恢复、并发变更与重装恢复；不得以账户状态或单机编译代替跨设备同步证据。
- [x] 重新运行当前单元测试、iPhone/iPad 隐私与辅助功能回归、iOS/macOS Release 构建和最终签名 entitlement 检查；结果在本节追加，失败不得覆盖。

本轮验证（报告均位于系统用户临时目录 `PeopleAtlasQA/Results/`）：

- [x] `bash Tools/verify_privacy_claims.sh` 与 `bash Tools/verify_public_site.sh template` 均通过；中英文 strings、entitlement 和隐私清单的 plist 格式检查通过。
- [x] `macOS-unit-20260831-162705-6809.xcresult`：47/47 单元测试通过，覆盖 iCloud 账户可用性、远端导入刷新、失败保留旧数据及写入前重读快照。
- [x] 隐私页面：iPhone `iOS-privacy-20260831-160219-68446.xcresult`、iPad `iOS-privacy-20260831-160349-69026.xcresult` 均为 1/1；系统无障碍审计：iPhone `iOS-accessibility-20260831-162708-6851.xcresult`、iPad `iOS-accessibility-20260831-162546-6326.xcresult` 均为 1/1。
- [x] iPad 首次审计 `iOS-accessibility-20260831-162152-5464.xcresult` 失败：分栏导航切换尚在过渡时，iPadOS 对上一页面的被置灰文本作了对比度采样。审计改为等待 0.8 秒稳定帧，并让隐私 sheet 出现时隐藏背景 Form 的辅助功能内容；没有忽略任何已定位元素。随后最终报告通过。
- [x] 最终无签名 Release 编译：`macOS-release-20260831-162844-7685.xcresult`、`iOS-device-release-20260831-162840-7602.xcresult` 均为 succeeded、0 error、0 warning。独立开发签名包位于 `/private/tmp/PeopleAtlasSigned-mac/` 与 `/private/tmp/PeopleAtlasSigned-ios/`；`codesign --verify --deep --strict` 通过，两个包均包含私有 CloudKit entitlement，iOS 包包含 `remote-notification` 后台模式。
- [x] 同步故障修复后重新签名核对：`/private/tmp/PeopleAtlasCloudDebug-{mac,ios}/` 的两个 Debug 包均严格验签通过，且都含 `icloud-container-environment = Development`；`/private/tmp/PeopleAtlasCloudRelease-{mac,ios}/` 的两个 Release 包均含 `Production`。未安装、启动或修改任一设备的数据。
- [x] 真实跨设备冒烟：更新后的开发签名 App 已安装到连接的 iPhone，启动后本地成功写入唯一临时人物 `iCloud Sync QA A95F79`；首次 Mac 连接曾被 CloudKit 拒绝创建同步区（`CKErrorDomain 15/2000`），重启后服务端已成功完成私有区、订阅与拉取。再次启动 iPhone 后，Mac 当前 Debug App 显示 1 人物且卡片名称正是该临时记录，证明 iPhone → Mac 新增同步闭环。记录仍保留，待用户在删除前确认后清理；临时启动参数和测试代码已移除。
- [x] 清理临时入口后的最终回归：`macOS-unit-20260831-165821-13406.xcresult` 成功；`bash Tools/verify_privacy_claims.sh` 通过。开发签名的无临时入口 iPhone Debug App 已重新安装并正常启动，严格读取的 entitlements 仍为 `iCloud.com.hanqiu.peopleatlas` / `Development`。

## 夫妻关系新增补全修复（2026-08-28，已完成；并行图谱失败另列）

- [x] 新增夫妻后补齐双方直接子女的另一家长及反向关系；逐个子女保留已有父母，多配偶和身份冲突跳过，不递归孙辈。
- [x] 本次亲属修复的添加顺序、双方/性别方向、重复、长幼、冲突、关闭智能补全和原子保存回归通过；iPhone/iPad A/B/C 关键流程通过，iOS/macOS Release 构建通过。Mac 使用领域/ViewModel 测试，既有 Mac UI Runner 启动限制另行保留；iPad 整批报告包含并行图谱测试失败，不能记为全绿。

本轮验证（报告均位于系统用户临时目录 `PeopleAtlasQA/Results/`）：

- `bash Tools/test.sh unit`：首次沙箱内运行受系统测试服务限制，未计为通过；获批后 `macOS-unit-20260828-180713-27781.xcresult` 实际 40 项通过、0 失败、0 跳过。
- `bash Tools/test.sh release` 与 `bash Tools/test.sh release 'generic/platform=iOS'`：`macOS-release-20260828-180901-28558.xcresult`、`iOS-device-release-20260828-180906-28638.xcresult` 均成功；仅本地构建，未部署到正式 App、未上传。
- 新增 `bash Tools/test.sh spouse '<destination>'` 子集，运行全部单元测试和 A/B/C 真实 UI 顺序回归。
- iPhone `iOS-spouse-20260828-180809-28321.xcresult`：40 项单元测试 + 1 项 UI 回归，41 项通过、0 失败、0 跳过。已查看 `spouse-after-parent-completed` 截图：父子、夫妻、母子三张关系卡均显示正反称谓；保存夫妻后未弹确认窗口。测试使用独立 QA 标识及内存库。
- iPad `iOS-spouse-20260828-181554-29942.xcresult`：45 项中 44 通过、1 失败、0 跳过。亲属推导 11 项及 A/B/C UI 回归通过，已查看母子正反称谓截图；唯一失败为并行图谱任务新增的 `GraphAndLocalizationTests.testFamilyRelaxationKeepsClearanceAndSphereShape()`，158 条节点间距断言失败，已告知对应任务处理。本任务未修改其图谱实现或测试。构建目录已释放并通知对方，QA iPad 保持可用供其继续测试。
- Mac 本轮未重复启动已知受限的 UI Runner；Mac 依据 40 项领域/ViewModel/存储测试及 Release 构建验收本次逻辑变更，不宣称三端完整 UI 验收。上述报告分别对应各次构建时的共享工作区快照，不代表后续并行图谱修改已验收。正式应用和历史人物关系未改写。

## 原有 V1 进度

- [x] 确認 Xcode 26.6 / Swift 6.3.3 环境，iOS 26.5 模拟器可用。
- [x] 建立工程规则、业务规则和完整 V1 需求；与网站隔离。
- [x] Xcode 工程、共享 Scheme、平台配置和资源；正式 Bundle ID、团队及本地开发签名已确认，App Store 分发签名仍待后续验证。
- [x] 领域模型/验证/反向关系/智能补全/布局与单元测试。
- [x] SwiftData Repository、失败回滚、持久化重启及备份测试。
- [x] @Observable MVVM、双语 UI、卡片/网格、人物与关系 CRUD 实现；三端验收另列。
- [x] 三种图谱、布局/筛选/交互、自适应导航实现；密集图谱和完整三端体验仍需最终验收。
- [x] 设置、备份导入/导出与本地隐私说明；iPad 完整备份往返已通过。
- [ ] 三端完整可访问性、VoiceOver/键盘验收。
- [x] iOS/macOS Release 构建与全部单元测试（不代表签名归档和界面验收完成）。
- [ ] iPhone/iPad/Mac UI 流程、截图及大字/深色验收。
- [ ] 发布材料、签名和所有需求逐项审计。

## 已知外部发布条件

正式 Bundle ID 与签名团队已确认，并已完成开发签名的本地构建及 Archive。支持/隐私政策公网 URL、App Store Connect 记录、分发签名、Validate 和真机验收仍未完成；这些不能用本地开发签名 Archive 替代。

## 验证记录

首次 simctl 和 Swift 宏编译受沙箱限制；获得权限后正常工作。

- Mac Debug 编译通过。
- Mac 23 项单元测试通过，0 失败；包含真实 SwiftData 文件重新打开、保存失败回滚、损坏存储拒绝、全部关系/性别组合、智能补全、备份和筛选。
- 结果：`build/Logs/Test/Test-PeopleAtlas-2026.08.28_14-29-13-+0800.xcresult`。
- iPhone 和 Mac UI 测试尚未全部验收通过；不能据此标记跨平台验收完成。
- 隐私与商店文案草稿、签名配置示例、README 已添加；待正式资料确认。

## 减少重复权限提示（2026-08-28）

- [x] 确认原测试 Runner 位于 Documents 内，使用 ad-hoc 签名，其指定要求基于 cdhash；不应将反复构建的测试程序放在受保护的文稿目录执行。
- [x] 新增统一 `Tools/test.sh`：固定系统用户临时缓存、独立平台目录、唯一报告目录，运行工作目录也离开 Documents；源码和业务数据不移动。
- [x] 默认运行单元测试，UI 测试显式选择；禁止重置系统权限、开启完全磁盘访问或自动授权作为替代方案。
- [x] 脚本语法、各模式预演和无效参数拒绝检查通过；新目录下 Mac 单元测试 25 项通过，0 失败。
- [x] 在新目录执行一次 Mac UI 启动检查：实际运行 1 项、失败 1 项。应用进程启动但未出现窗口，等待新增人物按钮失败；尚不能确定原因与文件权限是否有关，不能宣称权限弹窗已永久消除。
- [ ] 排查 Mac 无窗口问题后再验收 UI；当前停止重复运行界面测试，避免反复触发系统提示。

本次报告位于系统用户临时目录的 `PeopleAtlasQA/Results/`：

- `macOS-unit-20260828-150519-69985.xcresult`：25 项通过。
- `macOS-smoke-20260828-150647-70434.xcresult`：1 项失败；诊断截图当时未见权限弹窗，但这不代表以后不会提示。

## 三端验收与启动检查（2026-08-28，进行中）

- [x] 启动视图使用稳定容器和显式窗口 ID；数据库加载成功后重复 `open()` 保留同一个 ViewModel，避免新窗口丢弃会话状态。新增成功复用及失败后显式重试的单元测试。
- [x] 核对旧 iPhone 报告 `build-ios/iPhone-isolated.xcresult`：26 项通过、0 失败；这是旧代码结果，不能替代当前回归。
- [x] 专用 iPad 新目录报告 `iOS-all-20260828-151355-71476.xcresult`：27 项单元测试和 3 项 UI 测试全部通过，共 30 项。已查看中文网格、星球选中及最大字体编辑截图。
- [x] 修复 iPad 最大辅助字体侧栏断词：辅助字体时使用紧凑导航。已查看 `iOS-ui-20260828-153225-75989.xcresult` 中新空态与编辑截图，导航文字完整可读，表单纵向滚动。
- [x] 新增关系编辑、关系直接删除、人物确认删除、图谱总开关/子项恢复与性别联动的 UI 测试。图谱新增无障碍容器分组以保留各节点标识；确认删除测试兼容系统重复暴露的按钮元素。
- [x] iPhone 完整回归 `iOS-all-20260828-152506-74453.xcresult`：30 通过、2 失败；修正两项定位问题后，`iOS-interactions-20260828-152944-75398.xcresult` 两项均通过。不可把首轮报告写为全绿。
- [x] iPad `iOS-ui-20260828-153225-75989.xcresult`：全部 5 项 UI 测试通过、0 跳过，包括上述新流程。
- [x] Mac `macOS-unit-20260828-152833-75247.xcresult`：27 项单元测试通过。
- [x] iOS/macOS Release 初次构建均通过：`iOS-device-release-20260828-153513-76669.xcresult`、`macOS-release-20260828-153508-76623.xcresult`；后续平台配置调整仍须重新构建。
- [ ] Mac 自动首次启动仍失败。退出旧副本、稳定窗口根视图、显式激活、隔离窗口恢复状态均未证实能解决。`macOS-smoke-20260828-152335-74157.xcresult` 的新建窗口诊断截图能看到完整 People 页面，但首次启动仍失败，不能用补开窗口判定通过。
- [ ] macOS 15 的 `defaultLaunchBehavior` 与最低 macOS 14 的 SceneBuilder 条件组合试验编译失败，已撤回该试验，未提升最低系统版本。
- Mac `NSApplicationDelegate` 请求窗口及单 `Window` 试验也未解决首次启动，均已撤回；保留原生 `WindowGroup`，不以取消多窗口规避问题。
- iOS 场景和启动屏生成设置已限定到 iPhone SDK。Mac 包已确认不再包含 `UIApplicationSceneManifest`，但 `macOS-smoke-20260828-153628-76946.xcresult` 首次启动仍失败。
- 脚本 Debug 测试应用已隔离为稳定 QA Bundle ID，Release 保留开发者配置的标识。`macOS-smoke-20260828-153837-77121.xcresult` 仍在首次启动失败，不能将原因归结为旧 App 冲突。未更改系统权限。
- 数据层初始化已前移至 App 创建阶段，窗口不再依赖加载视图的 `.task` 才能取得模型，失败仍显示显式重试界面；`macOS-smoke-20260828-154022-77294.xcresult` 仍未通过，尚未找到 Mac 首次启动原因。

## 当前可核验状态（2026-08-28 15:44）

所有以下报告位于系统用户临时目录的 `PeopleAtlasQA/Results/`。

- [x] 当前 QA 标识与初始化逻辑的 iPhone 完整回归：`iOS-all-20260828-154051-77368.xcresult`，27 项单元测试 + 5 项 UI 测试，共 32 项通过、0 失败、0 跳过。
- [x] 当前 Mac 单元测试：`macOS-unit-20260828-154230-77907.xcresult`，27 项通过。
- [x] 最终配置的 iOS Release：`iOS-device-release-20260828-154303-77993.xcresult` 构建通过。
- [x] 最终配置的 Mac Release：`macOS-release-20260828-154317-78034.xcresult` 构建通过。
- [x] 核对两个 Release App 包：正常 Bundle ID（不是 QA）、iOS 17/macOS 14 最低版本、中文/英文字符串、AppIcon 与隐私清单均存在；源码条件编译和二进制字符串检查未包含 UI 测试样本入口。未进行正式签名 Archive/上传。
- [x] 测试脚本增加 `interactions` 与 `release`，修复系统 Bash 空数组与 `set -u` 的兼容问题；Release 预演成功，generic iOS 目标不能运行测试。
- [ ] Mac 首次启动及完整 UI 验收仍未通过。下一步应做最小原生窗口复现并与普通 Release 冷启动对照，区分项目与测试启动环境问题，避免重复已无效的窗口配置试验。
- [ ] iPad 5 项 UI 已在 15:35 报告通过；最后初始化前移后，仍需补一次当前版本 iPad 回归。
- [ ] 补充智能确认与备份文件选择的端到端验证、密集图谱与全部显示模式截图、键盘/VoiceOver、最低版本和真机验证；签名与对外商店资料仍待开发者确认。

## 智能确认与数据保护验收（2026-08-28，进行中）

- [x] 智能确认页增加原始关系展示、“返回修改”并保留草稿，长幼问题明确来源/目标方向；中英文同步补齐。
- [x] 新关系请求清除过期预览和旧错误，有效备份准备清除上次读取错误；新增整批家庭关系保存失败重试、旧预览隔离及备份失败保护单元测试。
- [x] 专用 iPhone/iPad 验证多项长幼逐一选择/跳过、返回/取消不保存、确定补全不弹窗，以及实际系统备份选择器取消；最终确认页排版已在 iPad 验证，iPhone 最终排版待回归。
- [x] 当前代码重新运行单元测试与 Release 构建，最新报告见下。
- 本轮不重复启动 Mac UI Runner，不修改系统权限。正常 Finder 冷启动已验证；XCTest 启动路径仍未解决。

### Mac 普通启动与自动化启动的区分（16:30）

- [x] 使用桌面操作从 Finder 打开临时目录中的正常 Release App，人物页面完整显示。没有点击系统授权，没有写入测试人物。
- [x] 关闭全部窗口并退出，进程只读检查确认已结束，再从 Finder 打开；自动出现 `atlas-main-AppWindow-1` 人物窗口，不依赖保留的旧窗口，不需要 Command-N。截图：系统临时目录 `PeopleAtlasQA/Diagnostics/mac-coldlaunch-163052.jpeg`。
- [x] 正常 Mac 应用打开人物表单，空姓名时保存禁用，取消回到 0 人物 / 0 关系；未改动真实数据。
- [ ] XCTest 的直接启动路径仍未验收通过。以上证据证明正常 Finder 冷启动可用，不应再将其笼统记录为“Mac App 无法启动”，也不能据此宣称完整 Mac UI 回归通过。

### 备份验收记录

- iPhone `iOS-family-20260828-155452-84437.xcresult`：2 项智能补全 UI 通过，备份取消定位失败。确认页英文长标题与长姓名布局已随后调整，最终截图仍需更新。
- iPhone `iOS-backup-20260828-160458-90756.xcresult`：取消流程通过；真实导出成功，导入等待 Recents 索引失败，改为直接浏览本机文件。
- `iOS-backup-20260828-160907-94138.xcresult` 因模拟器启动服务等待而中止，不计为通过。只重启本项目 QA iPhone，不清除数据、不重置系统权限。
- iPhone `iOS-backup-20260828-161646-98241.xcresult`：2 项失败。首次文件选择器未在原等待时间内出现；另一项已选到真实 JSON 并显示替换确认，但系统弹出式确认不展示取消按钮。已延长冷文件服务等待，替换确认改用明确有取消/替换按钮的警告框，显示备份人物/关系数量，操作捕获用户实际确认的快照。
- [x] 新增“确认框关闭时清空绑定也不会丢失已确认快照”的单元测试。`macOS-unit-20260828-163059-3536.xcresult`：31 项通过，0 失败。
- iPad `iOS-all-20260828-162858-2840.xcresult`：40 项中 39 通过、1 失败、0 跳过。31 项单元测试与 8 项 UI 通过；备份往返失败在导入选择文件后仍未离开文件选择器，尚未进入替换确认。智能确认最终排版截图已查看，方向说明完整，长内容可纵向滚动。
- [x] 当前 Release 本地构建通过：`macOS-release-20260828-163509-4487.xcresult`、`iOS-device-release-20260828-163504-4465.xcresult`。不等于正式签名归档。
- [x] 双语资源只读检查：中英各 125 项，键集合一致，无缺失翻译键。
- [ ] 备份真正恢复及测试文件清理仍在验证。失败中断的专用 iPhone/iPad 模拟器中可能留有带 `PeopleAtlas-QA-` UUID 名称的测试 JSON，不含用户数据。iPad 文件定位改为 Cell 内文档缩略图，避免点在多行文件名中部，正在针对性重跑。
- `iOS-backup-20260828-164357-9268.xcresult` 在测试 Runner 启动前被模拟器 Busy / preflight checks 拒绝，不能计为测试通过；只重启专用 QA iPad、关闭闲置 QA iPhone，未清数据或修改权限，未关闭其他项目模拟器。
- [x] 双语完整键集合与非空翻译加入单元回归，`macOS-unit-20260828-164807-11539.xcresult`：32 项通过、0 失败、0 跳过。
- [x] 新增四种图谱布局的选中连线过滤、再次点击取消及 iOS 全屏进出 UI 验收，脚本支持 `graph` 子集；iPad 修复后已通过，详见后续记录。
- [x] Mac 新增测试目标仅编译通过：`macOS-build-20260828-165426-13373.xcresult`，未启动 Mac UI Runner。
- `iOS-backup-20260828-164910-11889.xcresult`：取消通过，往返测试在系统暴露为不可点击的 Image 上失败；改为基于可见缩略图坐标进行真实点击。
- [x] `iOS-backup-20260828-165334-13087.xcresult` 中真实导出、取消替换保留新增人物、确认替换恢复 8 人/9 条关系均已执行并通过相应断言，确认框和恢复截图已查看。测试最终失败在清理阶段：只读导入选择器不提供 Delete 操作。清理已改用专用模拟器的“文件”App，仅匹配本次 UUID 文件并断言它离开原目录，正在重跑；不将该报告记为全绿。
- `iOS-backup-20260828-165916-13899.xcresult` 再次通过备份业务断言，仍在“文件”应用清理时失败；其界面沿用系统中文，已限定该测试应用启动语言为英文并使用文件 Cell 的上下文菜单。当前 `iOS-all-20260828-170308-14573.xcresult` 全量回归进行中。

## 备份闭环与全屏回归（2026-08-28 17:18）

- [x] iPad `iOS-all-20260828-170308-14573.xcresult`：42 项中 41 通过、1 失败、0 跳过。全部 32 项单元测试、智能补全、人物/关系编辑删除、备份导出/取消替换/确认恢复及本次 UUID 文件清理均通过；唯一失败为全屏重复的关闭控件，未把此报告记为全绿。
- [x] 备份仅删除本次测试创建的 `PeopleAtlas-QA-DC8BF2C3.json`，不删除其他备份。旧失败运行留下的测试 JSON 仍保留在专用模拟器中，不含用户数据。
- [x] 全屏修复：普通图谱与全屏图谱显式区分控件角色，退出只使用右下角按钮；移除覆盖筛选项的顶部关闭图标，底层图谱在全屏期间隐藏其无障碍入口。仅隐藏底层不足以改变测试快照中的重复控件，`iOS-graph-20260828-171300-16336.xcresult` 为 1 通过/1 失败，已记录并继续修复。
- [x] 修复后 iPad `iOS-graph-20260828-171534-16990.xcresult`：2 项通过、0 失败、0 跳过。四种布局依次验证选中后 4 条关联线、再次点击恢复 9 条线、全屏进出保持选择，以及筛选总开关/子项恢复；等级、星球、星云全屏截图已查看，控件未覆盖筛选项。
- [x] Mac `macOS-unit-20260828-171304-16442.xcresult`：32 项单元通过；本轮未启动 Mac UI Runner。
- [x] 最新 Release 构建：`macOS-release-20260828-171754-17691.xcresult`、`iOS-device-release-20260828-171758-17788.xcresult` 均成功。正常 Bundle ID、1.0.0(1)、iOS 17/macOS 14；二进制未发现测试启动参数/样本入口。Mac 包含 arm64 与 x86_64 架构，不代表 Intel 真机验收。
- [x] iPhone `iOS-all-20260828-171750-17666.xcresult`：42 项通过、0 失败、0 跳过；包含备份实际导出、取消替换、确认恢复和本次文件清理。报告早于后续姓名边界和图谱改动，不替代当前回归。
- [x] 备份校验补充规范姓名检查：只校验去空白后的副本、却保留原始名字，会使手工备份中的大量首尾空白绕过长度限制。现在快照须已满足输入规范；表单仍正常自动去空白，异常快照拒绝导出、导入和持久化。
- [x] 新增对应单元测试，`macOS-unit-20260828-172334-18691.xcresult`：33 项通过、0 失败、0 跳过。iPhone 正在运行的全量任务早于此边界修复启动，不能将其结果当作新增测试的证据，随后另跑当前单元测试。
- [x] 包含姓名边界修复的最终 Release：`macOS-release-20260828-172458-19150.xcresult`、`iOS-device-release-20260828-172503-19174.xcresult` 均构建成功，未签名归档或上传。

## 图谱手势与节点间距（2026-08-28，进行中）

- [x] 补核上轮结果：`iOS-unit-20260828-174319-23540.xcresult` 为 iPad 33 项通过；iPhone 最新底部工具栏截图 `Diagnostics/graph-172944/CCB88BC9-851A-4289-87E3-A0080CB1391C.png` 已查看，手势提示可换行且不再与按钮重叠。
- [x] 手势状态集中到 GraphViewModel：拖拽/双指缩放相互独立，任一未结束均暂停旋转；取消/后台切换清理残留状态，保留用户手动暂停，少于两位可见人物不旋转。缩放范围统一且拒绝非法值，到达边界时禁用对应缩放按钮。
- [x] 选中/悬停姓名最后绘制，避免后绘制节点覆盖姓名；测试样本人 ID 固定，只作用于 Debug 内存库，使布局和手势截图可复现。
- [x] 家庭排序改为显式栈，避免一万人链式关系递归耗尽调用栈；星云初始点按圆盘面积均匀分布，家庭弹簧有停止距离和与密度相关的单步位移上限，空间网格分离邻近点，迭代有上限并可提前停止。
- 初次 `macOS-unit-20260828-181242-29429.xcresult` 与 `macOS-unit-20260828-182255-31283.xcresult` 均为 43 通过/1 失败；只改初始分布不足以消除高密度家庭拉近造成的拥挤。保留失败记录，不降低间距断言，补齐位移上限及收敛过程后再次验证。
- [x] `macOS-unit-20260828-183107-33217.xcresult`：当前 44 项单元全部通过、0 跳过；含并行夫妻补全修复、8/60/180 人间距与家庭靠近、球面半径、一万人排序、旋转暂停及缩放/复位。空间间距不等于球面投影绝无前后遮挡，大规模屏幕效果仍待验收。
- [x] `iOS-gestures-20260828-182526-31805.xcresult`：iPad 2 项手势测试通过、0 失败/跳过；实际双指缩放、四种布局拖拽/复位、选择暂停/取消恢复、保留手动暂停。已查看星球/星云截图；该报告早于最后的密集布局收敛修正，后续仍须当前版本回归。
- 8 月 28 日中断的 `iOS-all-20260828-183322-33469.xcresult`、`macOS-release-20260828-183513-34022.xcresult`、`iOS-device-release-20260828-183519-34044.xcresult` 后被系统清理，无法核验终态，未计为通过；8 月 31 日按当前代码重新执行，而不是依赖旧进程或文档状态。
- [x] 加强测试首先发现真实缺陷：`iOS-gestures-20260831-105056-11770.xcresult` 为 1 通过/1 失败，拖拽画布结束后同一触控序列被当作点击并误选人物。现于拖拽/缩放识别期间及结束后 0.2 秒抑制节点、关系和画布点击；普通单击及再次点击取消仍由完整回归覆盖。
- [x] 修复后 iPhone `iOS-gestures-20260831-105332-12685.xcresult` 与 iPad `iOS-gestures-20260831-105551-13397.xcresult` 均为 2 项通过、0 失败/跳过；新增逐布局断言，确保缩放、拖拽和复位均不改变手动暂停，也不误选人物。iPhone 最终星球、星云、手动暂停截图已查看，控制区无覆盖且均显示播放按钮。
- [x] 当前 Mac `macOS-unit-20260831-105036-11450.xcresult`：44 项单元测试通过、0 失败/跳过。
- [x] 当前 iPhone 完整回归 `iOS-all-20260831-105943-14298.xcresult`：57 项通过、0 失败/跳过（44 项单元 + 13 项 UI）；包含人物/关系 CRUD、夫妻及其他智能补全、备份真实往返与清理、四种图谱布局/筛选/全屏/手势、中英及大字流程。测试耗时 843.975 秒。
- [x] 当前 Mac/iOS Release 本地构建均成功：`macOS-release-20260831-105554-13429.xcresult`、`iOS-device-release-20260831-105937-14273.xcresult`。包体核对为正式占位 Bundle ID `com.peopleatlas.app`、macOS 14/iOS 17，Mac 同时包含 arm64/x86_64，两个包均包含隐私清单；未签名归档、未上传。
- iPad 当前全量 `iOS-all-20260831-111609-17746.xcresult`：57 项中 56 通过、1 项被 `signal term` 终止、0 跳过，不能记为全绿。活动树证明唯一终止项已完成真实导出、取消替换、确认恢复 8 人/9 条关系及全部业务断言，终止发生在启动系统“文件”App 后长按本次 `PeopleAtlas-QA-E50AF209.json` 测试文件的清理步骤；该文件不含用户数据，可能留在专用 QA iPad。
- [x] 只重跑 iPad 备份子集 `iOS-backup-20260831-112959-21014.xcresult`：2 项通过、0 失败/跳过，包含真实文件选择器取消、导出、取消替换、确认恢复及删除本次新 UUID 文件。已查看恢复后的浅色 iPad 圆环截图，8 人/9 条合并关系可见，布局和底部工具栏无覆盖。结合全量 56 项与针对性备份 2 项，当前 iPad 所有测试范围均有通过证据；不将原全量失败报告改写为全绿。
- Mac UI Runner 本轮未启动，系统权限未改动。当前剩余代码验收重点为 Mac 鼠标/键盘/VoiceOver、超大图谱屏幕效果和最低系统/真机。
- [x] 平面标签一致性修复：圆环/等级默认显示人物姓名和合并双向称谓，星球/星云仍只在悬停/选中时显示。首版截图显示多个共享端点的关系文字重叠，继续加入带底色的标签及屏幕空间避让，预留人物圆点/姓名区域并从多个垂直边偏移中选择重叠最少的位置。
- [x] 最终 iPhone 图谱回归 `iOS-graph-20260831-113803-23165.xcresult`：2 项通过、0 失败/跳过；已查看圆环全屏截图 `Diagnostics/graph-20260831-label-avoidance/520DB3FF-FF76-47EE-A65C-34601E6C3F85.png`，8 个人名和合并关系标签可读，未覆盖节点/姓名，星球/星云保持沉浸标签策略。
- [x] 标签避让后的最终本地 Release：`macOS-release-20260831-114011-24082.xcresult`、`iOS-device-release-20260831-114016-24110.xcresult` 均构建成功；无上传或正式签名。

## Mac 正常应用空态与全屏验收（2026-08-31）

- [x] 通过 Finder 正常打开系统临时构建目录中的 Release App，空人物与空图谱均完整显示；图谱四种排列、男女/关系总筛选和 11 个关系子筛选具有可识别的辅助功能语义。未启动 Mac UI Runner，未修改系统权限，也未写入人物或关系数据。
- [x] 桌面验收发现空图谱分支没有右下角全屏入口，现已让空态与有数据状态共用同一全屏控件。首次修复构建 `macOS-release-20260831-114354-24462.xcresult` 成功。
- [x] 首次实际进入全屏后发现按钮文案仍停留在“全屏”：进入全屏的窗口在过渡通知时不一定是 key window。已移除这一瞬时条件，让进入/退出通知可靠同步控件状态；最终构建 `macOS-release-20260831-114459-24576.xcresult` 成功。
- [x] 最终正常 Release App 桌面复验：空图谱右下角显示“全屏”；进入原生全屏后按钮变为“关闭全屏”，窗口控件隐藏；再次点击后返回普通窗口，按钮恢复“全屏”，红黄绿窗口控件恢复。全过程未出现“文稿”访问授权弹窗。
- [x] 多窗口边界修复：图谱通过零尺寸原生视图捕获其所属 `NSWindow`，全屏动作与通知只作用于该窗口，避免一个窗口进入全屏时改动其他窗口的按钮状态。`macOS-release-20260831-115146-25446.xcresult` 因受限沙箱阻止 Swift 宏插件启动而失败，不是源码失败；按项目脚本在允许的构建环境重跑 `macOS-release-20260831-115354-25801.xcresult` 成功。随后再次用正常 Release App 验证“全屏”→“关闭全屏”→“全屏”闭环并退出，无权限弹窗、无数据写入。
- 当前 Mac 正常应用启动与空图谱全屏闭环已有证据；这不等同于 Mac UI Runner、完整键盘/VoiceOver、macOS 14 最低系统或 Intel/Apple Silicon 真机验收。

## Mac 隔离数据与鼠标交互验收（2026-08-31）

- [x] 使用 `Tools/test.sh build` 生成 QA Bundle ID 的 Debug App（`macOS-build-20260831-115638-26031.xcresult`），从 Finder 正常打开，不启动 Mac UI Runner；没有权限弹窗，数据容器与正式 `com.peopleatlas.app` 隔离。
- [x] 在 QA 容器新增男性长姓名“林远·Alexander-LongName”和女性“苏晴”。人物网格显示 2 人，长姓名卡片按两行截断而不挤破卡片；人物表单、性别选择、保存按钮和卡片均具备可识别的辅助功能名称。截图：系统临时目录 `PeopleAtlasQA/Diagnostics/mac-data-20260831/people-long-name.jpeg`。
- [x] 新建关系时，男性 A / 女性 B 的类型菜单只显示父亲、丈夫、儿子、哥哥、弟弟、同事，排除了性别不可能的类型；保存“丈夫”后只显示一个合并关系卡片，并完整说明反向“妻子”。截图：`mac-data-20260831/relationship-card.jpeg`。
- [x] Mac 有数据图谱实测：圆环默认显示两个姓名和“丈夫 ↔ 妻子”；点击人物出现圆形外轮廓、只保留关联线并自动暂停，再次点击取消并恢复；点击关系线使用高亮线而无方框并暂停。截图：`person-selected.jpeg`、`relationship-selected.jpeg`。
- [x] 鼠标滚轮可以连续缩放并在上限禁用“放大”；重置恢复默认缩放且清除选择；横向拖拽改变图谱方向，结束后无误选且按原手动状态恢复。星球默认不显示姓名或关系文字，有数据原生全屏布局完整，进入后按钮切换为“关闭全屏”，退出后恢复。截图：`planet-fullscreen.jpeg`。
- [x] 桌面检查发现透明节点按钮会拥有指针命中，原先只挂在画布上的 `onContinuousHover` 可能收不到节点范围内事件；已把 hover 状态同时绑定到每个节点按钮。纯鼠标移动不能由当前桌面控制接口单独合成，因此本项有代码与构建证据，但仍保留一次人工鼠标悬停视觉复核，不将工具光标位置冒充 hover 事件。
- [x] 应用内切换 English 后，侧栏、设置、隐私、备份及版本文案即时改为英文，布局无截断；随后恢复“跟随系统”。截图：`english-settings.jpeg`。
- [x] 验收完成后通过应用自身流程直接删除关系（无确认），再逐个确认删除两个人物；最终 QA 容器为 0 人物 / 0 关系，语言恢复跟随系统、布局恢复圆环。截图：`qa-data-cleaned.jpeg`。正式数据容器从未打开或写入测试记录。
- [x] hover 修复后的 QA 构建 `macOS-build-20260831-120509-26246.xcresult` 成功；当前 Mac 单元 `macOS-unit-20260831-120942-26374.xcresult` 为 44 通过、0 失败/跳过；最终 `macOS-release-20260831-121000-26401.xcresult` 与 `iOS-device-release-20260831-121004-26423.xcresult` 均构建成功。

## 应用内外观切换（2026-08-31）

- [x] 设置页新增“外观 / Color scheme”选项，支持跟随系统、浅色、深色；选择通过应用偏好持久化并由根视图统一生效。星球与星云继续保持其沉浸式深色画布，不受普通页面外观选择破坏。
- [x] 中英文资源及单元断言已补齐；`macOS-unit-20260831-121433-26590.xcresult` 为 44 项通过、0 失败/跳过。
- [x] 正常 QA Mac App 中实际依次切换浅色、深色、跟随系统：设置页与浅色人物空态均正确重绘，选择值与辅助功能值一致；验收结束恢复“跟随系统”并退出 QA App，未修改系统外观。
- [x] 新增专用 iPhone UI 回归及脚本入口；`iOS-appearance-20260831-122334-27012.xcresult` 为 1 项通过、0 失败/跳过，实际依次验证跟随系统、浅色、深色并恢复跟随系统。已目检导出的浅/深色截图，卡片、文字、选择值和底栏对比度正常；文件位于系统临时目录 `PeopleAtlasQA/Diagnostics/appearance-20260831/`。
- [x] iPad 前两次专项报告 `iOS-appearance-20260831-122606-27462.xcresult`、`iOS-appearance-20260831-122706-27772.xcresult` 均在测试代码执行前被 Simulator 以 Runner Busy 拒绝，保留为环境失败。显式启动专用 QA iPad 并只移除卡住的测试 Runner 后，`iOS-appearance-20260831-122833-28308.xcresult` 为 1 项通过；浅/深色分栏设置截图已目检，导航、卡片、长隐私文案和选择值均无截断，导出到 `PeopleAtlasQA/Diagnostics/appearance-ipad-20260831/`。
- [x] 外观改动及新增 UI 回归后的最终本地 Release 构建成功：`macOS-release-20260831-122446-27379.xcresult`、`iOS-device-release-20260831-122449-27397.xcresult`；未签名归档或上传。
- 当前 Mac 已锁定，未为保存额外外观截图反复唤起系统；已有正常应用操作和测试证据。剩余人工项仍为纯鼠标 hover、完整键盘/VoiceOver、最低系统与真机验收。

## iPhone / iPad 系统辅助功能审计（2026-08-31）

- [x] 新增 `testPrimaryScreensPassAccessibilityAudit()` 与 `bash Tools/test.sh accessibility '<destination>'`，逐页审计人物、关系、图谱和设置页面的对比度、元素识别、点击区域、描述完整性、文本裁切和辅助功能 trait；收集整页全部问题后统一失败，避免只修复第一处。
- [x] 根据真实审计结果修复搜索提示裁切、统计卡片与人物卡片朗读内容、正文对比度、图谱控制按钮 44×44 点击区域及明确名称、设置页长文本与节标题可读性；紧凑宽度增加底部滚动余量，避免内容被 iOS 26 浮动标签栏遮挡。
- [x] 人物卡片和图谱控制的语义修复后，iPhone 定向回归 `iOS-spouse-20260831-130733-32940.xcresult` 为 45/45，图谱定向回归 `iOS-graph-20260831-130914-33099.xcresult` 为 2/2；随后完整 UI 回归 `iOS-ui-20260831-131031-33210.xcresult` 为 15/15，覆盖人物/关系 CRUD、智能家庭补全、备份往返、语言/大字/外观及四种图谱交互。
- [x] 最终系统审计：iPhone `iOS-accessibility-20260831-132046-33909.xcresult` 1/1、iPad `iOS-accessibility-20260831-132135-33994.xcresult` 1/1，均为 0 失败/跳过。审计保留三个精确的系统级例外：UIKit 对单词搜索提示仍上报 `UISearchBarTextField` 裁切；iOS 26 浮动标签栏阴影附近 64 pt 的无障碍对比度采样；iPadOS 26 对 Canvas/SwiftUI 上报但不提供元素、位置或截图的空映射对比度问题。可映射到具体元素的同类问题仍会导致测试失败。
- [x] 目检过失败迭代中的 iPhone/iPad 人物、图谱和设置截图，确认修复后的正文、卡片、筛选、控制区及底部留白清晰；测试构建和报告只写入系统用户临时目录，未请求“文稿”访问，也未修改正式人物数据。
- [x] 最终 Mac 单元 `macOS-unit-20260831-132329-34199.xcresult` 为 44/44；最终本地 Release `macOS-release-20260831-132345-34275.xcresult`、`iOS-device-release-20260831-132324-34174.xcresult` 均构建成功。包体核对为 `com.peopleatlas.app`、1.0.0(1)、macOS 14 / iOS 17，Mac 含 arm64+x86_64、iOS 为 arm64，两个包均包含隐私清单；未签名归档或上传。
- [ ] Mac 当前处于锁屏，系统桌面控制不能替用户解锁；仍需用户手动解锁后完成纯鼠标 hover、完整键盘焦点顺序与 VoiceOver 实际朗读。自动系统审计不能替代这三项人工验收。

## App Store 发布完成度审计（2026-08-31）

- [x] 设置页新增可离线打开的中英文隐私政策，完整说明本地 SwiftData、无开发者服务器/通讯录/分析/广告/跟踪、JSON 备份未加密、删除与导入替换语义，以及 V1 未启用 iCloud；源码注释明确公网政策 URL 仍是发布资料。
- [x] iPhone `iOS-privacy-20260831-133007-35000.xcresult`、iPad `iOS-privacy-20260831-133242-35489.xcresult` 双语流程均 1/1，截图导出到系统临时目录 `PeopleAtlasQA/Diagnostics/privacy-policy-20260831/` 并目检；正文支持滚动，标题、正文和关闭按钮无截断。
- [x] 隐私页面纳入系统审计后，iPhone `iOS-accessibility-20260831-133148-35374.xcresult`、iPad `iOS-accessibility-20260831-133503-35753.xcresult` 均 1/1。首轮 iPad `iOS-accessibility-20260831-133331-35590.xcresult` 的失败是系统审计结束后自动关闭 sheet，测试仍点击关闭按钮；适配 iPadOS 行为后通过，不把失败报告覆盖或虚报。
- [x] 当前完整 iPhone UI `iOS-ui-20260831-133604-35852.xcresult` 为 16/16；Mac 单元 `macOS-unit-20260831-132916-34609.xcresult` 为 44/44。中英文字符串、隐私清单和测试脚本格式检查通过。
- [x] 隐私政策进入正式包后的最终本地 Release：`macOS-release-20260831-134652-36852.xcresult`、`iOS-device-release-20260831-134707-36972.xcresult` 均成功；最终 Release 静态分析 `macOS-analyze-20260831-134845-37306.xcresult`、`iOS-device-analyze-20260831-134904-37362.xcresult` 均为 0 错误、0 普通警告、0 Analyzer 警告。
- [x] 核对应用图标：iOS 1024×1024、Mac 全尺寸均在 Asset Catalog，1024/512 主图无 alpha；隐私清单声明不跟踪、不收集开发者可访问的数据，只为应用偏好声明 UserDefaults 必需原因。工程为 Xcode 26.6，满足当前 Apple 对 iOS 构建使用 Xcode 16 或更新版本的上传要求。
- [x] 上方占位签名记录对应此前状态；当前本地 `Config/Signing.xcconfig` 已配置用户确认的 Team，工程有效 Release Bundle ID 已改为 `com.hanqiu.peopleatlas`。`Config/App.xcconfig` 中的 `com.peopleatlas.app` 仅保留为未提供本地签名配置时的仓库回退值。
- [x] 用户登录 Apple Developer 后已只读核对个人会员资格，并将其 Team ID 写入 git 忽略的 `Config/Signing.xcconfig`；用户随后把应用 Bundle ID 修改为 `com.hanqiu.peopleatlas`，有效 Release 构建设置已确认同时采用该标识和所选 Team。公开仓库不保存 Apple 登录凭据、证书或个人联系资料。
- [x] 经用户操作前确认，Apple Developer 已成功注册显式 App ID `People Atlas` / `com.hanqiu.peopleatlas`，Identifiers 列表已显示该记录；未启用 iCloud、推送或其他额外 capability。
- [x] 在不使用 `-allowProvisioningUpdates`、不创建新证书或描述文件的前提下，Mac 与 iOS Release 开发签名构建均成功；`codesign --verify --deep --strict` 通过，Bundle ID 为 `com.hanqiu.peopleatlas`，版本为 1.0.0(1)，Team 与本地配置一致。Mac 为 arm64+x86_64、最低 macOS 14；iOS 为 arm64、最低 iOS 17。iOS 复用本机既有通配开发描述文件。
- [x] 本地开发签名 Archive 已生成并验证：`/private/tmp/PeopleAtlasArchives-20260831/PeopleAtlas-mac.xcarchive`、`/private/tmp/PeopleAtlasArchives-20260831/PeopleAtlas-iOS.xcarchive`；两端归档内 App 的严格签名验证通过，Archive 元数据显示同一正式 Bundle ID、版本和 Team。该结果不等于 App Store 分发导出、在线 Validate 或上传。
- [ ] App Store Connect 仍需由应用所有者创建 iOS/macOS 平台记录并提供产品名称/版权主体、分类、年龄分级、隐私问卷、公开隐私政策 URL、支持 URL 与联系渠道、审核信息、发布地区及商店截图。Apple 当前要求每个平台版本分别提交，iPhone/iPad/Mac 均至少需符合规格的截图；现有测试截图只能作为界面证据，不自动当作最终营销素材。

## Mac 键盘与隐私页面补充验收（2026-08-31）

- [x] Mac 解锁后，从系统临时目录正常启动当前 QA Debug App；窗口、侧栏、人物空态和设置页均由原生辅助功能树完整暴露，没有启动 Mac UI Runner，也没有出现“文稿”访问授权弹窗。
- [x] 实际键盘验证：点击侧栏取得焦点后，方向键按“人物 → 图谱 → 关系 → 设置”顺序切换并即时更新详情；人物表单打开后姓名输入框自动取得焦点，Tab 进入备注，Escape 关闭表单且未保存“Keyboard QA”草稿。隐私政策 sheet 同样可用 Escape 关闭。
- [x] Mac 设置页实际打开最新中英文共用的本地隐私政策视图；当前中文深色截图目检通过，标题、六段政策正文和“完成”按钮无裁切，内容说明与 iPhone/iPad 一致。
- [ ] 当前 Mac 系统未开启“键盘导航所有控件”，普通 Tab 只遍历默认文本控件；未擅自更改系统偏好。按钮级全键盘焦点链仍需用户允许开启该系统设置后复核。
- [ ] 桌面控制接口的点击会在动作结束后移走工具指针，不能产生可证明的“只移动、不点击”悬停事件。星球模式已复验默认隐藏姓名、点击选中显示圆形外轮廓和姓名、再次点击清除选择；纯 hover 视觉证据仍待人工鼠标移动。
- [ ] 为上述图谱复验在独立 `com.peopleatlas.app.qa` 容器新增 `Hover QA A`、`Hover QA B` 两个人物，无关系且未写入正式容器。按图形界面安全规则，删除前须再次取得用户确认；当前保留，方便用户直接复核悬停。
- [ ] VoiceOver 开关会改变 macOS 系统辅助功能状态，尚未执行；须在操作前取得用户确认，完成后应恢复用户原状态。

## App Store 截图草稿与深色图谱修复（2026-08-31）

- [x] 新增可重复执行的 `bash Tools/test.sh store-shots '<iOS Simulator destination>'`，在隔离内存样本库中依次采集人物、关系、圆环、星球和隐私政策，中英文各 5 张；截图等待 SwiftUI 布局与颜色过渡稳定后才保存。
- [x] 首轮 iPhone 草稿暴露星球页由浅色切入深色时的过渡帧裁切；延长截图稳定等待后，筛选文字完整。随后确认正式界面仍存在根视图外观压过图谱主题的问题：深色星球的导航标题、状态栏和布局控件为黑字。现让星球/星云工作区显式采用深色环境，并在 iOS 为导航栏和标签栏指定深色配色；圆环/等级及用户外观选择不变。
- [x] 最终 iPhone 17 Pro Max 报告 `iOS-store-shots-20260831-142428-48174.xcresult`：1/1 通过，导出 10 张，全部 1320×2868、无 alpha；关键中英文星球页、人物、关系、圆环和隐私页已目检。附件及 manifest 位于系统临时目录 `PeopleAtlasQA/Diagnostics/store-shots-iphone-final-theme-20260831/`。
- [x] 最终 iPad Pro 13-inch (M5) 报告 `iOS-store-shots-20260831-142655-49104.xcresult`：1/1 通过，导出 10 张，全部 2064×2752、无 alpha；分栏人物、关系、圆环、星球和隐私 sheet 已目检。附件及 manifest 位于 `PeopleAtlasQA/Diagnostics/store-shots-ipad-final-theme-20260831/`。
- [x] 主题修复后的 Mac 单元 `macOS-unit-20260831-142947-49653.xcresult` 为 44/44；最终本地 Release `macOS-release-20260831-143035-49805.xcresult`、`iOS-device-release-20260831-143056-49858.xcresult` 均成功，未签名归档或上传。
- [x] 商店截图专用 Debug fixture 现按语言提供姓名：英文为 Ethan Lin、Claire Su 等英文样本，中文继续使用原稳定样本；普通 UI 测试不变，正式数据和 Release 路径不包含该入口。最终本地化 iPhone 报告 `iOS-store-shots-20260831-143500-50603.xcresult`、iPad 报告 `iOS-store-shots-20260831-143725-51276.xcresult` 均 1/1；人物、关系和图谱已目检，长英文姓名/关系句无裁切。附件分别在 `PeopleAtlasQA/Diagnostics/store-shots-iphone-localized-20260831/`、`store-shots-ipad-localized-20260831/`。
- [x] 本地化 fixture 后 Mac 单元 `macOS-unit-20260831-144020-51872.xcresult` 为 44/44；`macOS-release-20260831-144043-52038.xcresult`、`iOS-device-release-20260831-144114-52137.xcresult` 构建成功，确认截图入口限于 Debug。
- [x] 使用同一隔离内存 fixture 生成 Mac 16:10 中英文原始草稿：每种语言均含人物、关系、圆环、星球、设置 5 张，全部 2560×1600、无 alpha，逐张目检无过渡帧、文字裁切或鼠标指针；位于 `PeopleAtlasQA/Diagnostics/store-shots-mac-localized-20260831/` 与 `store-shots-mac-zh-20260831/`。隐私政策在 Mac 上以 sheet 呈现，无法形成 16:10 整窗画面，因此本套以设置页替代；未写入 QA 持久数据或正式数据，结束时语言恢复跟随系统。
- [ ] 上述仍是可再生成的原始商店截图草稿，不自动等同最终营销素材；最终选图、文案装饰及 App Store Connect 上传仍待应用所有者确认。

## 公开隐私与支持页面模板（2026-08-31）

- [x] 新增 `Docs/PublicSite/` 纯静态中英文首页、隐私政策和支持页，使用响应式布局及系统深浅色，不加载第三方脚本、字体、图片或分析服务；无需购买应用服务器即可部署到任意 HTTPS 静态托管服务。
- [x] 新增 `Tools/verify_public_site.sh`：`template` 模式验证文件、HTML 基本结构、四类占位符及无远程资源，当前检查通过；`ready` 模式会在开发者名称、联系邮箱、生效日期或版权年份未填写时失败。另在系统临时副本中填入非真实示例值验证 ready 成功，随后删除该临时副本，不将示例值写回仓库。
- [x] 新增并通过 `Tools/verify_privacy_claims.sh`：确认隐私清单当前为不跟踪、无收集数据类型、无跟踪域名，仅含 UserDefaults `CA92.1`；Swift 源码未出现 CloudKit、通讯录、网络、跟踪、广告或分析 API，工程无远程 Swift 包依赖。该预检不能替代正式归档包和 App Store 隐私问卷复核。
- [ ] 真实开发者名称、联系邮箱、生效日期和版权年份仍待应用所有者提供；填写后须运行 `ready` 检查、做桌面/窄屏实际浏览器视觉复核并部署到公开 HTTPS 地址。当前内置浏览器安全策略阻止本轮 localhost 渲染，不以源码检查冒充视觉验收。
