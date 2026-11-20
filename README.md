# UA Check — User-Agent 在线检测工具

> 同时查看客户端与服务器端接收到的 User-Agent，快速了解浏览器、操作系统和设备信息。
>
> Compare the User-Agent reported by your browser with the one received by an HTTP echo service.

**在线体验 / Live Demo**

- **HTTP：** http://ua.cnlcp.top/
- **HTTPS：** https://ua.cnlcp.top/

**项目地址 / Repository：** https://github.com/aZerinChan/uacheck

## 📖 项目介绍 / Introduction

**中文**

UA Check 是一个基于原生 HTML、CSS 和 JavaScript 构建的轻量级 User-Agent（UA）查询工具。它通过浏览器 API 读取客户端 UA，并向第三方 HTTP 回显服务发起请求，展示服务端实际收到的 UA，帮助用户发现两者是否存在差异。

无需安装软件或部署专用后端，打开网页即可使用。

**English**

UA Check is a lightweight User-Agent (UA) inspection tool built with plain HTML, CSS, and JavaScript. It reads the client-side UA from the browser and queries public HTTP echo services to display the UA received by a remote server, making differences easy to spot.

No installation or dedicated backend is required to use the hosted website.

## ✨ 功能特性 / Features

| 功能 / Feature | 说明 / Description |
| --- | --- |
| 🔍 客户端 UA / Client UA | 通过 `navigator.userAgent` 读取浏览器报告的 UA / Read the UA reported by the browser. |
| 🌐 服务端 UA / Server-received UA | 通过公共 HTTP 回显接口获取远端服务收到的 UA / Fetch the UA received by a public HTTP echo service. |
| ⚡ 多源竞速 / Multiple endpoints | 并发请求多个接口，采用第一个有效响应 / Query multiple endpoints concurrently and use the first valid response. |
| 🧩 信息解析 / UA parsing | 识别浏览器、版本、渲染引擎、操作系统和设备类型 / Identify browser, version, engine, OS, and device category. |
| 🔄 差异提示 / Difference notice | 当两侧 UA 不一致时显示提示 / Show a notice when the two UA strings differ. |
| 🔐 双协议访问 / HTTP & HTTPS | 根据当前页面协议选择相应的回显接口地址 / Select echo endpoint URLs based on the page protocol. |
| 🌓 自适应界面 / Responsive UI | 移动端布局及跟随系统的深色模式 / Mobile-friendly layout and system-based dark mode. |
| 📦 轻量部署 / Static hosting | 无需项目专用后端或构建步骤 / No project-specific backend or build step. |

## 🚀 快速开始 / Quick Start

### 在线使用 / Use Online

打开以下任意地址，即可自动开始检测：

Open either URL to start detection automatically:

- http://ua.cnlcp.top/
- https://ua.cnlcp.top/

### 本地运行 / Run Locally

```bash
git clone https://github.com/aZerinChan/uacheck.git
cd uacheck
python -m http.server 8080
```

在浏览器中访问 / Visit:

```text
http://localhost:8080/
```

如果系统没有 `python` 命令，可以尝试 `python3 -m http.server 8080`；Windows 用户也可以使用 `py -m http.server 8080`。

If `python` is unavailable, try `python3 -m http.server 8080` or `py -m http.server 8080` on Windows.

## ☁️ 部署 / Deployment

项目是静态网站，可以部署到 GitHub Pages、Cloudflare Pages 或其他静态网站托管服务。

This is a static website and can be hosted on GitHub Pages, Cloudflare Pages, or any compatible static host.

**GitHub Pages**

1. Fork 或克隆本仓库，并将代码推送到自己的 GitHub 仓库。
2. 打开仓库的 **Settings → Pages**。
3. 选择 **Deploy from a branch**，指定 `main` 分支及 `/ (root)` 目录，然后保存。
4. 如需使用自定义域名，请另外完成域名与 DNS 配置。

**Cloudflare Pages**

1. 在 Cloudflare Pages 中连接本仓库。
2. 选择静态项目（Framework preset：`None`）。
3. 无需构建命令；将输出目录指向包含 `index.html` 的仓库根目录（通常填 `.`）。
4. 部署并按需绑定自定义域名。

