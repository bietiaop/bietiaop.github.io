---
title: Github Workflow 编译、发布和部署 NextJS
date: 2025-03-07 13:32:23
updated: 2025-03-07 13:32:23
cover: https://sa.ffft.net/2025/8bc44835-cb37-7d90-0ea8-857e5c5f5e8a.png
categories:
  - 编程
  - 全栈
tags:
  - workflow
  - NextJS
  - actions
mathjax: false
---
每次打包部署 NextJS 都要经过 打包-上传-资源替换-重启pm2，要么就是 上传代码-打包-资源替换-重启pm2。这个过程切来切去很麻烦。

之前有过使用 Github Actions 的经历，在写 NapCat WebUI 的时候就尝试过使用 workflow 进行打包和发版。这次拿着以前的 workflow 配置复用一下，然后添加上部署的功能，这样写完代码直接 push，后面的过程 workflow 会完成的，我们只需要查看最终部署结果就可以了。其实这个过程就叫做 CI/CD。

> **持续集成（CI）**：开发人员将代码更改合并到一个共享仓库中，自动触发构建和测试过程，以早期发现问题。
> **持续交付（CD）或持续部署**：在CI的基础上，自动将代码更改交付到生产环境中。持续交付需要人工确认后部署，而持续部署则完全自动化。

## 需求

现在先理一下需求：

- 自动编译，每次 push 的时候都会触发编译
- 发版，当 `commit` 信息中包含 `release` 关键词的时候触发发版
- 部署，当 `commit` 信息中包含 `release` 关键词的时候触发部署

