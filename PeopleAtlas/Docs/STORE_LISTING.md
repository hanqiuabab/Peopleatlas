# 商店文案草稿

## 中文

名称：关系图谱

副标题：记录人物，连接彼此的故事

描述：

用一张属于自己的关系图谱，整理生活中重要的人。卡片与网格让人物信息清晰易读，圆环、等级、星球和星云视图让关系一目了然。

记录姓名、性别与备注，建立家人、兄弟姐妹和同事关系。添加关系时自动生成反向称谓；智能补全可帮助连接已知父母与兄弟姐妹，长幼不确定时由你决定。

无需应用账号，不含广告。数据优先保存在设备，并通过你的私有 iCloud 数据库在 iPhone、iPad 和 Mac 间自动同步；离线时仍可使用。支持 JSON 备份导入与导出。

支持 iPhone、iPad 和 Mac，提供简体中文与英文界面。

关键词候选：人物,关系,图谱,家庭,家人,网络,记录,卡片

## English

Name: People Atlas

Subtitle: Keep your connections close

Description:

Create a personal atlas of the people who matter. Browse thoughtful cards and explore connections in ring, hierarchy, planet, and nebula views.

Record names, genders, and notes. Connect family members, siblings, and colleagues. Reciprocal relationships are added automatically. Smart suggestions connect known parents and siblings, while uncertain age order stays your choice.

No separate app account, advertising, or tracking. Your information is stored locally first and automatically synchronizes through your private iCloud database across iPhone, iPad, and Mac; the app remains usable offline. Export and import JSON backups to keep a separate copy.

Available for iPhone, iPad, and Mac, in English and Simplified Chinese.

## 审核备注建议

应用无需独立登录或开发者服务器，首次启动没有示例数据。先添加两个人物，再到“关系”页添加关系；图谱页展示已保存人物。设置页提供 iCloud 账户可用性、数据备份与隐私说明。iCloud 同步依赖审核设备登录的 Apple 账户；本地功能在未登录和离线时仍可使用。

提交前确认名称可用性、关键词/文案长度、真实支持 URL、隐私 URL 与所有截图。

`PublicSite/` 已提供无需服务器程序的中英文支持与隐私静态页面模板。应用所有者填写开发者名称、公开邮箱、生效日期和版权年份，并通过 `bash Tools/verify_public_site.sh ready` 后，可部署到自己的 HTTPS 静态托管地址；模板或本地路径不能直接填写到 App Store Connect。

## 截图草稿

可在项目目录运行 `bash Tools/test.sh store-shots '<iOS Simulator destination>'`，用隔离内存样本库生成中英文人物、关系、圆环、星球和隐私政策页面各 5 张；英文套图使用专用英文样本姓名。2026-08-31 已验证 iPhone 1320×2868 与 iPad 2064×2752 两套尺寸，全部无 alpha。Mac 中英文草稿各包含人物、关系、圆环、星球和设置 5 张，全部为 2560×1600、无 alpha；由于隐私政策以 sheet 显示，Mac 套图使用 16:10 整窗设置页替代。报告与导出路径记录在 `../PLAN.md`。

这些图片是原始界面草稿，不自动作为最终营销素材。提交前仍需决定截图排序与说明文案，并由应用所有者确认最终画面不包含真实个人数据。
