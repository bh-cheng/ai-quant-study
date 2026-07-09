# Task 4 Turtle Strategy SPEC

## 1. 目标

实现一个可复现的海龟交易策略研究流程，用已有复权日线数据计算唐奇安通道、N 值、突破信号、退出信号、仓位和回测表现，并生成 Notebook、回测 CSV、图表和报告素材。

本任务重点是“趋势突破策略的规则化表达与回测验证”，不是投资建议。所有结论只能描述策略规则、历史回测结果和风险特征，不得写成买卖推荐。

## 2. 策略范围

海龟策略原版包含双突破系统、N 值波动率、按风险定仓、金字塔加仓和 2N 止损。考虑到本项目使用股票日线数据，Task 4 分为两个层级：

| 层级 | 范围 | 是否必做 |
| --- | --- | --- |
| 核心版 | 长-only 海龟策略：20 日突破入场、10 日跌破退出、20 日 N 值、2N 止损、按风险定仓 | 必做 |
| 增强版 | 55 日突破系统、20 日退出、0.5N 加仓、最多 4 个 unit、System 1 跳过规则 | 可选 |

默认先实现核心版。增强版可作为参数扩展或敏感性分析，不阻塞 Task 4 交付。

## 3. 输入数据

默认沿用 processed 层复权日线数据：

```text
data/processed/equities/daily/
```

默认股票池：

| 标的 | 文件 | 市场 | 价格口径 |
| --- | --- | --- | --- |
| 中芯国际港股 | `smic_h_00981_HK_daily_20250703_20260703.csv` | HK-share | `qfq_*` |
| 中芯国际 A 股 | `smic_a_688981_SH_daily_20250703_20260703.csv` | A-share | `qfq_*` |
| 比亚迪 A 股 | `byd_a_002594_SZ_daily_20250703_20260703.csv` | A-share | `qfq_*` |
| 比亚迪港股 | `byd_h_01211_HK_daily_20250703_20260703.csv` | HK-share | `qfq_*` |
| 长江电力 A 股 | `cypc_a_600900_SH_daily_20250703_20260703.csv` | A-share | `qfq_*` |

若继续使用 Task 3 中的中际旭创旧数据，也必须确认其包含 `qfq_open/qfq_high/qfq_low/qfq_close/qfq_pre_close` 字段。

必须使用复权字段计算策略：

| 用途 | 字段 |
| --- | --- |
| 开盘执行价 | `qfq_open` |
| 最高价 | `qfq_high` |
| 最低价 | `qfq_low` |
| 收盘确认价 | `qfq_close` |
| 前收盘价 | `qfq_pre_close` |

原始未复权字段 `open/high/low/close/pre_close` 只可用于审计，不得作为默认策略计算口径。

## 4. 输出文件

推荐目录结构：

```text
task4_turtle_strategy/
  SPEC.md
  turtle_strategy.py
  backtester.py
  build_task4_deliverables.py
  turtle_strategy_backtest.ipynb
  turtle_strategy_report.html
  outputs/
    {instrument_key}_{ts_code_with_underscore}_turtle_core_backtest.csv
    turtle_core_metrics_summary.csv
    turtle_core_metrics_summary.json
    figures/
      fig1_turtle_signals.png
      fig2_equity_drawdown.png
      fig3_multi_stock_metrics.png
      fig4_parameter_sensitivity.png
TASK4/
  程冰晖 TASK4.docx
  程冰晖 TASK4.pdf
  figures/
```

回测 CSV 至少包含：

```text
trade_date, date, ts_code, qfq_open, qfq_high, qfq_low, qfq_close,
tr, n_20,
entry_high_20, exit_low_10,
breakout_long, exit_long, stop_long,
stop_price, target_units, position_units, shares, cash,
trade_action, trade_reason, signal_date, execution_date,
execution_price, trade_value, fee, slippage_cost,
portfolio_value, strategy_return, benchmark_value, benchmark_return,
drawdown
```

## 5. 默认参数

