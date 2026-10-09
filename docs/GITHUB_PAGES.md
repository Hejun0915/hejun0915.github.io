# 发布个人主页

目标仓库：`Hejun0915/hejun0915.github.io`。成功部署后的网址：https://hejun0915.github.io/。

此目录为独立的公开发布副本，保留个人学术介绍、教育经历、经本人确认可公开的实习履历，以及公开论文和对应的项目、代码链接。实习履历包含单位、职位、时间、Logo 与概括性研究方向；工作邮箱及内部项目资料仍不公开。不要从私人工作目录整包覆盖回来。论文外链对应的作者单位等信息属于公开学术材料，不受个人联系方式脱敏规则影响。

## 提交前检查

```sh
DEPLOY_TARGET=github-pages npm run build
npm run check
npm run check:privacy
npm run test:privacy
npm run test:themes
node scripts/test-metrics.mjs
node scripts/test-preview.mjs
```

隐私检查覆盖源码、构建产物、图片元数据以及 Git 可达历史中的作者、提交者和文件。新图片仍需人工检查可见文字。构建先清空旧 `dist/`，防止废弃资源残留。

## 个人提交身份

本地仓库应显式设置个人身份，并启用提交和推送检查：

```sh
git config --local user.name Hejun0915
git config --local core.hooksPath .githooks
git config --local user.useConfigOnly true
git config --local --get user.email
git --no-pager log -1 --format=fuller
```

邮箱应是本人 GitHub 账号已添加并验证的个人邮箱，或从 GitHub Settings → Emails 复制的完整 noreply 地址。仅修改配置不会修改既有提交；推送前以日志中的 Author 和 Commit 为准。不要修改其他项目所需的全局身份。

## 上传到新建的空仓库

此仓库已配置 HTTPS origin。先确认 GitHub CLI 的账号与远程地址：

```sh
gh api user --jq .login
gh auth setup-git
git remote -v
git ls-remote --heads --tags origin
```

若需要登录，执行 `gh auth login --hostname github.com --git-protocol https --web --scopes workflow`。Git 提交身份与 GitHub 登录是两项独立配置。

确认远端是预期的新仓库后，提交后续修改并上传：

```sh
git status --short
git --no-pager log -1 --format=fuller
npm run check:privacy
env -u GIT_ASKPASS -u SSH_ASKPASS -u VSCODE_GIT_IPC_HANDLE git push -u origin main
```

最后一条命令避免使用已失效的编辑器凭据窗口。新建空仓库使用普通 push 即可；若远端已有不同历史，先核对，不使用强制推送覆盖。

## 开启 Pages

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。推送到 `main` 后由工作流构建并发布 `dist/`，不需要单独创建 `gh-pages` 分支。

如首次推送早于 Pages 启用，可在 Actions → Publish homepage → Run workflow 中重新运行。成功后访问网站。

不要提交环境变量文件、私有简历、内部文档、旧备份、缓存或生成的 `dist/`。只删除当前页面中的内容无法清除已经提交过的历史。

## 统计与域名

Pages 托管静态文件，不运行本地的 `/api/metrics` 服务。工作流定时尝试刷新公开统计；上游阻断或限流时保留最后成功的值与时间，不保证 Scholar 实时更新。

免费地址无需购买域名。自购域名可在 Pages 设置中验证所有权、配置 Custom domain、DNS 和 HTTPS。

## 官方资料

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address
