# ACMCoder

基于 LeetCode 题目索引的本地 ACM 练习器。第一版先跑通本地真实执行闭环：题单、ACM 输入输出协议、固定样例、自定义输入、CLI 和本地 Web。

## 当前版本

- 5 道种子题。
- 支持 Java、C++、Python。
- 使用本机 `javac`、`g++`、`python` 真实运行。
- 不分发完整 LeetCode 题面，只保留题目索引、链接和自维护 ACM 协议。
- 不使用 LLM 作为判题器。

## 运行

```bash
cd E:\Projects\acmcoder
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

如果本机没有 Java、C++ 或 Python 工具链，但已经安装 Docker，可以先构建本地 runner 镜像：

```bash
docker build -t acmcoder-runner:local .
```

默认镜像名是 `acmcoder-runner:local`。如果你要换成自己的镜像名，可以设置 `ACMCODER_DOCKER_IMAGE`：

```powershell
$env:ACMCODER_DOCKER_IMAGE="ghcr.io/your-name/acmcoder-runner:v1"
```

```bash
export ACMCODER_DOCKER_IMAGE=ghcr.io/your-name/acmcoder-runner:v1
```

然后在 CLI 中显式选择 Docker：

```bash
node bin/acmcoder.js test two-sum --lang python --file problems/two-sum/templates/main.py --runner docker
```

`node bin/acmcoder.js doctor` 会同时展示本地 Java/C++/Python 工具链和 Docker runner 状态，包括 Docker daemon 是否可用、配置的镜像是否已经存在。

Web 页面也可以在运行模式里选择 Docker。Docker 模式会禁用容器网络，并限制 CPU、内存和进程数量。

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

下一步更值得做的是 Docker runner、LeetCode 题目转换流程、更多题目贡献规范。浏览器插件可以复用当前本地 HTTP API。

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
