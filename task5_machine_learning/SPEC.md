# Task 5 股票机器学习研究 SPEC

## 1. 目标与范围

在已有股票日线研究基础上，补充获取 2018-01-01 至运行时最近可得交易日的数据，构建一套可复现、无未来信息泄漏、参数可配置的机器学习实验流程。

本任务最终应在一个 Jupyter Notebook 中按步骤完成：数据读取与校验、探索性分析、标签构造、特征工程、时间序列划分、模型训练、验证、最终测试、指标比较、图表展示和结论说明。

Notebook 必须设计成可复用的通用股票机器学习模板，而不是绑定本项目当前五只股票。以后导入任意符合最低字段要求的单只或多只股票日线数据，通过修改顶部配置即可选择数据、股票、预测任务和机器学习算法，不应修改后续核心代码单元格。

计划研究五类算法：

1. 线性回归（回归任务）
2. 逻辑回归（分类任务）
3. 决策树（回归与分类）
4. 随机森林（回归与分类）
5. KNN（回归与分类）

研究只用于教学和历史数据分析，不构成投资建议。最终测试集在模型与参数确定前不得用于调参、特征筛选或阈值选择。

## 2. 交付物

推荐目录结构：

```text
task5_machine_learning/
  SPEC.md
  stock_ml_study.ipynb
  config.yaml
  outputs/
    metrics_validation.csv
    metrics_test.csv
    predictions_validation.csv
    predictions_test.csv
    figures/
data/
  raw/
  processed/equities/daily/
  reports/
```

本次仅创建本 SPEC。后续实施阶段的主要代码必须完整写入 `stock_ml_study.ipynb`，并按单元格逐步解释；配置可集中保存在 Notebook 顶部，也可由 `config.yaml` 读取，但 Notebook 必须显示本次实际运行参数。

Notebook 应同时支持两种使用方式：

1. 教学模式：按章节逐个运行单元格，查看每一步的中间结果与解释。
2. 模板模式：只修改顶部配置，然后使用统一主函数完成从数据加载到评估输出的完整流程。

## 3. 股票范围

默认沿用此前数据规范中的五个证券：

| instrument_key | 公司 | 代码 | 市场 | 数据源优先级 |
| --- | --- | --- | --- | --- |
| `smic_a` | 中芯国际 | `688981.SH` | A 股 | Tushare MCP/接口 |
| `smic_h` | 中芯国际 | `00981.HK` | 港股 | Tushare；无权限时使用已批准的港股备用源 |
| `byd_a` | 比亚迪 | `002594.SZ` | A 股 | Tushare MCP/接口 |
| `byd_h` | 比亚迪股份 | `01211.HK` | 港股 | Tushare；无权限时使用已批准的港股备用源 |
| `cypc_a` | 长江电力 | `600900.SH` | A 股 | Tushare MCP/接口 |

股票池必须可通过配置启用或停用。不得将不同证券、不同市场或不同货币的价格水平直接拼接后当作同一条时间序列。

中芯国际 A 股于 2018 年之后才上市，因此该标的只能从实际首个有效交易日开始；不得补造 2018 年以来不存在的记录。所有模型和指标必须同时报告证券代码、实际样本起止日和样本数。

上述五只证券是本次默认演示数据，不是 Notebook 的硬编码限制。新数据中的证券代码和证券数量应从配置或数据内容动态识别。

## 3.1 通用数据导入接口

Notebook 至少支持：

- 单个 CSV 文件中的一只股票。
- 单个 CSV 文件中的多只股票。
- 一个目录中的多个股票 CSV 文件。
- 已加载到内存中的 `pandas.DataFrame`。

统一入口建议设计为：

```python
load_stock_data(
    source,
    input_format="auto",
    column_mapping=None,
    selected_symbols=None,
)
```

`source` 可以是文件路径、目录路径或 DataFrame。加载后必须转换为统一的内部字段，不允许后续模型代码直接依赖某个数据供应商的专有列名。

外部数据最低需要日期和 OHLC；成交量推荐提供：

```text
date, open, high, low, close[, volume]
```

多股票数据还需要一个证券标识字段：

```text
symbol
```

通过 `column_mapping` 支持常见列名映射，例如：

