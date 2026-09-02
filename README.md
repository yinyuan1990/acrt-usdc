# ArcLaunch

Circle Arc（USDC 原生 gas 公链，2026-09-16 主网）上的代币发射与交易平台。对标 pons，全程美元计价，LP 永久锁定，创作者永久自动分润。

## 目录

```
docs/        Markdown 文档（调研、需求、UI 方案）与 UI 截图
web/         Next.js 前端（两套主题，网页 + 手机自适应）
contracts/   合约（待建：Foundry，LaunchFactory / LaunchToken / FeeLocker / Treasury + 自部署 Uniswap V3）
indexer/     索引器（待建）
```

## 文档

| 文件 | 内容 |
|---|---|
| [docs/01-调研结论.md](docs/01-调研结论.md) | pons 真实机制、Arc 链事实、技术路线结论 |
| [docs/02-需求文档-v1.md](docs/02-需求文档-v1.md) | 修正后的产品需求、参数表、合约清单、里程碑 |
| [docs/03-UI风格方案.md](docs/03-UI风格方案.md) | 两套风格定义与推荐 |
| `docs/screens/` | 全部页面 × 两套主题 × 桌面/手机 截图 |

## 前端

```bash
cd web
npm install
npm run dev          # http://localhost:3000
npm run build
node scripts/shots.mjs http://localhost:3000   # 重新生成 docs/screens 截图（需本机 Edge/Chrome）
```

- 主题：右上角 / 左侧栏切换，或 URL 加 `?theme=arc` / `?theme=terminal`
- 语言：`?lang=zh` / `?lang=en`
- 当前为 mock 数据；合约上测试网后接索引器 API

## 关键决定（2026-09-02）

- 直接进池（pons 式），不做 bonding curve、不做迁移
- 第一版自部署 Uniswap V3；官方 V4 主网上线后作为新 Factory 升级方向
- LP **锁定**而非销毁；手续费由 keeper 自动归集分发，保留兜底 claim
- 创建费可调可关（可为 0），支持白名单减免；分成比例发币时快照不可改
- 平台币 $ArcLaunch：国库 82% 回购销毁 / 18% 生态，比例 immutable
