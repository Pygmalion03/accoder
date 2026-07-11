# ACMCoder

ACMCoder 是一个面向 LeetCode 侧栏练习的本地 ACM 练习器：题面继续在 LeetCode 页面看，代码、自测输入、运行结果、AC 记录和本地记忆放在 ACMCoder 里处理。

它有两个主要入口：

- **浏览器插件侧栏**：日常使用的重点入口。在 LeetCode 题目页点击 ACMCoder 扩展图标，侧栏读取当前题目并提供代码区、自测输入和运行结果。
- **本地 Web 页面**：打开 `http://127.0.0.1:43117`，管理个人题库和推荐题库、生成每日计划，并使用内置编程环境练习。

## 推荐安装方式

普通用户优先使用 Docker app。只需要 Docker Desktop，不需要在本机另装 Node.js、Java、C++ 或 Python。

```bash
git clone https://github.com/Pygmalion03/acmcoder.git
cd acmcoder
docker compose -f docker-compose.prebuilt.yml up -d
```

不想安装 Git 时，也可以从 GitHub Release 或仓库页面下载源码 ZIP，解压后在解压目录运行同一条命令：

```bash
docker compose -f docker-compose.prebuilt.yml up -d
```

启动后打开：

```text
http://127.0.0.1:43117
```

Docker app 页面里的运行模式会显示为 `内置环境`。这表示 Java/C++/Python 工具链都在 app 容器里，直接选它运行代码即可。

停止服务：

```bash
docker compose -f docker-compose.prebuilt.yml down
```

## 安装浏览器插件

插件目前先走手动加载，还没有发布到 Edge Add-ons 或 Chrome Web Store。插件目录是源码里的：

```text
extension/
```

加载步骤：

1. 先确认 ACMCoder 服务已经启动，`http://127.0.0.1:43117` 可以打开。
2. Edge 打开 `edge://extensions/`；Chrome 打开 `chrome://extensions/`。
3. 打开 `Developer mode` / 开发者模式。
4. 点击 `Load unpacked` / 加载已解压的扩展程序。
5. 选择解压目录或仓库目录里的 `extension/` 文件夹，不要选择 ZIP 文件本身。
6. 打开 LeetCode 题目页，例如 `https://leetcode.cn/problems/reverse-linked-list/`。
7. 点击浏览器工具栏里的 ACMCoder 扩展图标，侧栏会打开并读取当前题目。

侧栏保留练习需要的内容：语言选择、初始模板、代码区、自测输入、可选预期输出、运行结果、AC 次数、本地记忆和可选模型建议。完整插件说明见 [`docs/edge-extension.md`](docs/edge-extension.md)。

## 另一台设备怎么更新

如果另一台设备是手动下载 ZIP 使用：

1. 下载最新 Release 或最新源码 ZIP。
2. 解压到一个新的目录，或者覆盖旧目录。
3. 在新目录里启动服务：

```bash
docker compose -f docker-compose.prebuilt.yml pull
docker compose -f docker-compose.prebuilt.yml up -d
```

4. 到 `edge://extensions/` 或 `chrome://extensions/`，对 ACMCoder 点 `Reload` / 重新加载。若旧扩展指向旧解压目录，重新 `Load unpacked` 并选择新目录里的 `extension/`。

如果另一台设备是 Git clone：

```bash
git pull
docker compose -f docker-compose.prebuilt.yml pull
docker compose -f docker-compose.prebuilt.yml up -d
```

然后在扩展管理页点 `Reload`。

如果你在 Compose 文件里固定了镜像 tag，把 tag 更新到当前版本：

```text
ghcr.io/pygmalion03/acmcoder-app:v2.2.4
ghcr.io/pygmalion03/acmcoder-runner:v2.2.4
```

## 日常使用流程

1. 启动 ACMCoder 服务。
2. 打开 LeetCode 题目页。
3. 点击 ACMCoder 扩展图标打开侧栏。
4. 选择语言，按 ACM 输入输出协议补全代码。
5. 填写 `stdin` 和可选预期输出，点击 `Run`。
6. 需要管理记忆题目、导入导出或练内置种子题时，打开 `http://127.0.0.1:43117`。

## 启动方式和运行模式

先分清两个概念：

- **启动方式**：ACMCoder Web 服务在哪里跑。
- **运行模式**：点击 `Run` 时，代码交给哪套编译/运行环境。

