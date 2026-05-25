# ACCoder 设计方案

## 产品定位

ACCoder 是一个基于 LeetCode 题目索引的开源本地 ACM 训练项目。它不做 LeetCode 替代品，也不在仓库中分发完整 LeetCode 题面；第一版只维护题目索引、LeetCode 链接、ACM 输入输出协议、样例和语言模板。

核心价值是把常见的 LeetCode 函数式题目转换成可以用标准输入输出练习的 ACM 模式，让用户在本地完成真实编译、运行和输出比对。

## 第一版范围

第一版只做本地可运行闭环：

- 维护 5 道种子题，覆盖数组、字符串、栈、动态规划等常见类别。
- 每道题包含标题、LeetCode slug、难度、标签、输入输出协议和样例。
- 提供 CLI：列题、看题、检测环境、运行固定样例、运行自定义输入。
- 提供本地 Web：展示题单、题目详情、代码编辑区、自定义输入、运行结果。
- 支持 Java、C++、Python 三种语言。
- 运行结果由本地真实工具链产生，不使用 LLM 作为裁判。

暂不做：

- 自动抓取 LeetCode 页面。
- 浏览器插件。
- Docker 沙箱。
- 远程在线判题。
- 用户系统、排行榜、题解社区。

## 数据边界

题目数据采用项目内 JSON 和独立样例文件管理。LeetCode 只作为原题入口，仓库中不保存完整原题题面，避免把项目变成题库搬运。

每道题至少包含：

- `slug`：项目内稳定 ID，同时复用 LeetCode slug。
- `frontendId`：LeetCode 展示题号。
- `title`：题目标题。
- `difficulty`：难度。
- `tags`：标签。
- `rank.frequency`：项目内排序权重。
- `leetcode.url`：原题链接。
- `acm.inputFormat` 和 `acm.outputFormat`：自己维护的 ACM 协议。
- `cases`：固定样例路径。

## Runner 设计

Runner 是项目核心，负责真实运行用户代码：

1. 根据语言选择工具链。
2. 对 Java/C++ 做编译，对 Python 直接执行。
3. 把样例或用户输入写入 stdin。
4. 捕获 stdout、stderr 和退出码。
5. 对 stdout 与 expected output 做 ACM 风格比对。
6. 输出 `AC`、`WA`、`RE`、`CE`、`TLE` 或 `UNKNOWN`。

第一版使用本机工具链：

- Java：`javac` + `java Main`
- C++：`g++`
- Python：`python`

如果用户本机没有对应命令，`doctor` 命令会给出明确提示。Docker 和预置工具链后续再加。

## Web 设计

Web 不是营销页，而是工作台：

- 左侧是题单和筛选。
- 中间是题目 ACM 协议、样例和代码编辑区。
- 右侧是运行结果、stdout、stderr、状态。

Web 通过本地 Node 服务调用同一个 runner，避免浏览器自己执行 Java/C++。这样后续浏览器插件也可以复用同一个 HTTP API。

## LLM 定位

LLM 不参与判题。后续可以作为可选能力：

- 根据 LeetCode 页面辅助生成 ACM 输入输出包装。
- 根据编译错误、运行错误、WA 差异解释原因。
- 生成边界测试。
- 帮用户把函数式解法改写成 `Main` 入口。

判题结果必须来自真实编译和运行。

## 后续阶段

第二阶段：

- 增加 Docker runner。
- 增加更多题目和贡献规范。
- 完善 LeetCode 题目转换流程。

第三阶段：

- 浏览器插件识别 LeetCode slug。
- 插件侧边栏展示 ACM Mode。
- 插件调用 `127.0.0.1` 本地 runner 服务。

第四阶段：

- 可选接入本地 LLM，辅助生成 ACM 包装和解释错误。
