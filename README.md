# ACMCoder

基于 LeetCode 题目索引的本地 ACM 练习器。第一版先跑通本地真实执行闭环：题单、ACM 输入输出协议、固定样例、自定义输入、CLI 和本地 Web。

## 快速开始

普通用户优先走 Docker app，不需要安装 Node.js、Java、C++ 或 Python，只需要 Docker Desktop：

```bash
git clone https://github.com/Pygmalion03/acmcoder.git
cd acmcoder
docker compose -f docker-compose.prebuilt.yml up -d
```

打开：

```text
http://127.0.0.1:43117
```

如果不想安装 Git，也可以在 GitHub 页面下载源码 ZIP，解压后在目录里运行同一条 `docker compose -f docker-compose.prebuilt.yml up -d`。

停止服务：

```bash
docker compose -f docker-compose.prebuilt.yml down
```

更新到最新镜像：

```bash
git pull
docker compose -f docker-compose.prebuilt.yml pull
docker compose -f docker-compose.prebuilt.yml up -d
```

## 版本与发布物

当前推荐版本是 `v2.1` / `v2.1.0`。

这个项目有三类容易混淆的东西：

- **源码分支**：例如 `v2.1`，包含 Web、CLI、题目数据、Dockerfile 和文档。
- **GitHub Release**：面向用户看的版本说明页。它不是 Docker 镜像本身，也不是运行必需条件。
- **GHCR Docker package**：真正给 Docker 用户拉取的预构建镜像。

目前 Docker 用户主要使用：

```text
ghcr.io/pygmalion03/acmcoder-app:latest
ghcr.io/pygmalion03/acmcoder-app:v2.1.0
ghcr.io/pygmalion03/acmcoder-runner:latest
ghcr.io/pygmalion03/acmcoder-runner:v2.1.0
```

Release 的价值是让用户在 GitHub 页面上看到“这是哪个版本、改了什么、应该怎么启动”。没有 Release 也不影响 Docker 镜像运行，但有 Release 更适合公开项目使用。

## 当前版本

- 5 道种子题。
- 支持 Java、C++、Python。
- 支持本机 `javac`、`g++`、`python` 真实运行，也支持 Docker runner。
- 支持预构建 Docker app，用户只装 Docker 也能打开 Web 使用。
- 不分发完整 LeetCode 题面，只保留题目索引、链接和自维护 ACM 协议。
- 不使用 LLM 作为判题器。

## 源码本地运行

适合开发者，或已经有 Node.js 的用户：

```bash
npm install
npm test
node bin/acmcoder.js list
node bin/acmcoder.js show two-sum
node bin/acmcoder.js doctor
```

运行 Python 模板：

```bash
node bin/acmcoder.js test two-sum --lang python --file problems/two-sum/templates/main.py
```

启动本地 Web：

```bash
npm start
```

然后打开：

```text
http://127.0.0.1:43117
```

## Docker runner

如果本机能启动 ACMCoder Web，但没有 Java、C++ 或 Python 工具链，可以选择 Docker runner。runner 镜像带了 Java、C++、Python 三套运行环境；页面和 CLI 仍然按每次运行选择的语言执行对应模板。

默认镜像名是 `acmcoder-runner:local`。首次 Docker 运行会自动检查它；如果镜像不存在，会自动在项目根目录执行等价的构建命令：

```bash
docker build -t acmcoder-runner:local .
```

如果你想提前构建，也可以手动运行上面的命令。发布后的预构建 runner 镜像可以这样指定：

```powershell
$env:ACMCODER_DOCKER_IMAGE="ghcr.io/pygmalion03/acmcoder-runner:latest"
```

```bash
export ACMCODER_DOCKER_IMAGE=ghcr.io/pygmalion03/acmcoder-runner:latest
```

然后在 CLI 中显式选择 Docker：

```bash
node bin/acmcoder.js test two-sum --lang python --file problems/two-sum/templates/main.py --runner docker
```

如果不想让 ACMCoder 自动构建镜像，可以设置 `ACMCODER_DOCKER_AUTO_BUILD=0`。这时缺镜像会直接返回 `NO_RUNNER` 并提示手动构建命令。

`node bin/acmcoder.js doctor` 会同时展示本地 Java/C++/Python 工具链和 Docker runner 状态，包括 Docker daemon 是否可用、配置的镜像是否已经存在或是否会在首次运行时自动构建。

Web 页面也可以在运行模式里选择 Docker。Docker 模式会禁用容器网络，并限制 CPU、内存和进程数量。