```python
column_mapping = {
    "trade_date": "date",
    "ts_code": "symbol",
    "qfq_open": "open",
    "qfq_high": "high",
    "qfq_low": "low",
    "qfq_close": "close",
    "vol": "volume",
}
```

若输入只有未复权价格，Notebook 可以继续运行，但必须显示醒目提示并将 `price_adjustment_status` 标记为 `unknown_or_raw`；不得声称其结果使用了前复权口径。

## 4. 数据获取与存储

### 4.1 时间范围

- `start_date`: `2018-01-01`
- `end_date`: 运行时相应数据源最近可得的完整交易日
- `frequency`: 日线
- `timezone`: `Asia/Shanghai`
- `price_adjustment`: 前复权（`qfq`）

“最近”是动态值。每次运行必须在元数据中记录请求截止日、实际最后交易日、数据源和获取时间。若数据源当天数据尚未完整发布，应使用前一个完整交易日。

### 4.2 获取要求

1. 优先复用项目已有取数流程和相应 MCP/数据接口，按市场获取日线、复权因子和交易日历。
2. 对现有一年数据执行增量补充或全区间重建；合并时以 `ts_code + trade_date` 去重。
3. raw 层保留原始响应；processed 层输出标准化、日期升序的复权日线。
4. processed 输出继续遵守根目录 `STOCK_DATA_SPEC.md` 的字段、复权和校验规则。
5. 禁止静默混用不同复权口径；若数据源切换，必须记录在 metadata 中并检查重叠区间的一致性。

### 4.3 必要字段

至少需要：

```text
instrument_key, company_key, market, exchange, currency, ts_code,
trade_date, qfq_open, qfq_high, qfq_low, qfq_close, qfq_pre_close,
vol, amount
```

允许保留原始行情和复权因子用于审计。港股备用源没有 `amount` 时可为空，但缺失情况必须记录。

### 4.4 数据校验

- `ts_code + trade_date` 唯一且日期严格升序。
- OHLC 不为空并满足最高价、最低价关系。
- 价格为正，成交量非负。
- 检查重复日期、异常跳变、复权断点、缺失值和无成交记录。
- 按对应市场交易日历检查覆盖率；停牌不应被误判为普通缺失。
- 输出每只证券的实际起止日期、行数、缺失字段和校验状态。

## 5. 预测任务与标签

Notebook 同时实现回归和二分类任务，两者使用同一个可配置预测周期 `forecast_horizon`，默认预测下一个交易日（`1`）。

### 5.1 回归标签

默认标签为未来一期复权收盘收益率：

```text
target_return_t = qfq_close[t + horizon] / qfq_close[t] - 1
```

不建议直接预测未来绝对价格，因为不同证券价格尺度不可比且非平稳性更强。若课堂要求预测收盘价，可通过配置切换为 `future_close`，但默认评估仍以未来收益率为准。

### 5.2 分类标签

默认使用同一未来收益率构造涨跌标签：

```text
target_up_t = 1 if target_return_t > classification_threshold else 0
```

默认 `classification_threshold = 0.0`。阈值必须可配置，也可在训练/验证数据上设为覆盖交易成本的正阈值；不得参考最终测试集确定阈值。

### 5.3 标签边界处理

- 每只证券最后 `forecast_horizon` 行没有未来标签，必须删除。
- 标签必须在特征计算完成后按证券分别向未来移动。
- 任何包含 `t+1` 或更晚信息的字段都不得出现在日期 `t` 的特征中。

## 6. 特征工程

默认候选特征仅使用日期 `t` 收盘时已经知道的信息：

| 类别 | 默认特征示例 |
| --- | --- |
| 收益率 | 1、5、10、20 日历史收益率 |
| 趋势 | SMA 5/10/20/60、价格相对均线、均线差 |
| 动量 | RSI(14)、MACD(12,26,9)、KDJ（可选） |
| 波动率 | 10/20 日收益率标准差、ATR(14)、振幅 |
| 成交 | 成交量变化率、成交量相对 20 日均量、OBV（可选） |
| 价格形态 | 开收收益、最高最低振幅、前收跳空 |
| 日历 | 星期几、月份（默认关闭，配置开启） |

所有滚动特征必须只使用当前及历史数据。若假设在第 `t+1` 日开盘前进行预测，则日期 `t` 的收盘数据可以使用；Notebook 必须写明这一预测时点。

