import { delimiterLabel, parseCsv, parseNumeric } from "./csv.js";
import { fitOLS } from "./stats.js";
import { renderCharts } from "./charts.js";

const elements = Object.fromEntries([
  "file-input", "choose-file", "drop-zone", "paste-input", "parse-paste", "load-sample",
  "global-message", "data-workspace", "source-description", "data-stats", "parse-warnings",
  "preview-table", "column-inventory", "reset-data", "y-select", "x-options", "x-selected-count",
  "clear-x", "include-intercept", "confidence-select", "eligibility-summary", "run-regression",
  "results-section", "results-subtitle", "result-warning-box", "overview-kpis", "model-equation",
  "overview-insights", "summary-table", "anova-table", "coefficient-caption", "coefficient-table",
  "diagnostic-kpis", "residual-summary-table", "chart-sampling-note", "diagnostic-table-note",
  "diagnostic-table", "exclusion-summary", "print-results",
].map((id) => [id, document.getElementById(id)]));

const state = {
  dataset: null,
  source: null,
  result: null,
  chartsRendered: false,
  activeTab: "overview",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInteger(value) {
  return Number(value).toLocaleString("zh-CN");
}

function formatNumber(value, digits = 4) {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "−∞";
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 1e-4) || absolute >= 1e7) return value.toExponential(4);
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function formatPValue(value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (value < 0.001) return "< 0.001";
  return value.toFixed(3);
}

function significance(value) {
  if (value < 0.001) return "***";
  if (value < 0.01) return "**";
  if (value < 0.05) return "*";
  if (value < 0.1) return "·";
  return "";
}

function setMessage(message, type = "error") {
  elements["global-message"].hidden = !message;
  elements["global-message"].textContent = message || "";
  elements["global-message"].className = `message${type === "success" ? " message-success" : type === "warning" ? " message-warning" : ""}`;
}

function generateSampleCsv() {
  const lines = ["month,region,marketing_spend,avg_price,sales_calls,store_area,competitor_index,monthly_revenue"];
  const regions = ["华东", "华南", "华北", "西南"];
  for (let index = 0; index < 120; index += 1) {
    const year = 2016 + Math.floor(index / 12);
    const month = String((index % 12) + 1).padStart(2, "0");
    const marketing = 24 + (index % 17) * 2.1 + Math.floor(index / 12) * 1.4;
    const price = 45 - (index % 9) * 0.72 + Math.sin(index * 0.37) * 1.3;
    const calls = 32 + (index % 13) * 2 + Math.floor(index / 8);
    const area = 680 + (index % 10) * 48 + Math.floor(index / 20) * 25;
    const competitor = 70 + Math.cos(index * 0.31) * 8 + (index % 5);
    const noise = Math.sin(index * 1.73) * 9 + Math.cos(index * 0.53) * 5;
    const revenue = 118 + 3.7 * marketing - 2.45 * price + 1.25 * calls + 0.075 * area - 0.52 * competitor + noise;
    const marketingValue = index === 17 ? "" : marketing.toFixed(2);
    lines.push(`${year}-${month},${regions[index % regions.length]},${marketingValue},${price.toFixed(2)},${calls},${area},${competitor.toFixed(2)},${revenue.toFixed(2)}`);
  }
  return lines.join("\n");
}

async function decodeFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" };
  } catch {
    try {
      return { text: new TextDecoder("gb18030", { fatal: true }).decode(buffer), encoding: "GB18030/GBK" };
    } catch {
      throw new Error("无法以 UTF-8 或 GB18030/GBK 解码此文件。请转换编码后重试。 ");
    }
  }
}

async function handleFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setMessage("文件超过 10 MB 软上限，浏览器处理可能较慢。正在继续解析…", "warning");
  } else {
    setMessage("正在读取并检查 CSV…", "success");
  }
  try {
    const decoded = await decodeFile(file);
    loadDataset(decoded.text, { label: file.name, encoding: decoded.encoding, size: file.size });
  } catch (error) {
    setMessage(error.message);
  }
}

