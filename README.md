<p align="center">
  <img src="logo.png" alt="PT-Gen Logo" width="200">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/github/languages/top/rabbitwit/PT-Gen-Refactor" alt="GitHub top language">
  <img src="https://img.shields.io/badge/Used-JavaScript%20React-blue.svg" alt="Used">
</p>

# PT-Gen-Refactor

这是一个基于 Cloudflare Worker 和 React 的应用程序，用于生成 PT (Private Tracker) 资源描述。支持从多个平台（如豆瓣、IMDb、TMDB、Bangumi、Melon、Steam等）获取媒体信息，并生成标准的 PT 描述格式。

## 重要提醒

豆瓣近期更新的反爬机制，增加了挑战算法，经测试如不登录使用 Cookie 是无法获取信息，但是如使用 Cookie 不知道会不会封禁账号，请各位自行斟酌！

## 支持的平台

| 平台 | 类型 | 需要 API 密钥 | 备注 |
|------|------|---------------|------|
| 豆瓣 (Douban) | 电影、电视剧、读书 | 否 | 可选 Cookie 以获取更多信息 |
| IMDb | 电影、电视剧 | 否 | - |
| TMDB | 电影、电视剧 | 是 | 需要在环境变量中配置 API 密钥 |
| Bangumi | 动画 | 否 | - |
| Melon | 音乐 | 否 | 韩国音乐平台 |
| Steam | 游戏 | 否 | - |
| 红果短剧 (HongGuo) | 短剧 | 否 | 支持 WEB 端和 APP 的链接 |
| QQ 音乐 | 音乐 | 否 | 支持 QQ 音乐 WEB 的专辑链接 (必须提供 Cookie) |
| TraktTV | 电影、电视剧 | 是 | 需要在环境变量中配置 Client ID 和 APP NAME |

## DEMO 预览

<a href="https://pt-gen.Jerold.dpdns.org" target="_blank">
  <img src="https://img.shields.io/badge/Demo-Click%20Here-blue?style=for-the-badge" alt="Demo">
</a>

## 功能特性

- 支持从多个平台获取媒体信息：
  - 豆瓣 (Douban) - 电影、电视剧、读书
  - IMDb (Internet Movie Database)
  - TMDB (The Movie Database)
  - Trakt - 电影、电视剧
  - Bangumi (番组计划)
  - Melon (韩国音乐平台)
  - Steam (游戏平台)
  - 红果短剧 (短剧平台)
  - QQ 音乐 (中国音乐平台)
- 自动生成标准 PT 描述格式
- 响应式 React 前端界面
- 基于 Cloudflare Worker 的后端服务
- 支持多种媒体类型（电影、电视剧、音乐、游戏等）
- 智能搜索功能（根据关键词语言自动选择搜索平台）
- 请求频率限制和恶意请求防护
- 多种缓存存储（R2 或 D1 数据库，避免重复抓取相同资源，提高响应速度）

## 环境要求

- Node.js (推荐版本 16+)
- npm 或 yarn

---

## 安装与设置

### 克隆项目

```bash
git clone https://github.com/jeroldtsao/PT-Gen-Refactor.git
cd PT-Gen-Refactor
```

### 安装依赖

```bash
# 安装根目录依赖（包含 wrangler）
npm install

# 安装 Worker 依赖
cd worker && npm install && cd ..

# 安装前端依赖（如不需要前端界面，请忽略此步骤）
cd frontend && npm install && cd ..
```

---

## 本地开发调试

### 配置环境

复制 `wrangler.toml.example` 为 `wrangler.toml` 并配置必要的环境变量：

```bash
cp wrangler.toml.example wrangler.toml
```

编辑 `wrangler.toml`，配置以下参数：

```toml
[vars]
AUTHOR = "Jerold"
LOG_LEVEL = "debug"          # 开发环境建议使用 debug
ENABLED_CACHE = "false"      # 开发环境建议禁用缓存
API_KEY = "your_api_key"     # 可选，保护 API 接口
TMDB_API_KEY = "your_tmdb_api_key"  # 搜索功能必需
```

> **注意**: `wrangler.toml` 已加入 `.gitignore`，敏感信息不会被提交到 Git。

### 启动服务

项目使用 monorepo 结构，需要分别启动前后端服务：

**启动后端 API (Cloudflare Worker)**:

