# 浏览器插件使用说明

浏览器插件是 ACMCoder 面向 LeetCode 日常练习的主要入口之一。用户不用把题目复制到本地页面：在 LeetCode 题目页点击 ACMCoder 扩展图标，侧栏会读取当前题目，提供 ACM 模板、自测输入、运行结果和本地记忆。

当前插件先走手动加载，还没有把 Edge Add-ons 或 Chrome Web Store 当成安装入口。下载仓库源码或源码 ZIP 并解压后，插件目录是：

```text
extension/
```

## 加载方式

1. 先启动 ACMCoder 服务。插件本身不包含 Web 服务和运行环境，必须连到本地 ACMCoder。只有 Docker 的普通用户推荐运行：

```bash
docker compose -f docker-compose.prebuilt.yml up -d
```

本地 Node.js 用户可以运行：

```bash
npm start
```

2. Edge 用户打开 `edge://extensions/`；Chrome 用户打开 `chrome://extensions/`。
3. 打开页面右上角的 `Developer mode` / 开发者模式。
4. 点击 `Load unpacked` / 加载已解压的扩展程序。
5. 选择项目里解压后的 `extension/` 目录，不要选择 zip 文件本身。
6. 打开 LeetCode 题目页，例如 `https://leetcode.cn/problems/reverse-linked-list/`。
7. 点击 ACMCoder 扩展图标，浏览器会直接打开 ACMCoder 侧栏。

刚重新加载过扩展时，第一次读取题目可能遇到 `Could not establish connection. Receiving end does not exist.`。当前版本会自动注入 content script 并重试；如果仍失败，刷新一次 LeetCode 题目页再读。

侧栏现在按浏览器窗口启用，不再绑定到单个 LeetCode tab。点击扩展图标会直接打开侧栏，切换页面或 tab 时侧栏保持打开；只有用户手动关闭侧栏时才会收起。

## 使用顺序

日常使用按这个顺序最稳：

1. 保持本地服务运行，Docker app 用户确认页面运行模式显示为 `内置环境`。
2. 打开任意 LeetCode 题目页。
3. 点击 ACMCoder 扩展图标打开侧栏。
4. 选择语言，按 ACM 输入输出补代码。
5. 填自测输入和可选预期输出，点击 `Run`。
6. 需要管理记忆题目、导出/导入数据或练内置种子题时，再打开 `http://127.0.0.1:43117`。

## 当前侧栏

侧栏不再展示整段题面。题目描述、约束和示例直接看左侧 LeetCode 页面；插件侧栏只保留练习需要的右侧工作区：

- 读取当前题目，并提取 `slug`、标题、难度、标签、题面正文和第一个样例。标题和标签优先从 LeetCode CN GraphQL 的 `translatedTitle`、`topicTags.translatedName` 读取。
- 记忆模式开启后，读取成功会自动写入本地记忆文件。
- 语言选择：Python、Java、C++17。
- 代码区：基础高亮、Tab 缩进、括号/引号补齐、回车缩进、选中括号时显示对应括号。
- 自测输入：`stdin` 和可选的预期输出。
- 本地运行：调用 `POST http://127.0.0.1:43117/api/run`，可选择本机/内置环境或 Docker runner，展示 `stdout`、`stderr` 和 AC/WA/RE/CE 等状态。Docker runner 缺少本地镜像时会自动构建 `acmcoder-runner:local`，除非设置了 `ACMCODER_DOCKER_AUTO_BUILD=0`。
- 缓存：侧栏关闭或切页后，最近题目、代码、输入和预期输出会尽量恢复。

保存后，本地 ACMCoder Web 页面会轮询 `/api/memory/current` 并自动加载最新题目。

## 本地记忆文件

源码启动时默认追加写入：

```text
data/memory/pages.jsonl
```

最近一次读取会同步写入：

```text
data/memory/current.json
```

`data/memory/` 已加入 `.gitignore`，这是本机用户数据，不应该提交。

## LLM API Key

侧栏里的 `LLM API Key` 会通过本地 ACMCoder 服务保存到 `data/memory/settings.json`。这个目录已被 git 忽略；Key 不参与判题，也不会覆盖代码。用户只有在主动请求模型建议时，本地服务才会把题目、代码和提问发给所配置的 OpenAI-compatible 模型接口。

## 技术边界

浏览器插件不能直接写 `E:\Projects\acmcoder\data\memory\pages.jsonl`。浏览器扩展被沙箱限制，不能任意写用户文件系统。

当前方案：

```text
Browser side panel
  -> content script 读取 LeetCode 页面和 GraphQL 题目信息
  -> POST http://127.0.0.1:43117/api/memory/pages
  -> Node 本地服务写入 data/memory/pages.jsonl 和 current.json
  -> ACMCoder Web 轮询 /api/memory/current 并自动加载
```

这比让插件直接碰文件系统更可控，也方便后续接入 LLM 或本地索引。