特征窗口、启用列表和技术指标参数必须可配置。滚动窗口产生的前段缺失值应在每只证券内部删除，不得用未来值回填。

## 7. 数据预处理与防泄漏

1. 所有预处理器只在训练数据上 `fit`，再用于验证集和测试集。
2. 线性/逻辑回归与 KNN 默认使用 `StandardScaler`。
3. 决策树和随机森林无需缩放，但仍通过独立 Pipeline 保持流程一致。
4. 缺失值填补器如需使用，只能在训练集拟合；默认优先删除滚动预热产生的缺失行。
5. 不得随机打乱时间序列，不得使用普通随机 `train_test_split(shuffle=True)`。
6. 特征选择、超参数选择、分类阈值和概率校准只能使用训练集与验证集。
7. 若跨股票训练 pooled model，应增加证券标识的合理编码，并保证同一日期边界对所有股票一致；默认先建立“每只证券独立模型”，避免市场与货币混淆。

## 8. 时间序列划分

### 8.1 主方案：固定年份留出

| 数据集 | 日期范围 | 用途 |
| --- | --- | --- |
| 训练集 | 2018-01-01 至 2022-12-31 | 拟合模型与训练期时间序列交叉验证 |
| 验证集 | 2023-01-01 至 2024-12-31 | 模型、特征、超参数和分类阈值选择 |
| 测试集 | 2025-01-01 至运行时最近完整交易日 | 最终一次性、样本外评估 |

日期边界按自然年定义，实际样本使用各市场真实交易日。对于上市较晚的股票，训练集从其首个可用且完成特征预热的交易日开始。

### 8.2 70%/30% 参数的解释

用户提出的 `70%` 训练、`30%` 测试应作为可配置的“训练阶段内部时间序列留出”或备选切分模式，不得覆盖上述独立验证集和最终测试集：

- 默认 `split_mode = fixed_years`。
- 在训练年份 2018–2022 内，可按时间顺序使用前 70% 做子训练、后 30% 做内部验证，或使用 `TimeSeriesSplit`。
- 可选 `split_mode = chronological_ratio` 时，才对指定开发区间按 70%/30% 顺序切分；仍须保留 2025–2026 为完全隔离的最终测试集。
- 禁止随机抽取 70%/30%。

推荐默认使用扩展窗口（expanding window）的 `TimeSeriesSplit(n_splits=5)` 做训练期交叉验证。可选加入 `gap`，其值至少不小于 `forecast_horizon - 1`，以减少相邻样本标签重叠风险。

## 9. 模型与默认参数

所有参数集中到配置区，以下为初始默认值，不代表最终最优值。

### 9.1 回归

| 模型 | 实现 | 初始参数 |
| --- | --- | --- |
| 线性回归 | `LinearRegression` | 默认参数 |
| 决策树回归 | `DecisionTreeRegressor` | `max_depth=10`, `random_state=42` |
| 随机森林回归 | `RandomForestRegressor` | `n_estimators=100`, `max_depth=10`, `random_state=42`, `n_jobs=-1` |
| KNN 回归 | `KNeighborsRegressor` | `n_neighbors=5`, `weights='uniform'` |

### 9.2 分类

| 模型 | 实现 | 初始参数 |
| --- | --- | --- |
| 逻辑回归 | `LogisticRegression` | `max_iter=1000`, `random_state=42` |
| 决策树分类 | `DecisionTreeClassifier` | `max_depth=10`, `random_state=42`, `class_weight` 可配置 |
| 随机森林分类 | `RandomForestClassifier` | `n_estimators=100`, `max_depth=10`, `random_state=42`, `n_jobs=-1`, `class_weight` 可配置 |
| KNN 分类 | `KNeighborsClassifier` | `n_neighbors=5`, `weights='uniform'` |

逻辑回归是分类模型，不用于回归；线性回归是回归模型，不用于方向分类。决策树、随机森林和 KNN 分别使用对应的分类器与回归器，因此五类算法会形成 4 个回归模型和 4 个分类模型。

### 9.3 任意算法选择机制

Notebook 不得通过复制粘贴多套训练代码来选择模型。应建立统一模型注册表，例如：

