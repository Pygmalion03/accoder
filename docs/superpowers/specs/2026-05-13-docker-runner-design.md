# ACCoder Docker Runner 设计方案

## 背景

当前 ACCoder 的 runner 直接调用用户本机的 `javac`、`g++` 和 `python`。这对已经配置好开发环境的用户很轻量，但对没有本地工具链的用户不友好。v2 引入 Docker runner，让用户只要安装 Docker，就可以在统一容器环境中编译和运行 Java、C++、Python 提交。

Docker runner 是一个显式运行模式，不替换现有本地 runner。默认仍然是 `local`，用户可以在 CLI 或 Web 中切换到 `docker`。

## 目标

- 保留现有本地 runner 行为，旧命令和旧 API 默认不变。
- 增加 `local` / `docker` 两种运行模式。
- CLI 支持 `--runner local|docker`。
- Web 支持运行模式选择，并通过 `/api/run` 传递 `runner` 字段。
- Docker 第一版使用项目内 Dockerfile，由用户本地构建 `accoder-runner:local` 镜像。
- Docker 运行时加入基础资源和访问限制，避免用户代码过度占用宿主机。
- Docker 不参与题目数据和判题规则，只影响编译运行环境。

## 非目标

- v2 不做远程在线判题。
- v2 不引入独立 Docker runner 服务。
- v2 不发布预构建 GHCR 镜像；这放到后续体验优化阶段。
- v2 不做复杂沙箱策略，例如 rootless Docker、seccomp 自定义 profile 或 user namespace 配置。
- v2 不改变题目数据结构和 ACM 输出比对规则。

## 架构

runner 层拆成公共编排和具体执行器：

```text
CLI / Web / extension sidebar
        ↓
runner: local | docker
        ↓
runSubmission()
        ↓
LocalRunner / DockerRunner
        ↓
统一返回 stdout、stderr、exitCode、timedOut、failedToStart
        ↓
runSubmission 做 CE/RE/TLE/AC/WA 判断
```

建议文件边界：

```text
src/runner/run.js             公共流程：准备源码、调用执行器、比对输出
src/runner/local-runner.js    本机 spawn 逻辑
src/runner/docker-runner.js   Docker 命令拼装和执行
src/runner/runners.js         runner 名称、默认值、选择和校验
```

`runSubmission()` 继续负责：

- 创建本次运行的临时目录。
- 写入或复制用户代码。
- 根据语言获取 toolchain。
- 调用选中的 runner 执行编译和运行。
- 将执行结果转换成 `AC`、`WA`、`RE`、`CE`、`TLE`、`UNKNOWN` 等业务状态。
- 清理临时目录。

LocalRunner 负责在宿主机执行命令。DockerRunner 负责把同样的 toolchain 命令转换成容器内命令，并通过 `docker run` 执行。

## CLI 和 API

CLI 新增可选参数：

```bash
node bin/accoder.js test two-sum --lang cpp --file main.cpp --runner docker
node bin/accoder.js run two-sum --lang python --file main.py --input input.txt --runner docker
```

不传 `--runner` 时默认 `local`。

Server 的 `/api/run` 接收：

```json
{
  "language": "cpp",
  "code": "...",
  "stdin": "...",
  "expected": "...",
  "runner": "docker"
}
```

不传 `runner` 时默认 `local`。

Web 增加一个运行模式控件，选项为 `Local` 和 `Docker`。控件只负责传值，不暴露 Docker 命令细节。

## Docker 镜像

第一版在仓库内提供 Dockerfile，用户本地构建：

```bash
docker build -t accoder-runner:local .
```

镜像至少包含：

- Java JDK，支持 `javac` 和 `java`。
- `g++`，支持 C++17。
- Python 3。
- `bash` 或兼容 shell。

Docker runner 默认使用镜像名 `accoder-runner:local`。后续可以通过配置项扩展镜像名，但 v2 先不做复杂配置。

## Docker 运行限制

Docker runner 运行命令时加入基础限制：

```bash
docker run --rm \
  --network none \
  --cpus 1 \
  --memory 256m \
  --pids-limit 128 \
  -v <tempDir>:/workspace \
  -w /workspace \
  accoder-runner:local \
  bash -lc "<compile-or-run-command>"
```

限制含义：

- `--network none`：刷题代码不需要联网，默认禁止网络访问。
- `--cpus 1`：限制 CPU 使用，避免死循环拖慢宿主机。
- `--memory 256m`：限制内存使用。
- `--pids-limit 128`：限制进程数量，降低 fork 类滥用风险。
- `--rm`：容器退出后自动删除。
- 只挂载本次临时目录到 `/workspace`，用户代码只能污染本次运行目录，结束后由 Node 删除。

第一版不把挂载目录设为只读，因为 Java/C++ 编译需要在工作目录写 `.class` 或可执行文件。

超时仍然由 Node 控制，沿用当前 runner 的 timeout 机制。超时后杀掉 `docker run` 进程，返回 `TLE`。

## 错误处理

Docker 模式需要给出比普通 `failedToStart` 更明确的提示：

- 找不到 `docker` 命令：返回运行器不可用，提示安装 Docker。
- Docker daemon 未启动：返回运行器不可用，提示启动 Docker Desktop。
- 镜像不存在：返回运行器不可用，提示执行 `docker build -t accoder-runner:local .`。
- 编译失败：返回 `CE`。
- 运行时异常：返回 `RE`。
- 超时：返回 `TLE`。
- 输出不一致：返回 `WA`。

建议新增 `NO_RUNNER` 状态表示运行器本身不可用。现有 `NO_TOOLCHAIN` 继续表示本机模式下缺少语言工具链。

## 测试策略

必须覆盖：

- 不传 runner 时默认走 `local`，旧 CLI/API 行为不变。
- CLI 可以解析 `--runner docker`。
- `/api/run` 会把 `runner` 字段传给运行层。
- Docker 命令拼装包含 `--network none`、`--cpus 1`、`--memory 256m`、`--pids-limit 128`。
- Docker 镜像不存在、Docker 不可用时返回明确错误。
- Web 能渲染运行模式选择，并把选择值带到运行请求。

真实 Docker e2e 测试可以作为可选测试，不作为默认 `npm test` 的硬依赖，避免没有 Docker 的开发机跑不动基础测试。

## 后续阶段

Docker runner 稳定后，增加 GitHub Container Registry 预构建镜像：

```text
ghcr.io/pygmalion03/accoder-runner:v2
```

届时补 GitHub Actions 自动构建和发布镜像，用户可以直接 pull 镜像，不需要在本地执行 Dockerfile build。这个阶段只优化用户体验，不改变 runner 抽象和 CLI/API 参数。
