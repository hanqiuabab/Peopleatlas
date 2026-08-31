# AGENTS.md

本文件用于约束在本仓库中工作的 AI 编码代理。所有代理开始任务前应先阅读本文件、`RULES.md`、`REQUIREMENTS.md` 和 `PLAN.md`。

`PeopleAtlas/` 为独立 SwiftUI 原生项目，其技术基线与工作流程见该目录的 `AGENTS.md`；以下 React/TypeScript 规则针对网站。

## 项目目标

构建一个以节点和连线形式展示、维护人际关系的 Web 应用。人物是节点，关系是有方向或语义的边。

## 技术基线

- 前端：React、TypeScript、Vite。
- 当前阶段：纯前端工程；引入后端或数据库前必须先更新需求和计划。
- 领域模型放在 `src/domain/`，业务功能按领域放在 `src/features/`，跨模块复用内容放在 `src/shared/`。
- UI 文案默认使用简体中文；代码标识符使用英文。

## 工作流程

1. 开始前检查 `git status`，不得覆盖用户已有的未提交修改。
2. 对照 `REQUIREMENTS.md` 确认需求边界，并在 `PLAN.md` 中维护任务状态。
3. 优先做小而可验证的改动，不顺手扩展需求。
4. 完成代码后至少执行 `npm run typecheck`；涉及构建配置时执行 `npm run build`。
5. 若改变需求、架构或数据模型，应同步更新相应文档。

## 完成标准

- 类型检查通过，构建无错误。
- 新增交互具备清晰的空态、错误态或校验反馈。
- 人物或关系相关行为符合 `REQUIREMENTS.md` 的定义。
- `PLAN.md` 能真实反映已完成和待完成事项。