上面的流程是一个最基本的从上传代码到最终发版和部署。当然如果过程中需要进行单元测试、代码检测等也可以加入，不过 Github 针对私库提供了每个月 2000 分钟的免费额度，这些过程都会占用时间的，因此对我来说过程简略一些也是可以的，单元测试可以在代码提交过程中进行（例如使用 husky 在提交的时候进行单元测试），不过每次提交 commit 都要触发测试总是耗时的，而且对于小型项目基本上不需要进行单元测试。而代码质量检查我更倾向于在 pr 的时候进行检查，对于公开库，可以使用 [Sourcery AI](https://github.com/apps/sourcery-ai)，它是免费的。

上面三个步骤其中自动编译是每次 commit 都要执行的，这样每次代码更新都会有对应的构建产物下载部署（通常可以用在测试环境部署），我们可以再写一个步骤，当非 `release` 的 commit 时候，将产物部署到开发服务器，这个步骤与部署类似，只不过需要修改触发条件。这里就不做演示。

## 认识工作流

### 配置文件

Github 工作流文件一般存放在 `/.github/workflow/` 文件夹，以 yaml 配置文件形式存储。文件名没有要求。
### 名称

对于每个工作流，我们可以起一个名称，方便我们在 Actions 里面查看对应的工作流程进度等，在 Github Actions 里面看起来就像是这样：

![](Github%20Workflow%20编译、发布和部署%20NextJS/file-20250307115150398.png)

在 yml 文件中，我们可以通过 `name` 属性指定工作流的名称：

```yaml
name: "Build Action"
```

### 触发

根据官方文档「[触发工作流程 - GitHub 文档](https://docs.github.com/zh/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)」，我们可以指定触发工作流的事件。我们可以通过 `on` 属性指定触发工作流的事件。例如，我想在每次 push 的时候执行工作流，那么就可以这么写：

```yaml
on: push
```

我们也可以指定多个事件，当其中一个事件发生时，工作流也会触发：

```yaml
on: [push, fork]
```

更多的可以查看官方文档。我们这里使用 `push` 即可，因为我们每次推送都要进行编译。

最开始提到的三个过程我们可以拆分成三个工作流，例如：

- push 触发构建
- push 并且推送到 release 开头的分支触发编译
- push 并且推送到 deploy 开头的分支触发部署

当然后两个可以不仅是推送到某一个分支，也可以是包含某个 label，或者是 commit 信息关键词，这个取决于自己。

但是，毕竟私库总时长有限，因此这三个步骤我比较倾向于放在一个工作流，通过不同的任务进行分开。

### 环境变量

我们可以给工作流设置环境变量，而且这个环境变量可以从仓库中设置的环境变量中读取。

#### 设置仓库 Actions 环境变量

我们可以通过组织设置组织下所有仓库的共有环境变量，也可以单独给仓库设置环境变量。

首先进入仓库的设置页面，在左侧展开 “`Secrets and variables`“，并点击“`Actions`”：

![](Github%20Workflow%20编译、发布和部署%20NextJS/file-20250307120631958.png)

在上图页面中，我们可以看到两种变量：`Secrets` 和 `Variables`。密钥和变量允许您管理可重用的配置数据。密钥已**加密**并用于敏感数据。[详细了解加密密钥](https://docs.github.com/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets)。变量显示为纯文本，用于**非敏感**数据。 [详细了解变量](https://docs.github.com/actions/learn-github-actions/variables)。任何对仓库具有协作者访问权限的人都可以将这些密钥和变量用于 Actions。它们不会传递给由 fork 仓库的 pr 请求触发的工作流。

因此我们可以把敏感的数据存储在 Secrets 中，把非敏感的环境变量存放在 Variables 中。并且在工作流中，二者的使用方式也有所不同。在配置文件中，我们可以通过 `${{ secrets.KEY_NAME }}` 获取 `secrets` ，通过 `${{ vars.KEY_NAME }}` 获取 `variables`。

除此之外，我们还可以在工作流中定义变量，这样在整个工作流的过程中，我们都可以使用这个变量。我们可以通过 `env` 属性定义变量：

```yaml
env:
	NODE_ENV: production # 直接定义变量
	version: 0.0.0 # 直接定义变量
	# [!code word:${{ secrets.AUTH_SECRET }}]
	AUTH_SECRET: ${{ secrets.AUTH_SECRET }} # 获取 secrets 中的值
	# [!code word:${{ vars.SESSION_EXPIRES_IN }}]
	SESSION_EXPIRES_IN: ${{ vars.SESSION_EXPIRES_IN }} # 获取 variables 中的值
```

这样，我们就可以在需要的地方使用这些变量：`${{env.AUTH_SECRET}}`。因此我更倾向于将 `secrets` 和 `variables` 需要使用的变量放入 `env` 然后下面统一使用 `env` 即可。不用担心 `secrets` 会在工作流日志中打印出来，即使打印出来也是使用星号脱敏过的。

在下面提到的作业中，我们仍可以通过运行终端操作环境变量：

```yaml
jobs:
	Build:
		steps:
			- name: Set version
			  shell: bash
			  run: |
				commit_sha=$(git rev-parse --short HEAD)
				version=$(jq -r '.version' package.json)
			# [!code highlight:1]
				echo "version=${version}" >> $GITHUB_ENV
```

### 作业

#### name、needs

我们可以通过属性 `jobs` 来设置我们的工作流作业。`jobs` 里面可以定义多个作业，每个作业的 `key` 就是作业的名称，并且作业可以依赖于作业，例如，下图就是一个依赖关系：

![](Github%20Workflow%20编译、发布和部署%20NextJS/file-20250307133228545.png)

其中，`Deploy` 依赖于 `Create-Release` 作业，只有当 `Create-Release` 作业完成后，才会执行 `Deploy` 作业， `Create-Release` 作业依赖于 `Matrix: Build` 作业，只有当  `Matrix: Build` 内#的两个作业都完成后，才会执行 `Create-Release` 作业。

这种依赖关系，我们可以通过 `needs` 字段设置。以下就是上图依赖关系的配置：

```yaml
jobs:
	Build:
		# 其他配置
	Create-Release:
		needs: Build # [!code highlight]
		# 其他配置
	Deploy:
		needs: Create-Release # [!code highlight]
		# 其他配置
```

其中，`Build` 之所以在图中显示为 `Matrix: Build`，里面运行多个，是因为我使用了 `Matrix` 来配置多端部署。

再来个例子，如下图所示：

![](Github%20Workflow%20编译、发布和部署%20NextJS/file-20250307133856471.png)

其中代码为：

```yaml
jobs:
	Build:
		# 其他配置
	Create-Release:
		needs: Build # [!code highlight]
		# 其他配置
	Deploy:
		needs: Build # [!code highlight]
		# 其他配置
```

可以看到，`Create-Release` 和 `Deploy` 都依赖于 `Build`，因此这两个作业在 `Build` 完成后会同时执行。

#### runs-on

我们可以给每个作业指定运行的平台，例如我的 `Deploy` 作业需要运行在 `Ubuntu` 系统上，我们可以这样配置：

```yaml
jobs:
	Deploy:
		runs-on: ubuntu-latest # [!code highlight]
		# 其他配置
```

运行列表可以在 Github 上查看：[关于 GitHub 托管的运行程序 - GitHub 文档](https://docs.github.com/zh/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#viewing-available-runners-for-a-repository)。

如果指定内容为数组，则工作流程将在与所有指定 `runs-on` 值匹配的任何运行器上执行。例如，`Deploy` 将仅在具有标签 `linux`、`x64` 和 `gpu` 的自托管运行器上运行：

```yaml
jobs:
	Deploy:
		runs-on: [self-hosted, linux, x64, gpu] # [!code highlight]
```

注意，传递数组**并不是**说在数组里所有的机器上都运行。如果想要像上面的图片中那样在多个平台上运行，我们需要用到之前提到的 `Matrix`。

#### matrix strategy

按照官方文档说法：使用矩阵策略，可以在单个作业定义中使用变量自动创建基于变量组合的多个作业运行。 例如，可以使用矩阵策略在某个语言的多个版本或多个操作系统上测试代码。[在工作流中运行作业的变体 - GitHub 文档](https://docs.github.com/zh/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow)

这里官方文档说的比较清晰易懂，我直接复制过来，建议直接点击上面的链接看官方文档。

使用 `jobs.<job_id>.strategy.matrix` 定义不同作业配置的矩阵。 在矩阵中，定义一个或多个变量，后跟一个值数组。 例如，以下矩阵有一个称为 `version` 的变量，其值为 `[10, 12, 14]` ，以及一个称为 `os` 的变量，其值为 `[ubuntu-latest, windows-latest]`：

```yaml
jobs:
  example_matrix:
	 # [!code highlight:4]
    strategy:
      matrix:
        version: [10, 12, 14]
        os: [ubuntu-latest, windows-latest]
```

将针对变量的每个可能组合运行作业。 在此示例中，工作流将运行六个作业，其中一个作业用于每个 `os` 和 `version` 变量组合。

默认情况下，GitHub 将根据运行器的可用性最大程度地增加并行运行的作业数量。 矩阵中变量的顺序决定了作业的创建顺序。 定义的第一个变量将是在工作流运行中创建的第一个作业。 例如，上述矩阵将按以下顺序创建作业：

- `{version: 10, os: ubuntu-latest}`
- `{version: 10, os: windows-latest}`
- `{version: 12, os: ubuntu-latest}`
- `{version: 12, os: windows-latest}`
- `{version: 14, os: ubuntu-latest}`
- `{version: 14, os: windows-latest}`

矩阵在每次工作流运行时最多将生成 256 个作业。 此限制适用于 GitHub 托管和自托管运行器。

定义的变量将成为 `matrix` 上下文中的属性，你可以在工作流文件的其他区域中引用该属性。 在此示例中，可以使用 `matrix.version` 和 `matrix.os` 来访问作业正在使用的 `version` 和 `os` 的当前值。 有关详细信息，请参阅“[访问有关工作流运行的上下文信息](https://docs.github.com/zh/actions/learn-github-actions/contexts)”。

### [示例：使用单维矩阵](https://docs.github.com/zh/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow#example-using-a-single-dimension-matrix)

可以指定单个变量来创建单维矩阵。

例如，以下工作流使用值 `[10, 12, 14]` 定义变量 `version`。 工作流将运行三个作业，其中针对变量中的每个值提供一个作业。 每个作业都会通过 `matrix.version` 上下文访问 `version` 值，并此值作为 `node-version` 传递给 `actions/setup-node` 操作。

```yaml
jobs:
  example_matrix:
	# [!code highlight:3]
    strategy:
      matrix:
        version: [10, 12, 14]
    steps:
      - uses: actions/setup-node@v4
        with:
	      # [!code word:${{ matrix.version }}]
          node-version: ${{ matrix.version }}
```

### [示例：使用多维矩阵](https://docs.github.com/zh/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow#example-using-a-multi-dimension-matrix)

可以指定多个变量来创建多维矩阵。 将针对变量的每个可能组合运行作业。

例如，以下工作流指定两个变量：

- `os` 变量中指定的两个操作系统
- `version` 变量中指定的三个 Node.js 版本

工作流将运行六个作业，其中针对每个 `os` 和 `version` 变量组合提供一个作业。 每个作业都会将 `runs-on` 值设置为当前的 `os` 值，并将当前的 `version` 值传递给 `actions/setup-node` 操作。

```yaml
jobs:
  example_matrix:
	# [!code highlight:4]
    strategy:
      matrix:
        os: [ubuntu-22.04, ubuntu-20.04]
        version: [10, 12, 14]
	# [!code word:${{ matrix.os }}]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
		  # [!code word:${{ matrix.version }}]
          node-version: ${{ matrix.version }}
```

矩阵中的变量配置可以是 `object` 的 `array`。

```yaml
matrix:
  os:
    - ubuntu-latest
    - macos-latest
  node:
    - version: 14
    - version: 20
      env: NODE_OPTIONS=--openssl-legacy-provider
```

此矩阵生成具有相应上下文的 4 个作业。

```yaml
- matrix.os: ubuntu-latest
  matrix.node.version: 14
- matrix.os: ubuntu-latest
  matrix.node.version: 20
  matrix.node.env: NODE_OPTIONS=--openssl-legacy-provider
- matrix.os: macos-latest
  matrix.node.version: 14
- matrix.os: macos-latest
  matrix.node.version: 20
  matrix.node.env: NODE_OPTIONS=--openssl-legacy-provider
```

### [示例：使用上下文创建矩阵](https://docs.github.com/zh/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow#example-using-contexts-to-create-matrices)

可以使用上下文来创建矩阵。 有关上下文的详细信息，请参阅“[访问有关工作流运行的上下文信息](https://docs.github.com/zh/actions/learn-github-actions/contexts)”。

例如，以下工作流触发事件 `repository_dispatch`，并使用事件有效负载中的信息来生成矩阵。 使用如下所示的有效负载创建存储库调度事件时，矩阵 `version` 变量的值为 `[12, 14, 16]`。 有关 `repository_dispatch` 触发器的详细信息，请参阅“[触发工作流的事件](https://docs.github.com/zh/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)”。

```json
{
  "event_type": "test",
  "client_payload": {
    "versions": [12, 14, 16]
  }
}
```

```yaml
on:
  repository_dispatch:
    types:
      - test
 
jobs:
  example_matrix:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        version: ${{ github.event.client_payload.versions }} # [!code highlight]
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.version }} # [!code highlight]
```

#### if

我们可以对作业的运行设置条件，这个条件就是通过 `if` 属性来设置的。例如 `Release` 和 `Deploy` 必须在 `commit` 信息含有 `release` 关键词的时候才运行，此时我们可以这么写：

```yaml
Deploy:
	if: contains(github.event.head_commit.message, 'release') # [!code highlight]
	# 其他配置
```

这样写，只有在 `commit` 信息包含 `release` 的时候才会执行 `Deploy`。

#### steps

每个作业都有一个操作流程，也是执行流程，它跟我们写程序的流程一样，这里称作“步骤（Steps）”。我们使用 `steps` 属性来指定流程。我们下面会讲到这么几个配置：`name`、`uses`、`with`、`run`、`working-directory`、`shell`、`if`。

##### name

顾名思义，`name` 就是步骤名称。这个名称将会以以下形式在 Github Actions 网页内呈现：

![](Github%20Workflow%20编译、发布和部署%20NextJS/file-20250307142416483.png)

##### working-directory

`working-directory` 就是执行目录。我们可以指定当前步骤在哪个目录执行。

##### run

我们可以通过 `run` 来定义我们所要运行的命令：

```yaml
jobs:
	Deploy:
		# 其他配置
		steps:
			- name: Create .env file
			  working-directory: deploy-package # 执行目录
			  # [!code highlight:5]
			  run: |
					touch .env
					echo "AUTH_SECRET=${{ env.AUTH_SECRET }}" >> .env
					echo "SESSION_EXPIRES_IN=${{ env.SESSION_EXPIRES_IN }}" >> .env
					echo "AUTH_GITHUB_ID=${{ env.AUTH_GITHUB_ID }}" >> .env
```

除此之外，我们还可以指定运行“什么”，例如使用 `node` 运行 `index.js` 文件：

##### if

我们可以通过 `if` 来决定是否执行步骤：

```yaml
- name: Install zip (macOS)
  if: matrix.os == 'macos-15' # [!code highlight]
  run: brew install zip
```
 
##### shell

我们可以通过 `shell` 属性指定步骤中 `run` 运行在哪个终端上，例如：

```yaml
jobs:
	Deploy:
		# 其他配置
		steps:
			- name: Create .env file
			  shell: bash # [!code highlight]
```

##### uses

我们可以通过 `uses` 来使用网上开源的操作。例如，我们需要 `node` 和 `pnpm` 环境（即安装 node 和 pnpm），我们可以通过使用 `run` 直接运行 `shell` 命令安装，也可以用网上开源的，具有兼容性的开源操作库：

```yaml
jobs:
	Build:
		runs-on: ${{ matrix.os }}
		strategy:
			matrix:
			os: [ubuntu-latest, macos-15]
		steps:
			- name: Use pnpm
			  uses: pnpm/action-setup@v4 # [!code highlight]
			  with:
				version: 10
			- name: Use Node.js 20
			  uses: actions/setup-node@v4 # [!code highlight]
			  with:
				node-version: 20
				cache: 'pnpm'
```

##### with

在使用开源操作库时，有时需要我们传入参数，这就好比我们调用函数传入参数一样，或者启动应用程序要写配置文件一样，我们就是通过 `with` 进行配置的，通常参数格式为 `key-value`。如上面的代码所示，在使用 `pnpm` 和 `node` 环境时，我们就通过 `with` 传入参数指定版本和其他配置。

当然还有更多的配置，可以到官方文档查看。[GitHub Actions 的工作流语法 - GitHub 文档](https://docs.github.com/zh/actions/writing-workflows/workflow-syntax-for-github-actions)
## 实现

有了以上的前提知识，我们可以直接来写了。首先是环境变量。

### 触发器、环境变量

由于我使用的是 AuthJS 进行鉴权，在环境变量里面我需要定义 `secret`、`trust_host` 和 Github OAuth 的一些配置。除此之外，我还需要连接数据库、定义对接的后端地址等。因此环境变量如下：

```yaml
name: "Build Action"
on:
	push:
		branches:
			- main
env:
	version: 0.0.0 # 此处用于发布构建时的版本号
	NODE_ENV: production
	AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
	SESSION_EXPIRES_IN: ${{ secrets.SESSION_EXPIRES_IN }}
	AUTH_GITHUB_ID: ${{ secrets.AUTH_GITHUB_ID }}
	AUTH_GITHUB_SECRET: ${{ secrets.AUTH_GITHUB_SECRET }}
	MYSQL_URL: ${{ secrets.MYSQL_URL }}
	REDIS_HOST: ${{ secrets.REDIS_HOST }}
	REDIS_PORT: ${{ secrets.REDIS_PORT }}
	REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}
	REDIS_USERNAME: ${{ secrets.REDIS_USERNAME }}
	BACKEND_URL: ${{ secrets.BACKEND_URL }}
	AUTH_TRUST_HOST: ${{ secrets.AUTH_TRUST_HOST }}
	DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
	DEPLOY_USERNAME: ${{ secrets.DEPLOY_USERNAME }}
	DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
	DEPLOY_PORT: ${{ secrets.DEPLOY_PORT || 22 }}
```

### 作业

#### 构建

我们构建的流程是这样的：

- 签出仓库（访问仓库）
- 解析版本号并设置到环境变量
- 安装 `node` 和 `pnpm` 环境
- 安装依赖并构建
- 从工作流上传文件
- 打包成压缩包
- 上传压缩包提供给发版使用

代码如下：

```yaml
  Build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-15]
    steps:
	  # 1. 签出仓库
      - name: Clone Main Repository
        uses: actions/checkout@v4
        with:
          ref: main
          token: ${{ secrets.TOKEN }}
      # 2. 设置版本号
      - name: Set version
        shell: bash
        run: |
          commit_sha=$(git rev-parse --short HEAD)
          version=$(jq -r '.version' package.json)
          echo "version=${version}" >> $GITHUB_ENV
      # 3. 安装 pnpm 和 node 环境
      - name: Use pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
      - name: Use Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      # 4. 安装依赖并打包
      - name: Build DataPlatform
        run: |
          pnpm install
          pnpm build
      # 5. 上传打包好的文件
      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
	      # [!code word:include-hidden-files: true]
          include-hidden-files: true
          name: dist-${{ matrix.os }}
          path: |
            .next/
            public/
            prisma/
            next.config.ts
            .env.sample
            package.json
            pnpm-lock.yaml
      # 安装压缩程序
      - name: Install zip (Ubuntu)
        if: matrix.os == 'ubuntu-latest'
        run: sudo apt-get install -y zip
      - name: Install zip (macOS)
        if: matrix.os == 'macos-15'
        run: brew install zip
      # 压缩文件
      - name: Compress subdirectories
        shell: bash
        run: |
          zip -q -r dist-${{ matrix.os }}.zip .next/ prisma/ public/ next.config.ts .env.sample package.json pnpm-lock.yaml
      # 上传压缩文件供发版使用（也可以提供给其他人在工作流里下载）
      - name: Upload Assets for Release
        uses: actions/upload-artifact@v4
        if: contains(github.event.head_commit.message, 'release')
        with:
	      # [!code word:include-hidden-files: true]
          include-hidden-files: true
          name: release-artifacts-${{ matrix.os }}
          path: dist-${{ matrix.os }}.zip
          retention-days: 1
```

其中值得注意的是，上传打包好的文件并不用上传一些源代码，但是如果你用到了 `prisma`，那你需要上传它的建模，否则在服务器安装依赖并运行的时候会提示找不到客户端文件。其次，`next.config.ts` 文件也是必须的，否则无法运行 NextJS 程序，其他依赖该装的也得装，因此我就把整个 `package.json` 都打包进去，在服务器安装依赖即可。

第二点是上传文件不会上传忽略的文件和文件夹（例如点开头的文件夹 `.next`）。因此我们需要通过传入参数 `include-hidden-files: true`来配置。

#### 发版

在构建完成后，我们就可以进行发版，在这里我不需要写发版更新日志，因此做了最简单的方法，如果你有写发版更新日志的要求，可以在网上参考一下其他配置。

```yaml
  Create-Release:
    needs: Build
    if: contains(github.event.head_commit.message, 'release')
    runs-on: ubuntu-latest
    steps:
	  # 签出仓库并获取版本信息
      - name: Clone Repository for Version Info
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.TOKEN }}
      - name: Set version
        shell: bash
        run: |
          version=$(jq -r '.version' package.json)
          echo "version=${version}" >> $GITHUB_ENV
      # 下载上传的压缩包
      - name: Download All Artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: release-artifacts-*
          path: release-artifacts
      # 发版（没有设置更新日志）
      - name: Create Release and Upload Artifacts
        uses: softprops/action-gh-release@v1
        with:
          name: dist-v${{ env.version }}
          tag_name: v${{ env.version }}
          token: ${{ secrets.TOKEN }}
          files: |
            release-artifacts/release-artifacts-ubuntu-latest/dist-ubuntu-latest.zip
            release-artifacts/release-artifacts-macos-15/dist-macos-15.zip
```

#### 部署

```yaml
  Deploy:
    needs: Build
    if: contains(github.event.head_commit.message, 'release')
    runs-on: ubuntu-latest
    steps:
      # 下载上传的压缩包
      - name: Download Build Artifact
        uses: actions/download-artifact@v4
        with:
          name: dist-ubuntu-latest
          # 将文件解压到这个目录方便在这个目录创建env文件并一键打包
          path: deploy-package
	  # 创建 .env 文件供 nextjs 使用
      - name: Create .env file
        # 设置工作目录为刚才打包的路径
        working-directory: deploy-package
        run: |
          touch .env
          echo "AUTH_SECRET=${{ env.AUTH_SECRET }}" >> .env
          echo "SESSION_EXPIRES_IN=${{ env.SESSION_EXPIRES_IN }}" >> .env
          echo "AUTH_GITHUB_ID=${{ env.AUTH_GITHUB_ID }}" >> .env
          echo "AUTH_GITHUB_SECRET=${{ env.AUTH_GITHUB_SECRET }}" >> .env
          echo "MYSQL_URL=${{ env.MYSQL_URL }}" >> .env
          echo "REDIS_HOST=${{ env.REDIS_HOST }}" >> .env
          echo "REDIS_PORT=${{ env.REDIS_PORT }}" >> .env
          echo "REDIS_PASSWORD=${{ env.REDIS_PASSWORD }}" >> .env
          echo "REDIS_USERNAME=${{ env.REDIS_USERNAME }}" >> .env
          echo "BACKEND_URL=${{ env.BACKEND_URL }}" >> .env
          echo "AUTH_TRUST_HOST=${{ env.AUTH_TRUST_HOST }}" >> .env
      # 压缩文件：注意高亮那一行为什么最后用 `.` 打包，因为这样可以吧 .next .env 这样带点的文件和目录打包进去，否则是被忽略的
      - name: Prepare for Deployment
        run: |
          cd deploy-package
        # [!code highlight:1]
          tar -czf ../deployment.tar.gz .
          ls -la  # 打印一下看看文件列表对不对
      # 上传文件到服务器
      - name: Copy Deployment Package
        uses: appleboy/scp-action@master
        with:
          host: ${{ env.DEPLOY_HOST }}
          username: ${{ env.DEPLOY_USERNAME }}
          key: ${{ env.DEPLOY_SSH_KEY }}
          port: ${{ env.DEPLOY_PORT}}
          source: "deployment.tar.gz"
          target: "/tmp/"
      # 在服务器执行脚本安装依赖并部署
      - name: Install & Restart Application
        uses: appleboy/ssh-action@master
        with:
          host: ${{ env.DEPLOY_HOST }}
          username: ${{ env.DEPLOY_USERNAME }}
          key: ${{ env.DEPLOY_SSH_KEY }}
          port: ${{ env.DEPLOY_PORT }}
          script: |
            # 如果目标部署目录不存在，则创建
            mkdir -p /data/dataplatform
            # 备份旧版本（如果存在）
            if [ -d "/data/dataplatform/current" ]; then
              # 特殊处理public目录，将其单独备份
              if [ -d "/data/dataplatform/current/public" ]; then
                echo "Backing up public directory..."
                mkdir -p /data/dataplatform/public_backup
                cp -ra /data/dataplatform/current/public/. /data/dataplatform/public_backup/
              fi
              mv /data/dataplatform/current /data/dataplatform/backup_$(date +%Y%m%d%H%M%S)
            fi
            # 创建新的部署目录
            mkdir -p /data/dataplatform/current
            
            # 解压部署包到临时目录
            mkdir -p /tmp/dataplatform-deploy
            tar -xzf /tmp/deployment.tar.gz -C /tmp/dataplatform-deploy
            
            # 复制新文件到部署目录（包括隐藏文件）
            cp -ra /tmp/dataplatform-deploy/. /data/dataplatform/current/
            
            # 恢复备份的public目录内容（如果存在）
            if [ -d "/data/dataplatform/public_backup" ]; then
              echo "Restoring public directory contents..."
              mkdir -p /data/dataplatform/current/public
              cp -ra /data/dataplatform/public_backup/. /data/dataplatform/current/public/
              rm -rf /data/dataplatform/public_backup
            fi
            
            # 进入部署目录
            cd /data/dataplatform/current
            
            # 确保 Node.js 和 npm 已安装
            if ! command -v node &> /dev/null; then
              echo "Node.js not found, installing..."
              curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
              sudo apt-get install -y nodejs
            fi
            
            # 确保 pnpm 全局安装
            if ! command -v pnpm &> /dev/null; then
              echo "pnpm not found, installing..."
              npm install -g pnpm
            fi
            
            # 确保 PM2 全局安装
            if ! command -v pm2 &> /dev/null; then
              echo "PM2 not found, installing..."
              npm install -g pm2
            fi
            
            # 获取所有命令的绝对路径
            NODE_PATH=$(which node)
            PNPM_PATH=$(which pnpm)
            PM2_PATH=$(which pm2)
            
            echo "Using node from: $NODE_PATH"
            echo "Using pnpm from: $PNPM_PATH"
            echo "Using pm2 from: $PM2_PATH"
            
            # 确保node_modules存在
            if [ ! -d "node_modules" ]; then
              echo "Installing dependencies..."
              $PNPM_PATH install
            else
              echo "node_modules already exists, skipping installation"
            fi
            
            # 使用 PM2 启动或重启应用
            if $PM2_PATH list | grep -q "dataplatform"; then
              echo "Restarting existing PM2 service..."
              $PM2_PATH restart dataplatform
            else
              echo "Creating new PM2 service..."
              cd /data/dataplatform/current
              $PM2_PATH start --name "dataplatform" --cwd /data/dataplatform/current "pnpm run start"
            fi
            
            # 保存 PM2 配置以便在服务器重启后自动启动
            $PM2_PATH save
            
            # 设置 PM2 开机启动（可能需要sudo权限）
            $PM2_PATH startup
            
            # 清理临时文件
            rm -rf /tmp/dataplatform-deploy
            rm -f /tmp/deployment.tar.gz
            
            # 记录部署信息
            echo "Deployed version $(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]') at $(date)" >> /data/dataplatform/deploy_history.log
            
            # 检查并显示隐藏文件，以确认它们被正确部署
            echo "Checking for important hidden files:"
            ls -la /data/dataplatform/current/
```

在使用上面这个作业前请设置好远程服务器的 ssh，你可以在本地生成一个公私钥，将私钥内容存入 `secrets` 环境变量，其余要配置的还有 `host`、`port` 等。

首先我们要下载构建好的代码文件（不是压缩包），然后新建环境变量文件，这个文件是用于服务器部署时生成 `prisma` 的客户端文件以及服务器的一些配置。

最后通过 scp 上传文件到服务器，然后 ssh 远程连接服务器进行备份、解压、文件替换、依赖安装、pm2 启动和重启等操作，最终完成平台的部署。