```bash
cd worker
npm install          # 首次运行需要安装依赖
npm run dev          # 启动开发服务器
```

后端默认运行在 `http://localhost:8787`

**启动前端 (React + Vite)**:

```bash
cd frontend
npm install          # 首次运行需要安装依赖
npm run dev          # 启动开发服务器
```

前端默认运行在 `http://localhost:5173`

### 测试 API

后端启动后，可以直接测试 API 接口：

```bash
# 测试搜索功能
curl "http://localhost:8787/api?query=Magic%20Mike&key=your_api_key"

# 测试豆瓣解析
curl "http://localhost:8787/api?url=https://movie.douban.com/subject/35267208/&key=your_api_key"
```

### 开发脚本汇总

| 命令 | 说明 |
|------|------|
| `npm run sync-version` | 同步版本号到所有相关文件 |
| `npm run dev` | 同步版本 + 启动 Worker 开发服务器 |
| `npm run dev:frontend` | 启动前端开发服务器 |
| `npm run build` | 同步版本 + 构建前端生产版本 |
| `npm run deploy` | 构建前端 + 部署 Worker 到 Cloudflare |
| `npm run release` | 完整发布流程（同步版本 + 构建 + 部署） |

> **提示**: 前端开发时会自动代理 API 请求到后端服务器（见 `frontend/.env` 配置）

### 版本维护

**单一版本来源原则**：项目版本号统一在根目录 `package.json` 的 `version` 字段维护。

同步脚本会自动更新以下位置：
- `worker/src/core/constants.js` - 后端版本常量
- `frontend/package.json` - 前端版本号（Vite 构建时注入）
- `VERSION.md` - 版本文档标题

**发布新版本流程**：
1. 更新根目录 `package.json` 的 `version` 字段
2. 运行 `npm run sync-version` 同步版本
3. 更新 `VERSION.md` 添加版本更新说明
4. 运行 `npm run release` 构建并部署

---

## 部署

### 配置 Cloudflare