核心版参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `entry_window` | `20` | 入场唐奇安通道周期 |
| `exit_window` | `10` | 退出唐奇安通道周期 |
| `n_window` | `20` | N 值周期 |
| `initial_cash` | `100000` | 初始资金，按单只股票独立回测 |
| `risk_per_unit` | `0.01` | 每个 unit 承担账户权益 1% 风险 |
| `stop_n` | `2.0` | 初始止损距离，入场价下方 2N |
| `max_units` | `1` | 核心版不加仓，最多 1 个 unit |
| `fee_rate` | `0.001` | 单边交易手续费 |
| `slippage_rate` | `0.0005` | 单边滑点 |
| `annual_periods` | `252` | 年化交易日 |
| `allow_fractional_shares` | `true` | 允许小数股，便于跨市场比较 |

增强版参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `entry_window_s1` | `20` | System 1 入场周期 |
| `exit_window_s1` | `10` | System 1 退出周期 |
| `entry_window_s2` | `55` | System 2 入场周期 |
| `exit_window_s2` | `20` | System 2 退出周期 |
| `add_unit_n` | `0.5` | 每上涨 0.5N 加 1 个 unit |
| `max_units` | `4` | 最多持有 4 个 unit |
| `use_s1_skip_rule` | `false` | 是否启用 System 1 盈利后跳过规则 |

## 6. 数据校验

读取每个 CSV 后必须执行以下检查：

1. `trade_date` 不重复，并按日期升序排列。
2. `ts_code` 在单文件内唯一。
3. `qfq_open/qfq_high/qfq_low/qfq_close/qfq_pre_close` 不为空。
4. `qfq_high >= max(qfq_open, qfq_close, qfq_low)`。
5. `qfq_low <= min(qfq_open, qfq_close, qfq_high)`。
6. `vol` 若存在，应大于等于 0；`amount` 缺失不阻断港股回测。
7. 行数必须足够覆盖最大窗口。核心版至少需要 `entry_window + n_window` 附近的预热样本；增强版若使用 55 日系统，至少需要 55 日以上样本。

若检查失败，应清楚输出失败文件、字段和样本行，不继续生成该标的回测。

## 7. 指标计算

### 7.1 真实波幅 TR

TR 使用复权高、低、前收：

```text
tr = max(
  qfq_high - qfq_low,
  abs(qfq_high - qfq_pre_close),
  abs(qfq_low - qfq_pre_close)
)
```

### 7.2 N 值

N 是海龟策略的波动率单位，默认使用 20 日 TR 平滑。

推荐使用原版海龟平滑口径：

```text
initial_n = mean(tr[0:20])
n_t = (19 * n_{t-1} + tr_t) / 20
```

如果实现上先使用 `rolling_mean(tr, 20)`，必须在 Notebook 和报告中说明这是 ATR 的简化口径。Task 4 默认推荐使用原版 N 值平滑。

输出字段：

```text
tr, n_20
```

### 7.3 唐奇安通道

为避免未来函数，所有通道都必须使用前一交易日以前的数据，即滚动计算后整体 `shift(1)`。

核心版：

```text
entry_high_20 = rolling_max(qfq_high, 20).shift(1)
exit_low_10 = rolling_min(qfq_low, 10).shift(1)
```

增强版：

```text
entry_high_55 = rolling_max(qfq_high, 55).shift(1)
exit_low_20 = rolling_min(qfq_low, 20).shift(1)
```

输出字段：

```text
entry_high_20, exit_low_10
```

增强版额外输出：

```text
entry_high_55, exit_low_20
```

## 8. 信号规则

### 8.1 默认执行时点

为了避免日内路径假设，Task 4 默认采用“收盘确认、下一交易日开盘执行”：

1. 第 `t` 日收盘后，根据 `qfq_close[t]` 与前一日已知通道判断信号。
2. 若产生交易指令，在第 `t+1` 个交易日用 `qfq_open[t+1]` 加滑点执行。
3. 最后一个交易日若产生信号但没有下一交易日，不执行，只记录未执行信号。

可选提供“盘中触发”模式，使用 `qfq_high > entry_high` 或 `qfq_low < exit_low` 判断触发，但必须明确这是基于日线 OHLC 的近似，不知道真实日内先后顺序。

### 8.2 入场

核心版长-only 入场规则：

```text
breakout_long = qfq_close > entry_high_20
```

当 `breakout_long = true`、当前无仓位、`n_20` 有效时，在下一交易日开盘买入 1 个 unit。

