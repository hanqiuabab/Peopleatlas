# 隐私政策草稿 / Privacy policy draft

适用版本：启用 iCloud 同步的版本。应用设置页已经内置与本草稿一致的中英文政策，可离线查看。发布前仍须补充真实开发者名称、生效日期和联系渠道，并将最终政策发布到公开可访问的网址。

## 简体中文

关系图谱帮助你在个人设备上记录人物及彼此关系。你输入的姓名、性别、备注和关系先通过 SwiftData 保存在设备本地；iCloud 可用时，还会通过 Apple CloudKit 同步到你的私有 iCloud 数据库，并显示在登录同一 Apple 账户的设备上。应用不向开发者运营的服务器发送这些内容，不读取系统通讯录，不包含广告、分析或跟踪 SDK，也不要求创建应用账号。

你可以在应用内编辑、删除人物与关系，也可以主动导出 JSON 备份。删除人物会删除其相关关系；删除操作无法通过本应用恢复，除非你保留了此前的备份。导入备份会在确认后替换本地数据。备份是未加密的 JSON 文件，请仅保存到受信任的位置，并谨慎分享。

iCloud 同步由 Apple 提供，受你的 iCloud 设置、可用空间以及 Apple 的隐私与安全政策约束。离线或 iCloud 暂时不可用时，应用继续使用本地数据并在服务恢复后自动重试；设置页显示的是账户可用性，不代表每项更改都已上传完成。卸载所有设备上的应用、删除记录或同步冲突仍可能造成数据丢失，请继续定期导出备份。

请仅记录你有权使用的他人信息，不要使用应用侵犯他人的隐私或合法权益。如后续版本启用账号或云同步，将更新本说明并明确告知相关处理方式。

开发者与联系渠道：发布前由应用所有者填写；本草稿不得原样作为完整上架政策。

## English

People Atlas first stores the names, genders, notes, and relationships you enter locally with SwiftData. When iCloud is available, Apple CloudKit also synchronizes them to your private iCloud database and devices signed in to the same Apple Account. The app does not send this content to developer-operated servers, access system contacts, include advertising or analytics SDKs, or require a separate app account.

You can edit and delete records and explicitly export JSON backups. Deleting a person also deletes their relationships. Deleted records can only be restored from an earlier backup you have kept. Importing a backup replaces local data after confirmation. Backups are unencrypted JSON files; store and share them carefully.

iCloud synchronization is provided by Apple and is governed by your iCloud settings, available storage, and Apple’s privacy and security terms. The app remains usable offline and retries after iCloud becomes available. The status shown in Settings describes account availability; it does not certify that every change has finished uploading. Deleting records, removing the app from all devices, or sync conflicts can still cause data loss, so continue exporting backups regularly.

Only record personal information you are entitled to use. If a future version adds app accounts, sharing, or other data processing, its privacy policy will explain those changes.

Developer identity, effective date, and contact information must be completed by the app owner before publication.