function loadDataset(text, source) {
  try {
    const parsed = parseCsv(text);
    state.dataset = parsed;
    state.source = source;
    state.result = null;
    state.chartsRendered = false;
    renderDataset();
    elements["data-workspace"].hidden = false;
    elements["results-section"].hidden = true;
    if (parsed.rowCount > 50_000) {
      setMessage(`已解析 ${formatInteger(parsed.rowCount)} 行、${formatInteger(parsed.columnCount)} 列。数据超过 50,000 行软上限，分析和绘图可能较慢。`, "warning");
    } else {
      setMessage(`已成功解析 ${formatInteger(parsed.rowCount)} 行、${formatInteger(parsed.columnCount)} 列。`, "success");
    }
    elements["data-workspace"].scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setMessage(error.message);
  }
}

function renderDataset() {
  const { dataset, source } = state;
  const numericColumns = dataset.columns.filter((column) => column.type === "numeric");
  elements["source-description"].textContent = `${source.label} · ${source.encoding} · ${delimiterLabel(dataset.delimiter)}分隔`;
  elements["data-stats"].innerHTML = [
    ["数据来源", source.label],
    ["数据行", formatInteger(dataset.rowCount)],
    ["字段数", formatInteger(dataset.columnCount)],
    ["可用数值列", formatInteger(numericColumns.length)],
    ["分隔与编码", `${delimiterLabel(dataset.delimiter)} · ${source.encoding}`],
  ].map(([label, value]) => `<div class="summary-item"><span>${escapeHtml(label)}</span><strong title="${escapeHtml(value)}">${escapeHtml(value)}</strong></div>`).join("");

  elements["parse-warnings"].hidden = dataset.warnings.length === 0;
  elements["parse-warnings"].textContent = dataset.warnings.length
    ? `解析提示：${dataset.warnings.slice(0, 6).join("；")}${dataset.warnings.length > 6 ? `；另有 ${dataset.warnings.length - 6} 条` : ""}`
    : "";

  const previewHeader = `<thead><tr><th>CSV 行</th>${dataset.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  const previewBody = dataset.records.slice(0, 10).map((record) => `<tr><td>${record.line}</td>${record.values.map((value) => `<td title="${escapeHtml(value)}">${escapeHtml(value === "" ? "—" : value)}</td>`).join("")}</tr>`).join("");
  elements["preview-table"].innerHTML = `${previewHeader}<tbody>${previewBody}</tbody>`;

  const labels = { numeric: "数值", text: "文本", mixed: "混合", empty: "全空" };
  elements["column-inventory"].innerHTML = dataset.columns.map((column) => {
    const missing = column.missingCount ? `缺失 ${formatInteger(column.missingCount)}` : "无缺失";
    const invalid = column.invalidCount ? ` · 非数值 ${formatInteger(column.invalidCount)}` : "";
    return `<div class="column-card"><strong title="${escapeHtml(column.name)}">${escapeHtml(column.name)}</strong><div class="column-meta"><span class="type-pill type-${column.type}">${labels[column.type]}</span><span>${missing}${invalid}</span></div></div>`;
  }).join("");

  populateVariables(numericColumns);
}

function populateVariables(numericColumns) {
  elements["y-select"].innerHTML = numericColumns.map((column) => `<option value="${escapeHtml(column.name)}">${escapeHtml(column.name)}</option>`).join("");
  const preferredY = numericColumns.find((column) => column.name === "monthly_revenue") || numericColumns.at(-1);
  if (preferredY) elements["y-select"].value = preferredY.name;
  renderXOptions();

  const preferred = new Set(["marketing_spend", "avg_price", "sales_calls", "store_area", "competitor_index"]);
  let selected = 0;
  for (const checkbox of elements["x-options"].querySelectorAll('input[type="checkbox"]')) {
    if (checkbox.disabled) continue;
    if ((preferred.has(checkbox.value) || selected < Math.min(4, Math.max(0, numericColumns.length - 1))) && selected < 5) {
      checkbox.checked = true;
      selected += 1;
    }
  }
  updateEligibility();
}

function renderXOptions(preserveSelected = []) {
  const yName = elements["y-select"].value;
  const selected = new Set(preserveSelected);
  const numericColumns = state.dataset.columns.filter((column) => column.type === "numeric");
  elements["x-options"].innerHTML = numericColumns.map((column) => {
    const disabled = column.name === yName;
    const checked = !disabled && selected.has(column.name);
    return `<label class="x-option${disabled ? " is-disabled" : ""}"><input type="checkbox" value="${escapeHtml(column.name)}"${disabled ? " disabled" : ""}${checked ? " checked" : ""}><span title="${escapeHtml(column.name)}">${escapeHtml(column.name)}</span></label>`;
  }).join("");
}

function selectedXNames() {
  return [...elements["x-options"].querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function buildModelRows() {
  const yName = elements["y-select"].value;
  const xNames = selectedXNames();
  const selectedNames = [yName, ...xNames];
  const indices = selectedNames.map((name) => state.dataset.headers.indexOf(name));
  const included = [];
  const excluded = [];
  const missingByVariable = Object.fromEntries(selectedNames.map((name) => [name, 0]));

  for (const record of state.dataset.records) {
    const parsed = indices.map((index) => parseNumeric(record.values[index]));
    const invalidVariables = parsed.flatMap((value, index) => value.kind === "number" ? [] : [selectedNames[index]]);
    if (invalidVariables.length) {
      invalidVariables.forEach((name) => { missingByVariable[name] += 1; });
      excluded.push({ rowId: record.line, reason: `缺失或非法：${invalidVariables.join("、")}` });
      continue;
    }
    included.push({
      rowId: record.line,
      y: parsed[0].value,
      x: parsed.slice(1).map((value) => value.value),
    });
  }
  return { yName, xNames, included, excluded, missingByVariable };
}

function updateEligibility() {
  if (!state.dataset) return;
  const xNames = selectedXNames();
  elements["x-selected-count"].textContent = `已选择 ${xNames.length} 个`;
  const modelRows = buildModelRows();
  const parameterCount = xNames.length + (elements["include-intercept"].checked ? 1 : 0);
  const problems = [];
  if (!elements["y-select"].value) problems.push("请选择应变量 Y");
  if (xNames.length === 0) problems.push("至少选择一个自变量 X");
  if (xNames.length > 50) problems.push("首版最多选择 50 个自变量");
  if (modelRows.included.length <= parameterCount) problems.push("有效样本必须多于待估参数");

  elements["eligibility-summary"].classList.toggle("is-error", problems.length > 0);
  if (problems.length) {
    elements["eligibility-summary"].innerHTML = `<strong>暂时无法运行</strong><br>${escapeHtml(problems.join("；"))}`;
  } else {
    const excludedText = modelRows.excluded.length ? `，将剔除 ${formatInteger(modelRows.excluded.length)} 行` : "，无缺失行需要剔除";
    elements["eligibility-summary"].innerHTML = `<strong>${formatInteger(modelRows.included.length)} 个有效样本</strong><br>${xNames.length} 个 X · ${parameterCount} 个待估参数${excludedText}`;
  }
  elements["run-regression"].disabled = problems.length > 0;
}

function invalidateResult() {
  if (!state.result) return;
  state.result = null;
  state.chartsRendered = false;
  elements["results-section"].hidden = true;
}

async function runRegression() {
  const modelRows = buildModelRows();
  elements["run-regression"].disabled = true;
  elements["run-regression"].innerHTML = "正在计算…";
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  try {
    const started = performance.now();
    const result = fitOLS({
      y: modelRows.included.map((row) => row.y),
      X: modelRows.included.map((row) => row.x),
      xNames: modelRows.xNames,
      yName: modelRows.yName,
      includeIntercept: elements["include-intercept"].checked,
      confidence: Number(elements["confidence-select"].value),
      rowIds: modelRows.included.map((row) => row.rowId),
    });
    result.context = {
      source: state.source,
      delimiter: delimiterLabel(state.dataset.delimiter),
      originalRowCount: state.dataset.rowCount,
      excluded: modelRows.excluded,
      missingByVariable: modelRows.missingByVariable,
      runAt: new Date().toISOString(),
      elapsedMilliseconds: performance.now() - started,
    };
    state.result = result;
    state.chartsRendered = false;
    renderResult();
    setActiveTab("overview");
    elements["results-section"].hidden = false;
    elements["results-section"].scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setMessage(`回归未运行：${error.message}`);
    elements["data-workspace"].scrollIntoView({ behavior: "smooth", block: "start" });
  } finally {
    elements["run-regression"].disabled = false;
    elements["run-regression"].innerHTML = '一键运行回归 <span aria-hidden="true">→</span>';
    updateEligibility();
  }
}

function renderResult() {
  const result = state.result;
  const excludedCount = result.context.excluded.length;
  const elapsed = result.context.elapsedMilliseconds;
  elements["results-subtitle"].textContent = `${result.meta.yName} ~ ${result.meta.xNames.join(" + ")} · n=${formatInteger(result.meta.n)} · ${elapsed.toFixed(1)} ms`;

  const warnings = result.warnings.slice();
  if (excludedCount) {
    warnings.unshift(`因所选变量存在缺失或非法值，已剔除 ${formatInteger(excludedCount)} 行（${formatNumber(excludedCount / result.context.originalRowCount * 100, 1)}%）。`);
  }
  elements["result-warning-box"].hidden = warnings.length === 0;
  elements["result-warning-box"].innerHTML = warnings.length
    ? `<strong>解读前请注意</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
    : "";

  renderOverview(result);
  renderSummary(result);
  renderAnova(result);
  renderCoefficients(result);
  renderDiagnostics(result);
  renderDiagnosticRows(result);

  elements["chart-sampling-note"].textContent = result.meta.n > 5000
    ? `统计使用全部 ${formatInteger(result.meta.n)} 行；每张散点图最多均匀展示 5,000 个点并保留异常标记点。`
    : `图表展示全部 ${formatInteger(result.meta.n)} 个有效样本。悬停可查看原始 CSV 行号。`;
}