```python
MODEL_REGISTRY = {
    "linear_regression": {"task": "regression", "estimator": ...},
    "logistic_regression": {"task": "classification", "estimator": ...},
    "decision_tree_regressor": {"task": "regression", "estimator": ...},
    "decision_tree_classifier": {"task": "classification", "estimator": ...},
    "random_forest_regressor": {"task": "regression", "estimator": ...},
    "random_forest_classifier": {"task": "classification", "estimator": ...},
    "knn_regressor": {"task": "regression", "estimator": ...},
    "knn_classifier": {"task": "classification", "estimator": ...},
}
```

用户应能通过配置选择一个、多个或全部适用模型：

```yaml
experiment:
  task_type: classification
  selected_models:
    - logistic_regression
    - random_forest_classifier
```

若所选算法与任务不匹配，例如回归任务选择逻辑回归，Notebook 必须在训练前给出清晰错误。新增 sklearn 兼容算法时，只需在注册表中增加定义，不应重写数据处理和评估流程。

## 10. 参数配置

建议配置至少包含：

```yaml
data:
  source: "data/processed/equities/daily/"
  input_format: auto
  start_date: "2018-01-01"
  end_date: "latest"
  price_adjustment: qfq
  selected_symbols: [smic_a, smic_h, byd_a, byd_h, cypc_a]

experiment:
  task_type: both
  selected_models: all

target:
  forecast_horizon: 1
  regression_target: future_return
  classification_threshold: 0.0

split:
  mode: fixed_years
  train_end: "2022-12-31"
  validation_start: "2023-01-01"
  validation_end: "2024-12-31"
  test_start: "2025-01-01"
  internal_train_ratio: 0.70
  internal_validation_ratio: 0.30
  time_series_cv_splits: 5

models:
  random_state: 42
  random_forest:
    n_estimators: 100
    max_depth: 10
  decision_tree:
    max_depth: 10
  knn:
    n_neighbors: 5
```

Notebook 顶部应输出完整配置，所有模型构造、特征窗口和切分边界均引用配置变量，禁止在不同单元格散落互相矛盾的硬编码值。

为方便以后分析任意股票，配置还应允许：

- `selected_symbols`: 选择一个、多个或全部证券。
- `selected_models`: 选择一个、多个或全部适用算法。
- `task_type`: `regression`、`classification` 或 `both`。
- `feature_set`: 选择预定义特征组合或显式列出特征。
- `column_mapping`: 将外部文件列名映射到内部标准字段。
- `date_ranges`: 自定义训练、验证和测试日期；当新股票历史不足时给出提示。

## 11. 训练、验证与测试流程

1. 加载配置、依赖和随机种子。
2. 通过通用入口读取任意股票数据，完成字段映射并逐证券校验。
3. 按证券构造特征和标签。
4. 根据固定日期切分训练、验证和测试集。
5. 在训练集内部进行扩展窗口交叉验证或 70%/30% 顺序留出。
6. 对每个模型拟合 Pipeline，并在验证集生成预测与指标。
7. 只根据训练/验证表现确定特征、参数和分类阈值。
8. 冻结方案后，可将训练集与验证集合并重新拟合最终模型。
9. 在 2025 年以后测试集上只进行一次最终评估。
10. 保存逐日预测、真实标签、预测概率、数据集标识、证券代码和模型名称。

统一主流程建议封装为类似接口：

```python
results = run_experiment(
    data=data,
    config=config,
    selected_symbols=config["data"]["selected_symbols"],
    selected_models=config["experiment"]["selected_models"],
)
```

该函数应返回结构化结果，至少包含已用配置、数据摘要、拟合模型、验证/测试指标和逐日预测，便于后续继续分析而不只能查看图表。

如果进行参数搜索，应使用小型、可解释的网格和时间序列交叉验证，不以测试集成绩选择参数。

## 12. 评估指标与图表

### 12.1 回归指标

验证集和测试集分别报告：

- RMSE
- MAE
- R²

同时建议补充方向命中率作为辅助指标，但不得替代上述三项。R² 允许为负，Notebook 必须如实展示，不得截断。

回归图表至少包括：

- 各模型 RMSE、MAE、R² 对比
- 实际收益率与预测收益率时间序列
- 实际值 vs 预测值散点图
- 残差分布或残差时间序列

### 12.2 分类指标

验证集和测试集分别报告：