> **注意 / Note：** `main.js` 需要访问第三方 API。若修改回显接口域名，除保证接口可用并允许浏览器跨域访问（CORS）外，还要同步检查 `index.html` 的 Content Security Policy（CSP）中的 `connect-src`。

## 🛠️ 工作原理 / How It Works

```text
                    用户浏览器 / Browser
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     navigator.userAgent        fetch() 并发请求
       客户端 UA / Client UA     Parallel HTTP requests
                                        │
                                        ▼
                              公共 HTTP 回显服务
                              Public echo endpoints
                                        │
                                        ▼
                               服务接收到的 UA
                               Server-received UA
              └────────────┬────────────┘
                           ▼
                    UA 解析与差异提示
               UA parsing & comparison
```

项目使用的回显服务地址配置在 `assets/js/main.js` 的 `SERVER_API_LIST` 中。当前代码包含 `httpbin.io`、`httpbin.org`、`eu.httpbin.org`、`echo.free.beeceptor.com` 和 `postman-echo.com`，并采用第一个有效结果。

The configured providers are listed in `SERVER_API_LIST` in `assets/js/main.js`. The first valid response is used.

**这里的“服务器端 UA”是第三方回显服务所接收到的 UA，不是本站源站日志中的 UA。** 浏览器、扩展、代理及请求路径可能影响结果。UA 不一致只能说明两侧观察到的值不同，不能单独证明发生了代理改写。

**“Server-side UA” refers to what a third-party echo service receives, not what this site's own origin server logs.** A mismatch does not, by itself, prove that a proxy modified the UA.

## 📁 项目结构 / Project Structure

```text
uacheck/
├── index.html          # 页面结构、SEO 元信息与 CSP
├── assets/
│   ├── css/
│   │   └── style.css   # 样式、响应式布局和深色模式
│   └── js/
│       └── main.js     # UA 获取、解析和渲染
├── robots.txt          # 搜索引擎爬取规则
├── sitemap.xml         # 站点地图
├── CNAME               # 自定义域名配置
└── README.md           # 项目文档（本文件）
```

## ⚙️ 自定义配置 / Configuration

可以在 `assets/js/main.js` 中调整：

- `TIMEOUT`：单个回显接口请求的超时时间，默认 `5000` 毫秒。
- `SERVER_API_LIST`：参与竞速的第三方回显接口及其响应格式类型。
- `parseUA()`：UA 字符串的浏览器、系统与设备类别解析规则。

You can customize request timeout, echo endpoints, and UA parsing rules in `assets/js/main.js`.

## 🔒 隐私与使用说明 / Privacy & Limitations

- 客户端 UA 由浏览器本地 JavaScript 读取。/ The client UA is read locally in the browser.
- 服务端 UA 查询会向第三方回显服务发送网络请求；这些服务可能接收到请求 IP、UA 和其他 HTTP 头。/ Remote echo services receive network requests and may observe the request IP, UA, and other headers.
- 若接口不可用、超时或受 CORS 限制，服务端查询可能失败。/ Server-side detection can fail due to unavailable endpoints, timeouts, or CORS restrictions.
- UA 解析基于字符串匹配，结果仅供参考，不保证准确识别所有浏览器和设备。/ UA parsing is heuristic and may not identify every browser or device correctly.

## 🤝 反馈与贡献 / Feedback & Contributions

欢迎通过 [GitHub Issues](https://github.com/aZerinChan/uacheck/issues) 提交问题、功能建议，或通过 Pull Request 参与改进。

Bug reports, feature suggestions, and pull requests are welcome.

## 📦 版本发布 / Releases

查看 [Releases](https://github.com/aZerinChan/uacheck/releases) 获取已发布的版本和更新记录。

See [Releases](https://github.com/aZerinChan/uacheck/releases) for available versions and release notes.

## 📄 开源许可证 / License

本项目基于 [MIT License](LICENSE) 开源。

允许自由使用、复制、修改、分发及商业使用，但须保留原始版权声明和许可证声明。

This project is licensed under the [MIT License](LICENSE).

You are free to use, copy, modify, distribute, and use this project commercially, provided that the original copyright and license notices are preserved.