function renderOverview(result) {
  const { metrics, meta, diagnostics } = result;
  const kpis = [
    ["有效样本 n", formatInteger(meta.n), `${result.context.excluded.length} 行被剔除`],
    [meta.includeIntercept ? "R²" : "Uncentered R²", formatNumber(metrics.rSquared), "样本内拟合程度"],
    ["Adjusted R²", formatNumber(metrics.adjustedRSquared), "考虑变量数量"],
    ["整体 F 检验", formatPValue(metrics.fPValue), `F = ${formatNumber(metrics.fStatistic)}`],
    ["残差标准误", formatNumber(metrics.residualStandardError), `RMSE ${formatNumber(metrics.rmse)}`],
  ];
  elements["overview-kpis"].innerHTML = kpis.map(([label, value, note]) => `<div class="kpi-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join("");

  const terms = result.coefficients.map((coefficient, index) => {
    if (coefficient.name === "截距") return formatNumber(coefficient.estimate, 6);
    const absolute = formatNumber(Math.abs(coefficient.estimate), 6);
    const prefix = index === 0 ? (coefficient.estimate < 0 ? "− " : "") : (coefficient.estimate < 0 ? " − " : " + ");
    return `${prefix}${absolute} × ${coefficient.name}`;
  });
  elements["model-equation"].textContent = `${meta.yName} = ${terms.join("")}`;

  const significant = result.coefficients.filter((row) => row.name !== "截距" && row.pValue < 0.05).length;
  const overallOk = metrics.fPValue < 0.05;
  const influenceCount = diagnostics.counts.highInfluence;
  elements["overview-insights"].innerHTML = [
    {
      title: overallOk ? "模型整体检验通过" : "模型整体证据有限",
      body: overallOk
        ? `F 检验${metrics.fPValue < 0.001 ? " p < 0.001" : ` p = ${formatPValue(metrics.fPValue)}`}，至少一个 X 的线性系数不为零。`
        : `F 检验 p = ${formatPValue(metrics.fPValue)}，当前样本不足以支持模型整体显著。`,
      className: overallOk ? "is-ok" : "is-caution",
    },
    {
      title: `${significant} / ${meta.predictorCount} 个 X 在 5% 水平显著`,
      body: "系数是在其他所选变量保持不变时的条件关联；显著不等于影响很大或存在因果。",
      className: significant ? "is-ok" : "is-caution",
    },
    {
      title: influenceCount ? `${influenceCount} 个高影响观测待复核` : "未发现高 Cook’s distance 观测",
      body: influenceCount ? "建议在诊断与图表中查看原始 CSV 行号，结合业务背景判断。" : "这不代表模型假设全部成立，仍需查看正态性、异方差与共线性。",
      className: influenceCount ? "is-caution" : "is-ok",
    },
  ].map((item) => `<article class="insight-card ${item.className}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p></article>`).join("");
}

function renderSummary(result) {
  const { metrics, meta } = result;
  const rows = [
    ["应变量", meta.yName, "模型左侧变量"],
    ["自变量", meta.xNames.join("、"), `${meta.predictorCount} 个`],
    ["有效样本 n", formatInteger(meta.n), `原始 ${formatInteger(result.context.originalRowCount)} 行`],
    ["截距", meta.includeIntercept ? "包含" : "不包含", meta.includeIntercept ? "常规中心化 R²" : "未中心化 R²"],
    ["Multiple R", formatNumber(metrics.multipleR), "R² 的平方根"],
    [meta.includeIntercept ? "R²" : "Uncentered R²", formatNumber(metrics.rSquared), "拟合程度"],
    ["Adjusted R²", formatNumber(metrics.adjustedRSquared), "调整变量数量后"],
    ["Residual Standard Error", formatNumber(metrics.residualStandardError), `残差 df=${meta.residualDf}`],
    ["RMSE", formatNumber(metrics.rmse), "样本内均方根误差"],
    ["MAE", formatNumber(metrics.mae), "样本内平均绝对误差"],
    ["SSE", formatNumber(metrics.sse), "残差平方和"],
    ["SSR", formatNumber(metrics.ssr), "回归平方和"],
    ["SST", formatNumber(metrics.sst), meta.includeIntercept ? "中心化总平方和" : "未中心化总平方和"],
    ["F 统计量", formatNumber(metrics.fStatistic), `df=(${meta.modelDf}, ${meta.residualDf})`],
    ["F 检验 p 值", formatPValue(metrics.fPValue), "模型整体检验"],
    ["AIC", formatNumber(metrics.aic), "同一 Y 与样本下越低越优"],
    ["BIC", formatNumber(metrics.bic), "对参数数量惩罚更强"],
  ];
  elements["summary-table"].innerHTML = `<table><thead><tr><th>指标</th><th>结果</th><th>说明</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td class="numeric-cell">${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td></tr>`).join("")}</tbody></table>`;
}

function renderAnova(result) {
  elements["anova-table"].innerHTML = `<table><thead><tr><th>来源</th><th>平方和 SS</th><th>自由度 df</th><th>均方 MS</th><th>F</th><th>p 值</th></tr></thead><tbody>${result.anova.map((row) => `<tr><td>${escapeHtml(row.source)}</td><td class="numeric-cell">${formatNumber(row.sumSquares, 6)}</td><td class="numeric-cell">${row.degreesOfFreedom}</td><td class="numeric-cell">${formatNumber(row.meanSquare, 6)}</td><td class="numeric-cell">${formatNumber(row.fStatistic, 6)}</td><td class="numeric-cell">${formatPValue(row.pValue)}</td></tr>`).join("")}</tbody></table>`;
}

function renderCoefficients(result) {
  const confidencePercent = Math.round(result.meta.confidence * 100);
  elements["coefficient-caption"].textContent = `双侧检验与 ${confidencePercent}% 置信区间；标准误为 OLS 常规标准误。`;
  elements["coefficient-table"].innerHTML = `<table><thead><tr><th>变量</th><th>B</th><th>SE</th><th>Beta</th><th>t</th><th>p 值</th><th>显著性</th><th>CI 下限</th><th>CI 上限</th><th>VIF</th><th>Tolerance</th></tr></thead><tbody>${result.coefficients.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td class="numeric-cell">${formatNumber(row.estimate, 6)}</td><td class="numeric-cell">${formatNumber(row.standardError, 6)}</td><td class="numeric-cell">${formatNumber(row.standardBeta, 6)}</td><td class="numeric-cell">${formatNumber(row.tStatistic, 5)}</td><td class="numeric-cell" title="${escapeHtml(row.pValue)}">${formatPValue(row.pValue)}</td><td class="significance">${significance(row.pValue)}</td><td class="numeric-cell">${formatNumber(row.confidenceLower, 6)}</td><td class="numeric-cell">${formatNumber(row.confidenceUpper, 6)}</td><td class="numeric-cell">${formatNumber(row.vif, 4)}</td><td class="numeric-cell">${formatNumber(row.tolerance, 4)}</td></tr>`).join("")}</tbody></table>`;
}

