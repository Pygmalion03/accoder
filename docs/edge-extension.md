# Edge 插件使用说明

插件目录：

```text
E:\Projects\acmcoder\extension
```

## 加载方式

1. 启动本地服务：

```bash
cd E:\Projects\acmcoder
npm start
```

2. 打开 Edge，进入 `edge://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择 `E:\Projects\acmcoder\extension`。
6. 打开 LeetCode 题目页，例如 `https://leetcode.cn/problems/two-sum/`。
7. 点击扩展图标，Edge 会打开 ACMCoder 侧栏。

如果刚重新加载过扩展，第一次读取时可能遇到 `Could not establish connection. Receiving end does not exist.`。当前版本会自动注入 content script 并重试；如果仍失败，刷新一次 LeetCode 题目页再读。

侧栏只会在用户主动打开过的 LeetCode 题目页 tab 上启用。切到普通网页 tab 时不会把 ACMCoder 侧栏继续带过去；切回之前打开过侧栏的题目 tab 时，扩展会按该 tab 的状态重新启用侧栏，但打开动作仍由用户点击扩展图标触发。这个状态保存在浏览器本地存储里以兼容不同 Edge 版本，关闭 tab 后会清理对应记录。

## 当前侧栏

侧栏不再展示整段题面。题目描述、约束和示例直接看左侧 LeetCode 页面；插件侧栏只保留练习需要的右侧工作区：

- 读取当前题目，并提取 `slug`、标题、难度、标签、题面正文和第一个样例。标题和标签优先从 LeetCode CN GraphQL 的 `translatedTitle`、`topicTags.translatedName` 读取。
- 记忆模式开启后，读取成功会自动写入本地记忆文件。
- 语言选择：Python、Java、C++17。
- 代码区：基础高亮、Tab 缩进、括号/引号补齐、回车缩进。
- 自测输入：`stdin` 和可选的预期输出。
- 本地运行：调用 `POST http://127.0.0.1:43117/api/run`，可选择 Local 或 Docker runner，展示 `stdout`、`stderr` 和 AC/WA/RE/CE 等状态。Docker runner 缺少本地镜像时会自动构建 `acmcoder-runner:local`，除非设置了 `ACMCODER_DOCKER_AUTO_BUILD=0`。
- 缓存：侧栏关闭或切页后，最近题目、代码、输入和预期输出会尽量恢复。

保存后，本地 ACMCoder Web 页面会轮询 `/api/memory/current` 并自动加载最新题目。

## 本地记忆文件

默认追加写入：

```text
E:\Projects\acmcoder\data\memory\pages.jsonl
```

最近一次读取会同步写入：

```text
E:\Projects\acmcoder\data\memory\current.json
```

`data/memory/` 已加入 `.gitignore`，这是本机用户数据，不应该提交。

## LLM API Key

侧栏里的 `LLM API Key` 当前只保存到浏览器本地存储，不会发送给任何远程服务。现在的读取、记忆和本地运行都不依赖 LLM。

后续更适合让 LLM 做这些事：

- 从 LeetCode 题面生成 ACM 输入输出协议。
- 生成更贴题的 Python/Java/C++ 初始代码。
- 根据 stderr/stdout 解释 WA/RE 原因。
- 从本地记忆文件生成题目摘要和标签。

## 技术边界

Edge 插件不能直接写 `E:\Projects\acmcoder\data\memory\pages.jsonl`。浏览器扩展被沙箱限制，不能任意写用户文件系统。

当前方案：

```text
Edge side panel
  -> content script 读取 LeetCode 页面和 GraphQL 题目信息
  -> POST http://127.0.0.1:43117/api/memory/pages
  -> Node 本地服务写入 data/memory/pages.jsonl 和 current.json
  -> ACMCoder Web 轮询 /api/memory/current 并自动加载
```

这比让插件直接碰文件系统更可控，也方便后续接入 LLM 或本地索引。
