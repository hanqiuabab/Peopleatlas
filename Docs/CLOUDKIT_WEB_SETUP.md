# CloudKit 网页同步配置

网页使用 Apple 托管的 CloudKit JS 登录流程访问用户私有 iCloud 数据库。这是为 iCloud 数据同步服务的 Apple 账户认证；不发放网站自建会话，也不需要将 Sign in with Apple 私钥放入前端。

## 1. CloudKit Console

1. 打开 [CloudKit Console](https://icloud.developer.apple.com/)，选择容器 `iCloud.com.hanqiu.peopleatlas`。
2. 在 CloudKit Database 的 **Tokens & Keys** 中创建 Web API Token。
3. 将 Allowed Origins 限制为实际开发和生产站点来源，不要使用无限制的 Token。
4. 开发环境首次保存后，在 schema 中核对 `PeopleAtlasWebNetwork` 记录类型与以下字段：

   - `payload`: String
   - `schemaVersion`: Int(64)
   - `updatedAt`: String

5. 上线前将 Development schema 部署到 Production。CloudKit Production schema 部署后只能做增量修改，不能随意删除已发布字段。

Apple 参考：[CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)、[Obtaining an API Token for an iCloud Container](https://developer.apple.com/documentation/cloudkit/obtaining-an-api-token-for-an-icloud-container)。

## 2. 本地构建配置

复制 `.env.example` 为不入库的 `.env.local`：

```dotenv
VITE_CLOUDKIT_CONTAINER_ID=iCloud.com.hanqiu.peopleatlas
VITE_CLOUDKIT_API_TOKEN=<CloudKit Web API Token>
VITE_CLOUDKIT_ENVIRONMENT=development
```

`VITE_` 变量会出现在构建后的 JavaScript 中。Web API Token 因此必须依靠 Allowed Origins 限制；不要在这里放 Apple 私钥、server-to-server private key 或其他敏感凭证。

生产构建将环境改为：

```dotenv
VITE_CLOUDKIT_ENVIRONMENT=production
```

## 3. 数据与冲突语义

- 私有数据库中每个 Apple 账户保存一条 `primary-network-v1` 快照。
- 本地修改立即保存到 localStorage，700 ms 后尝试上传。页面回到前台、网络恢复或每 30 秒会检查云端新版本。
- 记录使用 CloudKit `recordChangeTag` 避免无条件覆盖。两端都已修改时显示冲突选择。
- “合并”按 ID 合并人物和关系，同 ID 以 `updatedAt` 较新者为准；对于一端删除、另一端仍保留的不同 ID 记录，合并会保留现存记录。需要保留整体删除结果时，应选择对应端的完整数据。
- 网页快照与 `PeopleAtlas/` 原生 SwiftData + CloudKit 记录目前不互通。

## 4. 发布前验收

1. 在两个浏览器中登录同一 Apple 账户，验证新增、编辑、删除会同步。
2. 断网后修改，验证本地状态保留，恢复网络后自动上传。
3. 在两端离线修改不同数据，验证冲突界面的三种处理方式。
4. 退出 Apple 账户，验证本地图谱仍可继续使用，且不误报已上传。
5. 核对生产站点 HTTPS、Allowed Origins、Production schema 和构建环境均指向正式配置。

## 5. GitHub Pages

`.github/workflows/deploy-pages.yml` 会在 `main` 分支更新后自动运行测试和构建，并将 `dist/` 发布到 `/Peopleatlas/` 项目路径。仓库需要配置 Actions secret `CLOUDKIT_WEB_API_TOKEN`。

首次部署使用 Development Token 创建并验证 Web schema；完成 CloudKit Production schema 部署后，应在 Production 环境创建受限 Token、替换 GitHub secret，并将工作流中的 `VITE_CLOUDKIT_ENVIRONMENT` 改为 `production`。