function renderDiagnostics(result) {
  const { diagnostics } = result;
  const cards = [
    ["Durbin–Watson", formatNumber(diagnostics.durbinWatson), "接近 2 通常表示无一阶相关", diagnostics.durbinWatson < 1.5 || diagnostics.durbinWatson > 2.5],
    ["Jarque–Bera p", formatPValue(diagnostics.jarqueBera.pValue), `JB ${formatNumber(diagnostics.jarqueBera.statistic)}`, diagnostics.jarqueBera.pValue < 0.05],
    ["Breusch–Pagan p", formatPValue(diagnostics.breuschPagan.pValue), `LM ${formatNumber(diagnostics.breuschPagan.statistic)}`, diagnostics.breuschPagan.pValue < 0.05],
    ["最大 VIF", formatNumber(diagnostics.maxVif), "5 以上值得关注", diagnostics.maxVif > 5],
    ["条件数", formatNumber(diagnostics.conditionNumber), "过高提示数值/共线性风险", diagnostics.conditionNumber > 1000],
    ["大残差点", formatInteger(diagnostics.counts.largeResidual), "|学生化残差| > 2", diagnostics.counts.largeResidual > 0],
    ["高杠杆点", formatInteger(diagnostics.counts.highLeverage), `Leverage > ${formatNumber(diagnostics.thresholds.leverage)}`, diagnostics.counts.highLeverage > 0],
    ["高影响点", formatInteger(diagnostics.counts.highInfluence), `Cook's D > ${formatNumber(diagnostics.thresholds.cooksDistance)}`, diagnostics.counts.highInfluence > 0],
  ];
  elements["diagnostic-kpis"].innerHTML = cards.map(([label, value, note, warning]) => `<div class="diagnostic-card${warning ? " is-warning" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join("");

  const residual = diagnostics.residualSummary;
  const rows = [["最小值", residual.min], ["Q1", residual.q1], ["中位数", residual.median], ["Q3", residual.q3], ["最大值", residual.max]];
  elements["residual-summary-table"].innerHTML = `<table><thead><tr><th>残差摘要</th>${rows.map((row) => `<th>${row[0]}</th>`).join("")}</tr></thead><tbody><tr><td>数值</td>${rows.map((row) => `<td class="numeric-cell">${formatNumber(row[1], 6)}</td>`).join("")}</tr></tbody></table>`;
}

function renderDiagnosticRows(result) {
  const maximumDisplay = 500;
  const displayed = result.rows.slice(0, maximumDisplay);
  elements["diagnostic-table-note"].textContent = result.rows.length > maximumDisplay
    ? `页面展示前 ${maximumDisplay} 个有效样本；下载 CSV 包含全部 ${formatInteger(result.rows.length)} 个有效样本及被剔除行。`
    : `展示全部 ${formatInteger(result.rows.length)} 个有效样本；下载 CSV 同时包含被剔除行。`;
  elements["diagnostic-table"].innerHTML = `<table><thead><tr><th>CSV 行</th><th>实际值</th><th>预测值</th><th>残差</th><th>学生化残差</th><th>Leverage</th><th>Cook's D</th><th>标记</th></tr></thead><tbody>${displayed.map((row) => `<tr><td>${row.rowId}</td><td class="numeric-cell">${formatNumber(row.actual, 6)}</td><td class="numeric-cell">${formatNumber(row.fitted, 6)}</td><td class="numeric-cell">${formatNumber(row.residual, 6)}</td><td class="numeric-cell">${formatNumber(row.studentized, 6)}</td><td class="numeric-cell">${formatNumber(row.leverage, 6)}</td><td class="numeric-cell">${formatNumber(row.cooksDistance, 6)}</td><td>${row.flags.length ? row.flags.map((flag) => `<span class="flag-pill">${escapeHtml(flag)}</span>`).join("") : "—"}</td></tr>`).join("")}</tbody></table>`;

  const excluded = result.context.excluded;
  elements["exclusion-summary"].innerHTML = excluded.length
    ? `<h4>被剔除的行</h4><p>共 ${formatInteger(excluded.length)} 行。${excluded.slice(0, 25).map((row) => `CSV 第 ${row.rowId} 行（${row.reason}）`).join("；")}${excluded.length > 25 ? `；另有 ${excluded.length - 25} 行，请下载诊断 CSV 查看` : ""}。</p>`
    : "<h4>被剔除的行</h4><p>当前所选变量没有缺失或非法值，全部数据行均进入模型。</p>";
}

function setActiveTab(name) {
  state.activeTab = name;
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const active = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
    panel.hidden = panel.id !== `panel-${name}`;
  }
  if (name === "charts" && state.result) {
    requestAnimationFrame(() => {
      renderCharts(state.result);
      state.chartsRendered = true;
    });
  }
}