增强版双系统：

```text
system_1_long = qfq_close > entry_high_20
system_2_long = qfq_close > entry_high_55
```

System 2 信号优先级高于 System 1。若启用 `use_s1_skip_rule`，上一笔 System 1 交易盈利后，下一次 System 1 突破应跳过；System 2 不跳过。

### 8.3 退出

核心版退出规则：

```text
exit_long = qfq_close < exit_low_10
```

若 `exit_long = true` 且当前持仓大于 0，则下一交易日开盘全部卖出。

增强版中，System 2 持仓默认使用 20 日低点退出：

```text
exit_long_s2 = qfq_close < exit_low_20
```

### 8.4 止损

每笔入场后记录入场价 `entry_price` 和当时的 `entry_n`。

核心版止损价：

```text
stop_price = entry_price - 2 * entry_n
```

若 `qfq_close <= stop_price`，则下一交易日开盘全部卖出。若同一天同时出现通道退出和止损，以止损作为 `trade_reason`，但交易方向相同。

增强版加仓后，止损可采用两种口径，必须在配置中明确：

| 口径 | 说明 |
| --- | --- |
| `original_entry` | 所有 unit 共享初始入场价下方 2N 的止损 |
| `latest_unit` | 每次加仓后把整体止损抬到最近加仓价下方 2N |

默认使用 `latest_unit`，更贴近原版海龟的风险控制思想。

### 8.5 加仓

增强版启用加仓时，记录最后一次成交价 `last_unit_price`。当价格每向有利方向移动 `0.5N`，追加 1 个 unit：

```text
add_unit_long = qfq_close >= last_unit_price + 0.5 * entry_n
```

最多持有 `max_units = 4` 个 unit。加仓信号同样在下一交易日开盘执行。

## 9. 仓位与资金管理

核心版必须使用风险定仓，而不是简单满仓。

单个 unit 的股数：

```text
unit_risk_cash = current_equity * risk_per_unit
unit_shares = unit_risk_cash / (stop_n * n_20)
```

其中 `stop_n = 2.0` 时，表示若价格从入场价下跌 2N，理论亏损约等于 `current_equity * risk_per_unit`。

资金约束：

```text
max_affordable_shares = cash / (execution_price * (1 + fee_rate))
actual_shares = min(unit_shares, max_affordable_shares)
```

其中 `execution_price` 已经包含滑点，因此资金约束中只需要额外考虑手续费。

若 `allow_fractional_shares = false`，则 `actual_shares` 向下取整。跨 A 股和港股比较时建议保持 `true`，避免最小交易单位差异干扰策略规则。

每只股票独立回测，不做多标的组合资金分配。多股票结果只在 summary 层横向比较。

## 10. 回测口径

### 10.1 撮合价格

买入执行价：

```text
buy_price = next_qfq_open * (1 + slippage_rate)
```

卖出执行价：

```text
sell_price = next_qfq_open * (1 - slippage_rate)
```

手续费：

```text
fee = trade_value * fee_rate
```

滑点成本需要单独记录：

```text
buy_slippage_cost = shares * next_qfq_open * slippage_rate
sell_slippage_cost = shares * next_qfq_open * slippage_rate
```

### 10.2 组合净值

每日收盘后组合净值：

```text
portfolio_value = cash + shares * qfq_close
strategy_return = pct_change(portfolio_value)
```

买入持有基准：

```text
benchmark_value = initial_cash * qfq_close / first_valid_qfq_close
benchmark_return = pct_change(benchmark_value)
```

回撤：

```text
running_max = cummax(portfolio_value)
drawdown = portfolio_value / running_max - 1
```

### 10.3 同日信号优先级

如果同一日出现多个信号，按以下优先级处理：

1. 已持仓时：止损退出优先，其次通道退出，其次加仓。
2. 空仓时：System 2 入场优先于 System 1 入场。
3. 不允许同一标的同一天先卖后买，避免日线数据无法确认日内顺序的问题。

## 11. 绩效指标

每只股票和汇总表至少输出：

