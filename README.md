# AI Quant Study

中际旭创 `300308.SZ` 最近一年股价分析页面与可复现 Notebook。

## 内容

- `index.html`: 静态分析网页，适合部署到 GitHub Pages。
- `data/`: Tushare 日线行情 CSV，包含原始价格、复权因子和前复权价格。
- `notebooks/`: 复现数据分析与图表绘制的 Jupyter Notebook。

数据来源为 Tushare `daily` 与 `adj_factor` 接口。页面默认以前复权价格计算收益率、均线、波动率和回撤。内容仅用于研究分析，不构成投资建议。