function csvCell(value) {
  if (value == null || Number.isNaN(value)) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : String(value);
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function makeCsv(headers, rows) {
  return `\uFEFF${headers.map(csvCell).join(",")}\n${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseFilename() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `ols-regression-${stamp}`;
}

function downloadResult(kind) {
  const result = state.result;
  if (!result) return;
  const base = baseFilename();
  if (kind === "summary") {
    const rows = [
      ["配置", "应变量", result.meta.yName],
      ["配置", "自变量", result.meta.xNames.join(" | ")],
      ["配置", "包含截距", result.meta.includeIntercept],
      ["配置", "置信水平", result.meta.confidence],
      ["样本", "原始行数", result.context.originalRowCount],
      ["样本", "有效样本", result.meta.n],
      ["样本", "剔除行数", result.context.excluded.length],
      ...Object.entries(result.metrics).map(([name, value]) => ["模型指标", name, value]),
      ["诊断", "Durbin-Watson", result.diagnostics.durbinWatson],
      ["诊断", "Jarque-Bera", result.diagnostics.jarqueBera.statistic],
      ["诊断", "Jarque-Bera p", result.diagnostics.jarqueBera.pValue],
      ["诊断", "Breusch-Pagan", result.diagnostics.breuschPagan.statistic],
      ["诊断", "Breusch-Pagan p", result.diagnostics.breuschPagan.pValue],
      ["诊断", "最大 VIF", result.diagnostics.maxVif],
      ["诊断", "条件数", result.diagnostics.conditionNumber],
    ];
    downloadBlob(`${base}-summary.csv`, makeCsv(["类别", "指标", "值"], rows), "text/csv;charset=utf-8");
  }
  if (kind === "coefficients") {
    const headers = ["变量", "B", "SE", "Beta", "t", "p_value", "显著性", "CI_lower", "CI_upper", "VIF", "Tolerance"];
    const rows = result.coefficients.map((row) => [row.name, row.estimate, row.standardError, row.standardBeta, row.tStatistic, row.pValue, significance(row.pValue), row.confidenceLower, row.confidenceUpper, row.vif, row.tolerance]);
    downloadBlob(`${base}-coefficients.csv`, makeCsv(headers, rows), "text/csv;charset=utf-8");
  }
  if (kind === "diagnostics") {
    const headers = ["csv_line", "status", "exclusion_reason", "actual", "fitted", "residual", "studentized_residual", "leverage", "cooks_distance", "flags"];
    const included = result.rows.map((row) => [row.rowId, "included", "", row.actual, row.fitted, row.residual, row.studentized, row.leverage, row.cooksDistance, row.flags.join(" | ")]);
    const excluded = result.context.excluded.map((row) => [row.rowId, "excluded", row.reason, null, null, null, null, null, null, ""]);
    downloadBlob(`${base}-diagnostics.csv`, makeCsv(headers, [...included, ...excluded].sort((a, b) => a[0] - b[0])), "text/csv;charset=utf-8");
  }
  if (kind === "json") {
    const content = JSON.stringify(result, (_key, value) => Number.isFinite(value) || typeof value !== "number" ? value : String(value), 2);
    downloadBlob(`${base}-complete.json`, content, "application/json;charset=utf-8");
  }
  document.querySelector(".export-menu details")?.removeAttribute("open");
}

function resetData() {
  state.dataset = null;
  state.source = null;
  state.result = null;
  state.chartsRendered = false;
  elements["file-input"].value = "";
  elements["paste-input"].value = "";
  elements["data-workspace"].hidden = true;
  elements["results-section"].hidden = true;
  setMessage("");
  document.querySelector(".workspace-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

elements["choose-file"].addEventListener("click", (event) => {
  event.stopPropagation();
  elements["file-input"].click();
});
elements["drop-zone"].addEventListener("click", (event) => {
  if (event.target !== elements["file-input"]) elements["file-input"].click();
});
elements["file-input"].addEventListener("change", () => handleFile(elements["file-input"].files[0]));
for (const eventName of ["dragenter", "dragover"]) {
  elements["drop-zone"].addEventListener(eventName, (event) => {
    event.preventDefault();
    elements["drop-zone"].classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements["drop-zone"].addEventListener(eventName, (event) => {
    event.preventDefault();
    elements["drop-zone"].classList.remove("is-dragging");
  });
}
elements["drop-zone"].addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
elements["parse-paste"].addEventListener("click", () => loadDataset(elements["paste-input"].value, { label: "粘贴的 CSV", encoding: "浏览器文本" }));
elements["load-sample"].addEventListener("click", () => loadDataset(generateSampleCsv(), { label: "业务经营示例数据", encoding: "UTF-8" }));
elements["reset-data"].addEventListener("click", resetData);

elements["y-select"].addEventListener("change", () => {
  const selected = selectedXNames();
  renderXOptions(selected);
  invalidateResult();
  updateEligibility();
});
elements["x-options"].addEventListener("change", () => { invalidateResult(); updateEligibility(); });
elements["include-intercept"].addEventListener("change", () => { invalidateResult(); updateEligibility(); });
elements["confidence-select"].addEventListener("change", () => { invalidateResult(); updateEligibility(); });
elements["clear-x"].addEventListener("click", () => {
  elements["x-options"].querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  invalidateResult();
  updateEligibility();
});
elements["run-regression"].addEventListener("click", runRegression);

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(tab);
    let next = current;
    if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    tabs[next].focus();
    setActiveTab(tabs[next].dataset.tab);
  });
}

document.querySelectorAll("[data-download]").forEach((button) => button.addEventListener("click", () => downloadResult(button.dataset.download)));
elements["print-results"].addEventListener("click", () => {
  if (!state.chartsRendered) {
    setActiveTab("charts");
    requestAnimationFrame(() => setTimeout(() => window.print(), 80));
  } else {
    window.print();
  }
});

let resizeTimer;
window.addEventListener("resize", () => {
  if (state.activeTab !== "charts" || !state.result) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderCharts(state.result), 150);
});