| 指标 | 字段 |
| --- | --- |
| 初始资金 | `initial_cash` |
| 最终净值 | `final_value` |
| 累计收益率 | `cumulative_return` |
| 年化收益率 | `annualized_return` |
| 年化波动率 | `annualized_volatility` |
| 最大回撤 | `max_drawdown` |
| Sharpe Ratio | `sharpe_ratio` |
| Calmar Ratio | `calmar_ratio` |
| 买入持有收益率 | `benchmark_cumulative_return` |
| 超额收益率 | `excess_return` |
| 持仓天数占比 | `exposure_ratio` |
| 交易次数 | `trade_count` |
| 完整交易笔数 | `round_trip_count` |
| 胜率 | `win_rate` |
| 平均单笔收益 | `average_trade_return` |
| 最大单笔亏损 | `worst_trade_return` |

若样本长度不足以可靠年化，Notebook 仍可计算年化指标，但必须标注样本为一年左右，结果主要用于横向比较。

## 12. Notebook 结构

`turtle_strategy_backtest.ipynb` 建议按以下章节组织：

1. 标题、任务目标和非投资建议声明。
2. 参数区：策略参数、资金参数、输出路径。
3. 数据读取与校验。
4. TR、N 值和唐奇安通道计算。
5. 核心版海龟信号生成。
6. 回测撮合、仓位和净值计算。
7. 单标的图表：价格、通道、买卖点、净值、回撤。
8. 多标的批量回测与绩效汇总。
9. 参数敏感性：例如入场/退出窗口组合 `20/10`、`30/15`、`55/20`。
10. 结果解读与策略局限。

必须明确写出：

```text
本 Notebook 使用复权后的 qfq_* 价格字段计算海龟策略。
通道和 N 值均使用前一交易日以前的数据，避免未来函数。
```

## 13. 可视化要求

至少生成四类图：

1. 复权收盘价 + 20 日入场通道 + 10 日退出通道 + 买卖点。
2. 策略净值 vs 买入持有基准 + 策略回撤。
3. 多标的绩效对比柱状图或热力图，包含累计收益、最大回撤、Sharpe。
4. 参数敏感性图，展示不同入场/退出窗口下的收益和回撤。

图表标题必须说明使用的是复权价格，并标注策略参数，例如：

```text
中芯国际港股 Turtle Core 20/10 Strategy Backtest, qfq price
```

## 14. 报告写作要求

Word 或 PDF 报告建议包含：

1. 策略原理：趋势突破、唐奇安通道、N 值和风险定仓。
2. 数据说明：标的、区间、复权口径、手续费和滑点。
3. 规则说明：入场、退出、止损、仓位和执行时点。
4. 单标的案例图：默认可选择中芯国际港股或 Task 3 使用过的中际旭创。
5. 多标的对比：A 股、港股和不同行业股票在同一规则下的表现差异。
6. 参数敏感性：讨论策略是否过度依赖某一组参数。
7. 局限性：样本期短、日线无法确认盘中路径、未考虑涨跌停/停牌/最小交易单位、费用简化。
8. 结论：只总结历史回测现象，不给出未来买卖建议。

## 15. 验收标准

一次合格交付必须满足：

1. `task4_turtle_strategy/SPEC.md` 存在。
2. 至少实现核心版 `20/10` 长-only 海龟策略。
3. 所有策略计算使用 `qfq_*` 字段。
4. 唐奇安通道和 N 值使用 `shift(1)` 或等价方法避免未来函数。
5. 回测包含手续费、滑点、风险定仓、止损和买入持有基准。
6. 至少对一个标的生成完整回测 CSV。
7. 至少对多个标的生成绩效汇总 CSV/JSON。
8. 至少生成四类图表。
9. Notebook 能从头到尾运行。
10. 报告不包含投资建议措辞，只描述规则和历史回测结果。

## 16. 后续扩展

可在不改变核心口径的前提下扩展：

- 同时实现原版 System 1 和 System 2。
- 启用 System 1 盈利后跳过规则。
- 实现最多 4 个 unit 的 0.5N 金字塔加仓。
- 加入做空版本，但仅用于可做空市场或理论研究。
- 加入组合级资金分配，例如多标的共享资金池和总风险上限。
- 加入交易单位约束，例如 A 股 100 股一手、港股不同 lot size。
- 加入涨跌停、停牌和成交量不足时无法成交的处理。
- 用 walk-forward 或滚动窗口检验参数稳定性。
