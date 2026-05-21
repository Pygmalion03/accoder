# ACMCoder 部署现状

## 本地启动

适合开发者或已经有 Node.js 的用户。

```bash
npm install
npm start
```

打开：

```text
http://127.0.0.1:43117
```

这个模式下，Local runner 会扫描宿主机的 `python`、`javac/java`、`g++`。如果用户没有对应语言环境，但安装了 Docker Desktop，可以在页面里切到 Docker runner。

## 只有 Docker 的用户

现在已经有应用容器：

```bash
docker compose up --build
```

打开：

```text
http://127.0.0.1:43117
```

这条路不要求用户本机安装 Node.js、Java、C++ 或 Python。容器里的 Local runner 已经带了 `python3`、`g++`、`openjdk`，所以页面里选择 Local 就能运行代码。记忆题目、AC 次数、模型设置会通过 `./data/memory:/app/data/memory` 持久化到宿主机。

## 两类 Docker 镜像的区别

`Dockerfile` 是 runner 镜像。它服务于“本机启动 Web，然后运行代码时选择 Docker runner”的场景。默认镜像名是 `acmcoder-runner:local`，缺失时会自动构建。

`Dockerfile.app` 是应用镜像。它服务于“用户只有 Docker，也想直接打开 ACMCoder Web”的场景。它把 Node 服务和 Java/C++/Python 工具链都放在一个容器里，因此不需要在容器里再调用 Docker runner。

## 环境扫描

Web 和 Edge 侧边栏现在都会调用：

```text
GET /api/doctor
```

它会返回本地 Java/C++/Python 工具链、Docker runner 状态，以及每种语言推荐使用 Local 还是 Docker。用户没有保存过运行模式时，页面会按当前语言自动采用推荐模式；用户手动选择后，以用户选择为准。

## 模型建议

模型能力是可选项，不参与判题，也不会覆盖源代码。

接口：

```text
GET  /api/assist/settings
POST /api/assist/settings
POST /api/assist
```

默认按 OpenAI-compatible `chat/completions` 接口调用。用户可以在 Web 或插件里填写 API Key、Base URL 和 Model。设置保存到 `data/memory/settings.json`，这个目录已被 git 忽略。也可以用环境变量：

```text
ACMCODER_LLM_API_KEY
ACMCODER_LLM_BASE_URL
ACMCODER_LLM_MODEL
```

## 仍然不够顺的地方

从零用户现在至少需要安装 Docker Desktop，并在项目目录里运行 `docker compose up --build`。这比要求 Node/Java/C++/Python 低很多，但还不是“一键安装”。

下一步更值得做的是发布预构建镜像，例如 `ghcr.io/<owner>/acmcoder-app:v1` 和 `ghcr.io/<owner>/acmcoder-runner:v1`。这样用户可以跳过本地 build，只运行 `docker compose up` 或一条 `docker run`。

再往后可以补安装脚本或桌面打包，但优先级低于预构建镜像。桌面打包会增加维护成本，而且代码执行沙箱仍然要认真处理。
