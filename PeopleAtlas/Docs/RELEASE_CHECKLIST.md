# V1 发布验收清单

本清单区分代码完成和发布准备。未获用户授权，不登录开发者后台、创建证书、上传构建或提交审核。

## 代码与设备验证

- [ ] 所有单元测试与 iPhone/iPad/Mac UI 测试通过，结果记录到 PLAN。
- [x] iOS 与原生 macOS Release 本地构建通过；最终开发签名构建与本地 Archive 已于 2026-08-31 生成并通过严格签名校验（证据见 PLAN；尚非 App Store 分发导出或在线 Validate）。
- [ ] 中文/英文、空数据、真实编辑、大字体、深浅色与窄窗口截图检查。
- [ ] VoiceOver 实机逐项朗读、键盘导航和触控操作验收。
- [ ] 最低支持版本 iOS 17 / macOS 14 真机或相应模拟器验证（当前机器安装 iOS 26.5，不冒充完成低版本运行测试）。
- [ ] 真机离线保存、重启恢复、低存储失败、导出/导入和删除流程。
- [x] 现有开发描述文件和本地开发签名包已核对包含 `iCloud.com.hanqiu.peopleatlas` / CloudKit；分发描述文件仍须在发布前更新验证。
- [ ] 两台登录同一 Apple 账户的真实设备验证新增、编辑、删除、离线恢复与并发合并；账户不可用时本地数据仍可读写。
- [ ] 在 CloudKit Dashboard 核对开发 schema，并在提交前部署到 Production；不得用本地构建替代此步骤。
- [ ] Release 不自动添加示例数据、不写入测试库、不包含测试入口。
- [ ] AppIcon、启动页、本地化、版本号与隐私清单进入归档。

已确认两个 Release App 包的图标、中英文本地化与隐私清单存在，正式 Archive 仍待签名资料。Mac 关闭全部窗口并退出后的 Finder 冷启动已通过桌面操作验证，空人物表单/取消也已检查；XCTest 启动路径仍未通过，不能据此宣称完整 Mac UI 验收完成。

2026-08-31 当前 iPhone 完整回归为 57/57 通过，当前 Mac 44 项单元测试通过；iPhone/iPad 图谱手势子集均通过。iPad 全量为 56/57，唯一 signal term 在备份业务恢复成功后的 Files 清理，随后该备份子集 2/2 通过，因此范围已有通过证据但原报告不标全绿。Mac/iOS Release 再次构建成功并核对 Bundle ID、最低系统、双架构与隐私清单。正常 Mac Release 已从 Finder 验证空人物、空图谱和原生全屏进出；空态缺失全屏入口、进入后按钮状态不同步及多窗口通知隔离均在桌面验收中修复，最终 Mac 构建为 `macOS-release-20260831-115354-25801.xcresult`。此前 `macOS-release-20260831-115146-25446.xcresult` 的失败源于受限沙箱阻止 Swift 宏插件启动，不记为源码失败。全过程未启动 Mac UI Runner、未更改系统权限、未写入测试数据。Mac 完整 UI/键盘/VoiceOver、真机、最低系统运行及正式签名仍未完成，因此上方跨三端项目保持未勾选。

后续使用隔离 QA Bundle 在正常 Mac App 中完成有数据验收：2 人物/1 组夫妻关系 CRUD、性别关系类型过滤、长姓名卡片、合并反向卡片、圆环/星球选择、取消、自动暂停、滚轮缩放、横向拖拽和有数据全屏均已操作；中英文设置页面也已切换检查。验收记录已通过应用自身删除流程清为 0 人物/0 关系，正式数据容器未被写入。节点 hover 命中已改到透明节点按钮自身，但当前桌面控制接口不能生成无点击的纯鼠标移动，因此人工 hover 视觉复核仍未勾除。当前 Mac 单元报告 `macOS-unit-20260831-120942-26374.xcresult` 为 44/44，最终本地构建 `macOS-release-20260831-121000-26401.xcresult`、`iOS-device-release-20260831-121004-26423.xcresult` 成功；完整 VoiceOver/键盘、浅色 Mac、最低系统和真机仍待验收。