1. 注册或登录 [Cloudflare](https://www.cloudflare.com/) 账户
2. 获取 Cloudflare API Token（用于部署 Worker）
3. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```
4. 登录 Wrangler：
   ```bash
   npx wrangler login
   ```

### 创建存储资源

本项目支持两种缓存存储方式：R2 对象存储和 D1 数据库。您可以选择其中一种或同时使用两种。

**方式一：创建 R2 存储桶**

R2 是 Cloudflare 提供的对象存储服务，本项目使用 R2 来缓存已抓取的数据，避免重复请求相同的资源。

1. 登录 Cloudflare 控制台
2. 导航到 R2 页面
3. 创建一个新的存储桶，命名为 `pt-gen-cache`
4. 确保存储桶名称与 `wrangler.toml` 文件中配置的 `bucket_name` 一致

**方式二：创建 D1 数据库**

D1 是 Cloudflare 提供的分布式数据库服务，您也可以使用 D1 作为缓存存储。

1. 登录 Cloudflare 控制台
2. 导航到 D1 页面
3. 创建一个新的数据库，命名为 `pt-gen-cache`
4. 获取数据库 ID 并在 `wrangler.toml` 文件中配置

**初始化 D1 数据库表**

创建数据库后，您需要手动创建缓存表：

```bash
npx wrangler d1 execute pt-gen-cache --command "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, timestamp INTEGER NOT NULL);"
```

或在 Cloudflare 控制台执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);
```

### 配置环境变量

编辑根目录下的 `wrangler.toml` 文件：

```toml
name = "pt-gen-refactor"  # Worker 名称，可自定义

# 前端静态资源绑定（如不需要前端界面，请注释整个 [assets] 块）
[assets]
directory = "./frontend/dist"
binding = "ASSETS"

[vars]
AUTHOR = "Jerold"
LOG_LEVEL = "none"
ENABLED_CACHE = "true"

# 可选配置（敏感信息应使用 Secrets）
# API_KEY = "your_api_key"
# TMDB_API_KEY = "your_tmdb_api_key"
# DOUBAN_COOKIE = "your_douban_cookie"
# QQ_COOKIE = "your_qq_music_cookie"
# TRAKT_API_CLIENT_ID = "your_trakt_client_id"
# TRAKT_APP_NAME = "your_trakt_app_name"
# AUTH_SECRET = "your_auth_secret"

# 缓存配置（推荐 R2）
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "pt-gen-cache"

# D1 数据库配置（可选，与 R2 二选一）
# [[d1_databases]]
# binding = "DB"
# database_name = "pt-gen-cache"
# database_id = "your_database_id"
```

使用命令添加 Secrets：`wrangler secret put VARIABLE_NAME`

**前端环境变量**

复制 `frontend/.env.example` 为 `frontend/.env`：

```bash
cp frontend/.env.example frontend/.env
```

配置 `AUTH_SECRET`：

```env
VITE_AUTH_SECRET=your_auth_secret  # 必须与 wrangler.toml 中的 AUTH_SECRET 一致
```

> **安全提示**: `AUTH_SECRET` 是前后端认证的关键，请妥善保管，不要提交到 Git。

**环境变量说明**

| 环境变量 | 是否必需 | 默认值 | 说明 |
|----------|----------|--------|------|
| `AUTHOR` | 否 | - | 作者信息，用于标识资源描述的生成者 |
| `API_KEY` | 否 | - | 安全 API 密钥，用于保护 API 接口 |
| `TMDB_API_KEY` | 否* | - | TMDB API 密钥，如果需要使用 TMDB 功能则必需 |
| `DOUBAN_COOKIE` | 否 | - | 豆瓣 Cookie，用于获取更多豆瓣信息 |
| `QQ_COOKIE` | 否* | - | QQ音乐 Cookie，如需要使用 QQ 音乐信息则必需 |
| `TRAKT_API_CLIENT_ID` | 否* | - | Trakt API Client ID，如需要使用 Trakt 功能则必需 |
| `TRAKT_APP_NAME` | 否* | - | Trakt APP NAME，如需要使用 Trakt 功能则必需 |
| `ENABLED_CACHE` | 否 | `true` | 是否启用缓存功能 |

> *注意：如果要使用中文搜索功能，必须配置 TMDB_API_KEY，否则只能使用英文进行搜索（调用 IMDb）。

### 部署到 Cloudflare

**前置准备**

```bash
# 登录 Cloudflare
npx wrangler login

# 如使用 R2 缓存，创建存储桶
npx wrangler r2 bucket create pt-gen-cache

# 如使用 D1 缓存，创建数据库
npx wrangler d1 create pt-gen-cache
npx wrangler d1 execute pt-gen-cache --command "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, timestamp INTEGER NOT NULL);"
```

**完整部署（前后端一体）**

```bash
# 1. 构建前端
cd frontend && npm run build && cd ..

# 2. 部署到 Cloudflare
npm run deploy
```

部署成功后会输出访问地址：

```
Published pt-gen-refactor
  https://pt-gen-refactor.your-subdomain.workers.dev
```

**单独部署后端**

如果只需要后端 API（前端部署到其他平台如 Vercel/EdgeOne）：

```bash
# 注释 wrangler.toml 中的 [assets] 块
npm run deploy
```

**GitHub Actions 手动部署**

项目提供 `.github/workflows/build-worker.yml`，只支持手动触发，不会在 `push` 时自动部署。Actions 会使用 `wrangler.ci.toml` 作为部署配置。

1. 在 GitHub 仓库进入 `Settings` → `Secrets and variables` → `Actions`
2. 添加以下 Repository secrets：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需要 Workers Scripts 编辑/发布权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

3. 进入 `Actions` → `Deploy Worker` → `Run workflow`
4. 选择分支后点击 `Run workflow`，Actions 会构建前端并执行 `wrangler deploy`

> Worker 运行时变量（如 `API_KEY`、`TMDB_API_KEY`、`DOUBAN_COOKIE`、`AUTH_SECRET`）建议在 Cloudflare 控制台的「变量和机密」中配置，避免写入仓库。

**使用预构建 bundle（无本地构建环境）**

从 [build 分支](https://github.com/jeroldtsao/PT-Gen-Refactor/tree/build) 下载 `bundle.js`：

1. 重命名为 `index.js`
2. 上传到 Cloudflare Worker 控制台
3. 在「变量和机密」中添加所需环境变量

---

## API 接口

### 基础说明

- 所有接口都需要携带 `key` 参数（如果配置了 `API_KEY`）
- 支持 GET 和 POST 两种请求方式
- POST 请求需设置 `Content-Type: application/json`

### 路径说明

根据部署方式不同，API 路径有所区别：

| 部署方式 | API 路径 | 示例 |
|----------|----------|------|
| **只部署后端** | `/{endpoint}` | `/?url=https://movie.douban.com/subject/35267208/` |
| **前后端一起部署** | `/api/{endpoint}` | `/api?url=https://movie.douban.com/subject/35267208/` |

> **说明**：以下文档以「前后端一起部署」为例，如果只部署后端，请将 `/api` 改为 `/`。

### 图片代理接口

用于代理获取外部图片资源，解决防盗链问题：

```
GET /img?url={image_url}&key=your_api_key
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 图片 URL（豆瓣、Steam 等平台图片） |
| `key` | string | 条件 | API 密钥（如配置了 API_KEY 则必填） |

**示例**：

```
GET /img?url=https://img9.doubanio.com/view/photo/l/public/p2929427346.webp&key=your_api_key
```

### 数据获取接口

#### 方式一：URL 方式（传入完整链接）

直接传入平台资源链接，系统自动识别平台并解析：

```
GET /api?url={resource_url}&key=your_api_key
POST /api?key=your_api_key
Body: {"url": "{resource_url}"}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | string | 是 | 平台资源链接 |

**支持的平台链接格式**：

| 平台 | 链接格式 | 示例 |
|------|----------|------|
| 豆瓣电影 | `https://movie.douban.com/subject/{id}/` | `/api?url=https://movie.douban.com/subject/35267208/&key=your_api_key` |
| 豆瓣读书 | `https://book.douban.com/subject/{id}/` | `/api?url=https://book.douban.com/subject/38229491/&key=your_api_key` |
| IMDb | `https://www.imdb.com/title/{id}/` | `/api?url=https://www.imdb.com/title/tt1915581/&key=your_api_key` |
| TMDB | `https://www.themoviedb.org/{type}/{id}` | `/api?url=https://www.themoviedb.org/movie/191&key=your_api_key` |
| Bangumi | `https://bgm.tv/subject/{id}` | `/api?url=https://bgm.tv/subject/333890&key=your_api_key` |
| Steam | `https://store.steampowered.com/app/{id}/` | `/api?url=https://store.steampowered.com/app/1091500/&key=your_api_key` |
| Trakt | `https://trakt.tv/{type}/{slug}` | `/api?url=https://trakt.tv/shows/breaking-bad&key=your_api_key` |

#### 方式二：Source + ID 方式（指定平台和资源ID）

指定平台和资源 ID 获取数据，支持 GET 和 POST 请求：

**请求方式**：

| 方法 | 格式 |
|------|------|
| GET | `/api?source={platform}&sid={id}&type={type}&key=your_api_key` |
| POST | `/api?key=your_api_key`（Body: JSON 格式） |

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | 平台名称：douban, imdb, tmdb, bangumi, steam, trakt |
| `sid` | string | 是 | 资源 ID |
| `type` | string | 条件 | 媒体类型（TMDB 必填: movie/tv，Trakt 必填: movies/shows） |
| `key` | string | 条件 | API 密钥（如配置了 API_KEY 则必填） |

**各平台示例**：

| 平台 | GET 请求 | POST 请求 (Body) |
|------|----------|------------------|
| 豆瓣 | `/api?source=douban&sid=35267208&key=your_api_key` | `{"source":"douban","sid":"35267208"}` |
| IMDb | `/api?source=imdb&sid=tt1915581&key=your_api_key` | `{"source":"imdb","sid":"tt1915581"}` |
| TMDB 电影 | `/api?source=tmdb&sid=191&type=movie&key=your_api_key` | `{"source":"tmdb","sid":"191","type":"movie"}` |
| TMDB 电视剧 | `/api?source=tmdb&sid=1396&type=tv&key=your_api_key` | `{"source":"tmdb","sid":"1396","type":"tv"}` |
| Bangumi | `/api?source=bangumi&sid=333890&key=your_api_key` | `{"source":"bangumi","sid":"333890"}` |
| Steam | `/api?source=steam&sid=1091500&key=your_api_key` | `{"source":"steam","sid":"1091500"}` |
| Trakt 电影 | `/api?source=trakt&sid=independence-day-1996&type=movies&key=your_api_key` | `{"source":"trakt","sid":"independence-day-1996","type":"movies"}` |
| Trakt 电视剧 | `/api?source=trakt&sid=breaking-bad&type=shows&key=your_api_key` | `{"source":"trakt","sid":"breaking-bad","type":"shows"}` |

> **注意**：TMDB 和 Trakt 必须提供 `type` 参数！

### 搜索接口

根据关键词搜索媒体资源，支持 GET 和 POST 请求：

**请求方式**：

| 方法 | 格式 |
|------|------|
| GET | `/api?query={keyword}&source={platform}&key=your_api_key` |
| POST | `/api?key=your_api_key`（Body: JSON 格式） |

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索关键词（中文/英文） |
| `source` | string | 否 | 搜索平台：douban, imdb, tmdb（不指定则自动选择） |
| `key` | string | 条件 | API 密钥（如配置了 API_KEY 则必填） |

**自动选择规则**（不指定 source 时）：
- 中文关键词 → 豆瓣搜索（失败回退 TMDB）
- 英文关键词 → IMDb 搜索（失败回退 TMDB）

**示例**：

| 场景 | GET 请求 | POST 请求 (Body) |
|------|----------|------------------|
| 中文自动搜索 | `/api?query=流浪地球&key=your_api_key` | `{"query":"流浪地球"}` |
| 英文自动搜索 | `/api?query=Magic Mike&key=your_api_key` | `{"query":"Magic Mike"}` |
| 豆瓣搜索 | `/api?source=douban&query=流浪地球&key=your_api_key` | `{"source":"douban","query":"流浪地球"}` |
| IMDb 搜索 | `/api?source=imdb&query=Independence Day&key=your_api_key` | `{"source":"imdb","query":"Independence Day"}` |
| TMDB 搜索 | `/api?source=tmdb&query=流浪地球&key=your_api_key` | `{"source":"tmdb","query":"流浪地球"}` |

### 媒体 ID 桥接接口

用于在 IMDb ID、豆瓣 ID、片名之间进行桥接查询。

**请求方式**

| 方法 | 路径 |
|------|------|
| GET | `/api/media-id-bridge?{query_params}&key=your_api_key` |
| POST | `/api/media-id-bridge?key=your_api_key`（Body: JSON 格式） |

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imdbid` | string | 条件 | IMDb 标题 ID，例如 `tt0111161` |
| `doubanid` | string | 条件 | 豆瓣条目 ID，例如 `1292052` |
| `name` | string | 条件 | 电影/剧集名称，支持中英文 |
| `year` | string | 否 | 年份过滤，仅在 `name` 查询时使用，格式 `YYYY` |
| `key` | string | 条件 | API 密钥（如配置了 API_KEY 则必填） |

> `imdbid`、`doubanid`、`name` 三者至少提供一个；优先级为 `imdbid` > `doubanid` > `name`。
> 配置 `TMDB_API_KEY` 后，`imdbid` 查询会优先通过 TMDB 官方 External ID 接口精确匹配 movie/tv，再回查豆瓣搜索补充 `doubanid`，可覆盖 WMDB 搜索索引缺失的条目。

**调用示例**

| 场景 | GET 示例 | POST Body 示例 |
|------|----------|----------------|
| IMDb ID 查询 | `/api/media-id-bridge?imdbid=tt0111161&key=your_api_key` | `{"imdbid":"tt0111161"}` |
| 豆瓣 ID 查询 | `/api/media-id-bridge?doubanid=1292052&key=your_api_key` | `{"doubanid":"1292052"}` |
| 名称查询 | `/api/media-id-bridge?name=消失的人&key=your_api_key` | `{"name":"消失的人"}` |
| 名称 + 年份 | `/api/media-id-bridge?name=消失的人&year=2005&key=your_api_key` | `{"name":"消失的人","year":"2005"}` |

**返回格式**

```json
{
  "success": true,
  "error": null,
  "version": "1.0.9",
  "generate_at": 0,
  "copyright": "Powered by @Jerold",
  "site": "media_id_bridge",
  "query_type": "imdbid",
  "data": [
    {
      "doubanid": 1292052,
      "imdbid": "tt0111161",
      "name": "肖申克的救赎",
      "year": "1994",
      "tmdbid": 278,
      "tmdbtype": "movie"
    }
  ]
}
```

> **注意**：IMDb 搜索可能触发 WAF 保护，建议配置 `TMDB_API_KEY` 作为 IMDb ID 查询和英文搜索的回退方案。

### 响应格式

所有接口返回统一的 JSON 格式：

```json
{
  "success": true,
  "error": null,
  "format": "生成的 PT 描述文本",
  "version": "1.0.8",
  "generate_at": 1778562206625,
  "copyright": "Powered by @Jerold",
  "data": [],
  "site": "douban",
  "sid": "35267208"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 请求是否成功 |
| `error` | string/null | 错误信息 |
| `format` | string | 生成的 PT 描述格式文本 |
| `data` | array | 搜索结果数组（搜索接口） |
| `site` | string | 数据来源平台 |
| `sid` | string | 资源 ID |

---

## 新增功能亮点

- **豆瓣信息增强**：豆瓣资源现在包含演员和导演的图片信息
- **更丰富的元数据**：提供更完整的媒体信息用于 PT 站点发布
- **性能优化**：改进了数据抓取和处理逻辑
- **多种缓存选择**：支持 R2 对象存储和 D1 数据库两种缓存方式
- **静态数据缓存**：新增对豆瓣、IMDb、Bangumi 和 Steam 平台的静态数据缓存支持 [PtGen Archive](https://github.com/ourbits/PtGen)

### getStaticMediaDataFromOurBits

该函数用于从 OurBits 的静态数据源获取媒体信息，作为 API 调用失败时的备选方案。

```javascript
getStaticMediaDataFromOurBits(source, sid)
```

**参数说明**：

- `source`: 媒体来源平台，如 "douban"、"imdb"、"bangumi"、"steam" 等
- `sid`: 媒体资源的唯一标识符

**返回值**：返回从静态数据源获取的媒体信息对象，如果所有数据源都不可用则返回 null。

当环境变量 `ENABLED_CACHE` 设置为 "false" 时，各平台的数据获取函数会优先尝试从此静态数据源获取数据。

---

## 使用说明

### 平台使用限制

| 平台 | 限制说明 |
|------|----------|
| 豆瓣 | 需要 Cookie 才能获取完整信息；频繁请求会触发反爬机制 |
| IMDb | 搜索功能可能触发 WAF 保护，建议配置 TMDB_API_KEY 作为回退 |
| TMDB | 必须配置 TMDB_API_KEY；Params 方式需要 type 参数（movie/tv） |
| Trakt | 必须配置 TRAKT_API_CLIENT_ID 和 TRAKT_APP_NAME；需要 type 参数（movies/shows） |
| QQ音乐 | 必须配置 QQ_COOKIE |
| 搜索功能 | 中文搜索需要 TMDB_API_KEY（豆瓣→TMDB 回退）；英文搜索需要 TMDB_API_KEY（IMDb→TMDB 回退） |

### 参数要求汇总

| 参数 | 适用场景 | 说明 |
|------|----------|------|
| `key` | 全局 | 如配置了 API_KEY，所有请求必须携带此参数 |
| `type` | TMDB/Trakt | TMDB: movie 或 tv；Trakt: movies 或 shows |
| `url` | URL方式 | 平台资源完整链接 |
| `source` | Params方式 | 平台名称（douban/imdb/tmdb/bangumi/steam/trakt） |
| `sid` | Params方式 | 资源 ID |
| `query` | 搜索 | 搜索关键词（中文/英文） |

### 快速使用流程

1. 启动应用后，访问前端地址（默认 `https://pt-gen-refactor.your-subdomain.workers.dev`）
2. 输入媒体资源的链接或 ID
3. 系统将自动获取并生成标准 PT 描述（豆瓣资源包含演员/导演图片信息）
4. 复制生成的描述用于 PT 站点发布

---

## 感谢

- 感谢 [Rhilip/pt-gen-cfworker](https://github.com/Rhilip/pt-gen-cfworker) 提供部分逻辑参考。

## 许可证

本项目采用 MIT 许可证。详情请查看 [LICENSE](LICENSE) 文件。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=rabbitwit/PT-Gen-Refactor&type=Date)](https://star-history.com/#rabbitwit/PT-Gen-Refactor&Date)

## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 版本更新说明

有关详细的版本更新历史，请参阅 [VERSION.md](VERSION.md) 文件。