| 使用方式 | 用户需要先装 | Web 服务 | 页面运行模式 |
| --- | --- | --- | --- |
| Docker app | Docker Desktop | Docker app 容器 | `内置环境` |
| 源码 + 本机环境 | Node.js 和对应语言工具链 | 宿主机 Node.js | `本机环境` |
| 源码 + Docker runner | Node.js、Docker Desktop | 宿主机 Node.js | `Docker runner` |

Docker app 是普通用户最短路径。Docker runner 是给“Web 服务在本机跑，但代码执行交给 runner 容器”的开发/半开发场景用的，不是 Docker app 的必选项。

## 源码本地运行

适合开发者，或已经安装 Node.js 的用户：

```bash
npm install
npm test
npm start
```

打开：

```text
http://127.0.0.1:43117
```

常用 CLI：

```bash
node bin/acmcoder.js list
node bin/acmcoder.js show reverse-linked-list
node bin/acmcoder.js doctor
node bin/acmcoder.js test reverse-linked-list --lang python --file path/to/your/main.py
```

源码模式下会扫描宿主机语言环境。宿主机有对应工具链时选 `本机环境`；如果只有 Node.js 和 Docker Desktop、不想另装 Java/C++/Python，可以选 `Docker runner`。

## Docker runner

Docker runner 镜像带 Java、C++、Python 三套运行环境。默认本地镜像名是：

```text
acmcoder-runner:local
```

首次选择 Docker runner 时，如果镜像不存在，ACMCoder 会自动执行等价构建：

```bash
docker build -t acmcoder-runner:local .
```

也可以指定预构建 runner 镜像：

```powershell
$env:ACMCODER_DOCKER_IMAGE="ghcr.io/pygmalion03/acmcoder-runner:latest"
```

```bash
export ACMCODER_DOCKER_IMAGE=ghcr.io/pygmalion03/acmcoder-runner:latest
```

禁用自动构建：

```bash
ACMCODER_DOCKER_AUTO_BUILD=0
```

`node bin/acmcoder.js doctor` 会同时展示本机 Java/C++/Python 工具链和 Docker runner 状态。

## 版本、Release 和镜像

这个项目有三类发布物：

- **源码分支**：例如 `v2.2`，包含代码、Dockerfile、Web、插件和文档。
- **GitHub Release**：面向用户看的版本页，说明 tag、变更和启动方式。
- **GHCR Docker 镜像**：Docker 用户实际拉取的预构建镜像。

`docker-compose.prebuilt.yml` 默认使用：

```text
ghcr.io/pygmalion03/acmcoder-app:latest
```

需要锁版本时使用当前 Release tag：

```text
ghcr.io/pygmalion03/acmcoder-app:v2.2.4
ghcr.io/pygmalion03/acmcoder-runner:v2.2.4
```

更多部署边界见 [`docs/deployment.md`](docs/deployment.md)。

## 当前能力

- 5 道种子题。
- 支持 Java、C++17、Python。
- 支持本机运行、Docker runner 和 Docker app 内置环境。
- 支持 Edge/Chrome 手动加载浏览器插件，在 LeetCode 题目页打开侧栏练习。
- 支持本地记忆题目、AC 次数、导入导出。
- 内置 30 道中文高频推荐题，支持推荐题库导入、导出、全选和批量删除。
- 支持可选 OpenAI-compatible 模型建议，但不使用 LLM 作为判题器。
- 不分发完整 LeetCode 题面，只保留题目索引、链接和自维护 ACM 协议。

## 模型建议和本地数据

模型建议是可选能力，不参与判题，也不会覆盖源代码。用户可以在 Web 或插件里填写 API Key、Base URL 和 Model，服务端通过 OpenAI-compatible `chat/completions` 接口请求建议。

本地数据默认保存在：

```text
data/memory/
```

这个目录已被 git 忽略。API Key 目前是本机明文保存，适合个人本地使用，不要把自己的 `data/memory` 目录分享给别人。

## 接口和目录

常用本地接口：

```text
GET  /api/doctor
POST /api/run
GET  /api/memory/pages
POST /api/memory/pages
GET  /api/memory/export
POST /api/problems/import
POST /api/assist
```

主要目录：

```text
data/problems.json       题目元数据
problems/*/cases         固定样例
problems/*/templates     Java/C++/Python 模板
src/core                 题目读取和输出比对
src/runner               本地和 Docker runner
src/server               本地 HTTP API
web                      本地 Web 页面
extension                浏览器侧栏插件
```

## 后续

当前优先级是保持 Docker app、浏览器插件和 GitHub Release 的同步可用。后面更值得补的是插件商店发布、更多题目贡献规范和更顺的一键安装体验。