同日补齐应用内外观选择：跟随系统、浅色、深色均在正常 QA Mac App 中实际切换，浅色人物空态和深色设置页面正确重绘，最后恢复跟随系统且未改动 macOS 外观。`macOS-unit-20260831-121433-26590.xcresult` 为 44/44；iPhone 专项 `iOS-appearance-20260831-122334-27012.xcresult` 与清理 Runner Busy 后的 iPad 专项 `iOS-appearance-20260831-122833-28308.xcresult` 均为 1/1，浅/深色截图已目检；最新 `macOS-release-20260831-122446-27379.xcresult`、`iOS-device-release-20260831-122449-27397.xcresult` 构建成功。上方跨设备截图项仍不勾选，因为窄窗口和全部页面/语言/字号/外观组合尚未逐项完成。

同日新增系统辅助功能审计，覆盖人物、关系、图谱、设置及应用内隐私政策的对比度、元素识别、点击区域、描述、文本裁切和 trait，并据此修复搜索提示、卡片朗读、文字对比度、图谱按钮尺寸/名称及设置长文排版。最终 iPhone `iOS-accessibility-20260831-133148-35374.xcresult`、iPad `iOS-accessibility-20260831-133503-35753.xcresult` 均为 1/1；人物语义修复后的 iPhone 单元/夫妻子集为 45/45，图谱子集 2/2，包含新增双语隐私政策的完整 UI 为 16/16。系统审计的精确例外记录于 `../PLAN.md`；它不能替代 Mac VoiceOver、键盘焦点顺序和纯鼠标 hover 人工验收，因此对应发布项仍不勾选。

辅助功能修复后的最终 Mac 单元 `macOS-unit-20260831-132329-34199.xcresult` 为 44/44，最终本地构建 `macOS-release-20260831-132345-34275.xcresult`、`iOS-device-release-20260831-132324-34174.xcresult` 成功。两个 Release 包均为 `com.peopleatlas.app` 1.0.0(1)，最低系统 macOS 14 / iOS 17；Mac 包为 arm64+x86_64，iOS 包为 arm64，并都包含隐私清单。此处仍只是未签名的本地构建，不代表 Archive、Validate、真机或 App Store 上传已完成。

发布审计继续补齐应用内隐私政策：设置页可离线打开中英文完整说明，iPhone `iOS-privacy-20260831-133007-35000.xcresult`、iPad `iOS-privacy-20260831-133242-35489.xcresult` 均 1/1；双语截图已目检。首轮 iPad 审计 `iOS-accessibility-20260831-133331-35590.xcresult` 因 iPadOS 审计结束后自动关闭 sheet、测试仍点击“完成”而失败，不是页面审计问题；适配系统差异后上述最终 iPad 审计通过。最新完整 iPhone UI `iOS-ui-20260831-133604-35852.xcresult` 为 16/16，Mac 单元 `macOS-unit-20260831-132916-34609.xcresult` 为 44/44。

隐私政策进入正式包后的最终本地构建 `macOS-release-20260831-134652-36852.xcresult`、`iOS-device-release-20260831-134707-36972.xcresult` 成功；Release 静态分析 `macOS-analyze-20260831-134845-37306.xcresult`、`iOS-device-analyze-20260831-134904-37362.xcresult` 均为 0 错误、0 普通警告、0 Analyzer 警告。1024×1024 图标无 alpha，两个平台隐私清单仍在包内。当前没有 `Signing.xcconfig`，本机存在多个有效开发签名身份，不能擅自选择团队；占位 Bundle ID、正式团队、Archive/Validate 仍待用户确认。

Mac 解锁后的正常 QA App 补充验收已完成侧栏方向键切换、人物表单姓名自动聚焦、Tab 到备注、Escape 取消不写入，以及中文深色隐私政策完整显示/关闭。系统当前未开启“键盘导航所有控件”，未擅自修改；VoiceOver 开关属于系统辅助功能状态，须获得用户操作前确认。桌面控制接口也不能生成可证明的纯鼠标移动，因此按钮级全键盘链、VoiceOver 实际朗读和纯 hover 仍保留为发布前人工项。图谱复验的两名人物只在 QA 容器，无正式数据写入；等待用户确认后再通过应用自身删除。

