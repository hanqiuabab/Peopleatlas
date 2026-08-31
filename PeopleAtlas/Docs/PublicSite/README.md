# 公开支持站点模板

这是无需数据库、登录或服务器程序的纯静态站点，可用于 App Store Connect 的支持 URL 与隐私政策 URL。页面不加载第三方字体、脚本、图片或分析服务。

## 发布前填写

在三个 HTML 文件中统一替换：

- `__DEVELOPER_NAME__`：开发者或公司公开名称。
- `__CONTACT_EMAIL__`：公开支持邮箱。
- `__EFFECTIVE_DATE__`：隐私政策生效日期，例如 `2026-09-01`。
- `__COPYRIGHT_YEAR__`：版权年份，例如 `2026`。

执行模板检查：

```sh
bash ../../Tools/verify_public_site.sh template
```

填写完成后执行发布检查；只要仍有占位符就会失败：

```sh
bash ../../Tools/verify_public_site.sh ready
```

也可以把待发布副本目录作为第二个参数传入，便于在不改动模板的情况下检查：`bash Tools/verify_public_site.sh ready /path/to/site`。

通过后可将本目录原样部署到任意 HTTPS 静态托管服务。App Store Connect 中填写最终公开地址，例如：

- 支持 URL：`https://你的域名/support.html`
- 隐私政策 URL：`https://你的域名/privacy.html`

不要填写本地文件路径、局域网地址或尚未公开的预览链接。