- Accuracy
- Precision
- Recall
- F1-score
- 混淆矩阵
- ROC 曲线
- AUC

ROC/AUC 必须基于正类预测概率或 decision score，不能使用最终的 0/1 类别预测。若某个数据段只有一个类别，AUC 记为不可计算并明确提示，不得伪造数值。建议同时展示类别分布；类别明显不平衡时可补充 PR 曲线和 PR-AUC。

### 12.3 报告粒度

指标至少按以下维度保存：

```text
task_type, dataset, instrument_key, ts_code, model,
start_date, end_date, n_samples, metric_name, metric_value
```

可额外给出跨证券宏平均，但不能只展示平均值而隐藏单只证券结果。

## 13. Notebook 结构

`stock_ml_study.ipynb` 应按以下顺序组织，每节包含 Markdown 解释与可执行代码：

1. 研究问题、预测时点与防泄漏原则
2. 环境、依赖、随机种子与配置
3. 通用数据接口、字段映射示例、数据来源和文件清单
4. 任意股票数据加载与质量校验
5. 探索性数据分析和各数据集时间覆盖
6. 特征构造
7. 回归与分类标签构造
8. 固定年份划分及训练期 TimeSeriesSplit 可视化
9. 预处理 Pipeline
10. 回归模型训练与验证
11. 分类模型训练与验证
12. 超参数与阈值选择结果
13. 冻结模型后的最终测试
14. 指标表、混淆矩阵、ROC/AUC 和回归图表
15. 特征重要性或系数解释（适用模型）
16. 局限性、结论和复现说明

Notebook 末尾应增加“如何换成自己的股票数据”示例，至少演示：

1. 替换一个标准 OHLCV CSV。
2. 映射一组非标准列名。
3. 选择一只股票。
4. 只运行一个指定算法。
5. 同时比较多个算法。

Notebook 必须从头到尾可以顺序运行，不能依赖隐藏的内存变量或手工修改中间结果。

## 14. 验收标准

- 五只股票均尝试补充至 2018 年或其实际上市日，并更新至最近完整交易日。
- 数据源、复权口径、实际覆盖范围和校验结果可追溯。
- 训练、验证、测试严格按日期隔离，无随机打乱和未来信息泄漏。
- 70%/30% 与固定年份方案的用途清晰，不重复使用最终测试集调参。
- 回归标签和分类标签定义明确、可配置且采用同一预测周期。
- 五类算法均按其适用任务完成；共形成 4 个回归模型和 4 个分类模型。
- 随机森林默认 `n_estimators=100`、`max_depth=10`，其他关键参数也可配置。
- 回归输出 RMSE、MAE、R²；分类输出混淆矩阵、ROC 曲线、AUC 及基础分类指标。
- 指标分别报告验证集与测试集，并保留逐证券结果。
- 所有核心实现和说明位于 Notebook，能够清空内核后从头运行成功。
- Notebook 可导入任意满足最低字段要求的股票日线 CSV、目录或 DataFrame。
- 当前五只股票仅作为默认示例，股票代码、文件名和数量不在核心代码中硬编码。
- 只修改顶部配置即可选择任意证券、回归/分类任务以及一个或多个算法。
- 模型使用统一注册表和训练接口；新增兼容算法不需要重写特征、切分和评估代码。
- 非标准列名可通过 `column_mapping` 转换，并对缺失必要字段给出明确错误。

## 15. 已确定事项与实施前待确认事项

### 已确定

- 使用此前的五个证券与前复权日线口径。
- 主要切分为 2018–2022 训练、2023–2024 验证、2025–最近测试。
- 默认预测下一交易日收益率及涨跌方向。
- 每只证券先独立建模。
- 使用线性回归、逻辑回归、决策树、随机森林和 KNN。
- 参数集中配置，最终测试集不参与模型选择。
- 最终 Notebook 是可复用模板，可导入任意股票数据并按配置选择算法。

### 实施时可通过配置调整、但不阻塞开工

- 预测周期是否增加 5 日或 10 日版本。
- 分类阈值是否从 `0` 调整为覆盖交易成本的阈值。
- 是否增加 pooled model 作为独立模型之外的扩展实验。
- 是否对类别不平衡启用 `class_weight='balanced'`。
- 是否加入更完整的超参数网格和 PR-AUC。