已新增可重复的 `store-shots` 截图流程。最终本地化 iPhone 17 Pro Max 报告 `iOS-store-shots-20260831-143500-50603.xcresult` 与 iPad Pro 13-inch 报告 `iOS-store-shots-20260831-143725-51276.xcresult` 均 1/1；中英各 5 张，iPhone 全部 1320×2868、iPad 全部 2064×2752，均无 alpha。英文截图使用专用英文样本姓名，中文保持原样，长姓名与关系句已目检无裁切；该入口仅限 Debug 内存库。截图验收同时发现并修复深色星球/星云的标题与系统栏配色；最新 Mac 单元 44/44，macOS/iOS Release 均成功。Mac 中英文 16:10 原始草稿也已各补齐人物、关系、圆环、星球、设置 5 张，全部 2560×1600、无 alpha；设置页替代无法形成 16:10 整窗画面的隐私 sheet。当前图片仍是隔离样本数据的原始草稿，最终选图与营销文案尚未确认，因此“各目标设备商店截图”仍保持未勾选。

已在 `PublicSite/` 准备不加载第三方资源的中英文隐私政策、支持页和首页模板，并新增 `Tools/verify_public_site.sh`。模板模式检查通过，ready 模式会正确拒绝开发者名称、邮箱、生效日期或版权年份未填写的页面。仍须应用所有者提供真实资料、完成实际浏览器视觉检查并部署到公开 HTTPS 地址，所以上方公开 URL 与发布项保持未勾选。

`Tools/verify_privacy_claims.sh` 当前通过：隐私清单为不跟踪、无收集数据类型、无跟踪域名，仅声明 UserDefaults 的 `CA92.1` 必需原因；Swift 源码未发现网络、通讯录、跟踪、广告或分析 API，工程未引入远程 Swift 包。该结果支持当前隐私标签草稿，但最终仍须对正式签名归档包重新检查并由应用所有者提交问卷，因此对应项目保持未勾选。

经用户操作前确认，Apple Developer 已注册显式 App ID `People Atlas` / `com.hanqiu.peopleatlas`，未开启额外 capability。Team 已写入 git 忽略的本地签名配置；Mac/iOS 开发签名 Release 与本地 Archive 均成功，归档内 App 的严格签名校验通过。iOS 复用本机既有通配开发描述文件，未让 Xcode 自动创建或更新开发者后台资源。App Store 分发导出、在线 Validate 和上传仍未执行。

## 需要开发者确认

- [ ] 产品名称、商标与版权主体。
- [x] 唯一 Bundle ID：`com.hanqiu.peopleatlas`，已注册显式 App ID；仓库 `Config/App.xcconfig` 的旧值仅为无本地配置时的回退值。
- [x] DEVELOPMENT_TEAM、现有 Apple Development 证书与现有开发描述文件已完成本地签名构建/Archive 验证。
- [ ] App Store 分发证书/描述文件、真机运行与在线 Validate。
- [ ] App Store Connect 应用记录、iOS/macOS 平台设置及分类。
- [ ] 正式公网隐私政策 URL、支持 URL、联系邮箱；不可使用占位地址提交。
- [ ] 将 Docs 中的隐私/商店草稿核对后发布到自己的静态网站。
- [ ] 隐私标签根据最终二进制填写；当前本地版没有开发者数据收集、跟踪或第三方 SDK。
- [ ] 年龄分级问卷、内容权利、出口合规信息与发布地区。
- [ ] 各目标设备商店截图、描述、关键词、审核备注。
- [x] Mac/iOS 本地开发签名 Archive 已生成，归档内 App 签名与元数据校验通过。
- [ ] 使用 App Store 分发方式导出并在线 Validate，检查隐私报告和签名；上传前再次取得用户授权。

## 当前边界

应用不提供独立账号，也不要求购买开发者服务器；iCloud 同步依赖系统 Apple 账户与 Apple CloudKit。代码、entitlement 和隐私文案已经接入，但开发者后台容器关联、Production schema 部署、最新描述文件与双真机同步尚须逐项完成，不能仅凭本地构建宣称云同步已上线。

参考：[Apple 提交要求](https://developer.apple.com/app-store/submitting/)、[Required Reason APIs](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)。提交当天应重新核对官方要求。