## Docker Compose 应用启动

如果用户只有 Docker，没有 Node.js、Java、C++ 或 Python，发布后的预构建应用镜像是最短启动路径：

```bash
docker compose -f docker-compose.prebuilt.yml up -d
```

然后打开：

```text
http://127.0.0.1:43117
```

这条路径默认使用用户本机已有的 Java/C++/Python 环境。下载源码本身不会修改用户的 Docker 配置，也不会安装本机编译环境。

这时 `app` 镜像会同时运行 Web 服务，并提供 Java、C++、Python 三套工具链；页面里选择 Local runner 即可运行代码。记忆题目、AC 次数和模型设置会保存在宿主机的 `data/memory` 目录。

如果要从当前源码构建应用镜像，再运行：

```bash
docker compose up --build
```

`app` 镜像解决“只有 Docker，也要直接打开 Web”的问题；`runner` 镜像解决“Web 在本地启动，但代码执行交给 Docker”的问题。它们都包含三种语言环境，不需要在部署时先裁掉某一种语言。

三种使用方式可以这样理解：

| 使用方式 | Web 服务 | 编译/运行环境 |
| --- | --- | --- |
| 源码 + Local runner | 本机 Node.js | 本机 Java/C++/Python |
| 源码 + Docker runner | 本机 Node.js | Docker runner 镜像 |
| Docker app 镜像 | Docker app 容器 | Docker app 容器 |

更完整的部署现状和限制见：

```text
docs/deployment.md
```

## 环境扫描与模型建议

Web 页面和 Edge 侧边栏会调用 `/api/doctor` 显示 Python、Java、C++ 与 Docker runner 状态，并在用户还没有手动选择运行模式时按当前语言给出推荐。

模型建议是可选能力，不参与判题，也不会覆盖源代码。用户可以在页面里填写 API Key、Base URL 和 Model，服务端会通过 OpenAI-compatible `chat/completions` 接口请求建议。设置保存在 `data/memory/settings.json`，也可以通过 `ACMCODER_LLM_API_KEY`、`ACMCODER_LLM_BASE_URL`、`ACMCODER_LLM_MODEL` 配置。

`data/memory/` 已被 git 忽略，API Key 不会随源码提交。注意它目前是本机明文保存，适合个人本地使用，不要把自己的 `data/memory` 目录分享给别人。

## CLI

```bash
node bin/acmcoder.js list
node bin/acmcoder.js show <slug-or-id>
node bin/acmcoder.js doctor
node bin/acmcoder.js test <slug> --lang <java|cpp|python> --file <path> [--runner <local|docker>]
node bin/acmcoder.js run <slug> --lang <java|cpp|python> --file <path> --input <path> [--expected <path>] [--runner <local|docker>]
node bin/acmcoder.js serve [--port 43117]
```

## 目录

```text
data/problems.json       题目元数据
problems/*/cases         固定样例
problems/*/templates     Java/C++/Python 模板
src/core                 题目读取和输出比对
src/runner               本地 runner
src/server               本地 HTTP API
web                      本地练习页面
```

## 后续

下一步更值得做的是更多题目贡献规范和镜像发布后的安装体验。浏览器插件可以复用当前本地 HTTP API。

## 插件记忆模式接口

本地服务提供了一个给浏览器插件使用的记忆接口：

```bash
POST http://127.0.0.1:43117/api/memory/pages
GET  http://127.0.0.1:43117/api/memory/pages?slug=two-sum
DELETE http://127.0.0.1:43117/api/memory/pages
GET  http://127.0.0.1:43117/api/memory/export
DELETE http://127.0.0.1:43117/api/problems
GET  http://127.0.0.1:43117/api/problems/export
POST http://127.0.0.1:43117/api/problems/import
```

Web 页面会把插件保存的记忆题目和内置种子题目统一显示在题目列表里。点击 `选择题目` 后才会显示复选框；`删除选中` 对记忆题目会改写 `data/memory/pages.jsonl`，对内置种子题会写入本地隐藏记录 `data/memory/deleted-problems.json`，不会删除仓库源码里的种子数据。`导出全部` 会下载 JSON；选择题目后会变成导出选中题目。`导入` 支持导入 `acmcoder-problems-v1` 和旧的 `acmcoder-memory-v1` JSON：记忆题会写回本地记忆文件，内置种子题会解除本地隐藏状态。

设计说明见：

```text
docs/extension-memory-mode.md
```

Edge 插件目录：

```text
extension/
```

加载说明见：

```text
docs/edge-extension.md
```
