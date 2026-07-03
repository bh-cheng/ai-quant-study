const DATASETS = [
  {
    key: "smic_h",
    label: "中芯国际港股",
    tsCode: "00981.HK",
    path: "../data/processed/equities/daily/smic_h_00981_HK_daily_20250703_20260703.csv",
    provider: "Yahoo Finance",
    market: "HK-share",
    currency: "HKD",
  },
  {
    key: "smic_a",
    label: "中芯国际 A 股",
    tsCode: "688981.SH",
    path: "../data/processed/equities/daily/smic_a_688981_SH_daily_20250703_20260703.csv",
    provider: "Tushare",
    market: "A-share",
    currency: "CNY",
  },
  {
    key: "byd_a",
    label: "比亚迪 A 股",
    tsCode: "002594.SZ",
    path: "../data/processed/equities/daily/byd_a_002594_SZ_daily_20250703_20260703.csv",
    provider: "Tushare + Yahoo adj",
    market: "A-share",
    currency: "CNY",
    sourceNote: "比亚迪 A 股日线 OHLCV 来自 Tushare raw；因 Tushare adj_factor 限流，复权因子采用 Yahoo 复权收盘价与 Tushare raw close 对齐推导，已纳入 2025-07-29 除权比例。",
  },
  {
    key: "byd_h",
    label: "比亚迪港股",
    tsCode: "01211.HK",
    path: "../data/processed/equities/daily/byd_h_01211_HK_daily_20250703_20260703.csv",
    provider: "Yahoo Finance",
    market: "HK-share",
    currency: "HKD",
  },
  {
    key: "cypc_a",
    label: "长江电力 A 股",
    tsCode: "600900.SH",
    path: "../data/processed/equities/daily/cypc_a_600900_SH_daily_20250703_20260703.csv",
    provider: "Tushare + Yahoo adj",
    market: "A-share",
    currency: "CNY",
    sourceNote: "长江电力 A 股日线 OHLCV 来自 Tushare raw；因 Tushare adj_factor 限流，复权因子采用 Yahoo 复权收盘价与 Tushare raw close 对齐推导。当前检查未发现 BYD A 式价格比例错配。",
  },
];

const PRESETS = {
  scalping: {
    label: "短线敏感",
    rsi: { window: 7, overbought: 75, oversold: 25, smoothing: "sma" },
    macd: { fast: 6, slow: 13, signal: 5, maType: "ema", histScale: 1 },
    boll: { window: 10, std: 2, midType: "sma", stdMode: "population" },
    atr: { window: 7, smoothing: "sma", display: "absolute", multiplier: 1.5 },
    ma: { fast: 5, mid: 10, slow: 20, maType: "sma" },
    kdj: { window: 9, kSmoothing: 3, dSmoothing: 3, overbought: 80, oversold: 20 },
    obv: { maWindow: 10, scale: "million" },
  },
  balanced: {
    label: "均衡观察",
    rsi: { window: 14, overbought: 70, oversold: 30, smoothing: "sma" },
    macd: { fast: 12, slow: 26, signal: 9, maType: "ema", histScale: 1 },
    boll: { window: 20, std: 2, midType: "sma", stdMode: "population" },
    atr: { window: 14, smoothing: "sma", display: "absolute", multiplier: 2 },
    ma: { fast: 5, mid: 20, slow: 60, maType: "sma" },
    kdj: { window: 9, kSmoothing: 3, dSmoothing: 3, overbought: 80, oversold: 20 },
    obv: { maWindow: 20, scale: "million" },
  },
  trend: {
    label: "中期趋势",
    rsi: { window: 21, overbought: 65, oversold: 35, smoothing: "ema" },
    macd: { fast: 19, slow: 39, signal: 9, maType: "ema", histScale: 1 },
    boll: { window: 40, std: 2, midType: "ema", stdMode: "population" },
    atr: { window: 21, smoothing: "wilder", display: "percent", multiplier: 2 },
    ma: { fast: 20, mid: 60, slow: 120, maType: "ema" },
    kdj: { window: 14, kSmoothing: 3, dSmoothing: 3, overbought: 75, oversold: 25 },
    obv: { maWindow: 60, scale: "million" },
  },
  volatility: {
    label: "波动突破",
    rsi: { window: 14, overbought: 68, oversold: 32, smoothing: "wilder" },
    macd: { fast: 10, slow: 24, signal: 8, maType: "ema", histScale: 2 },
    boll: { window: 20, std: 1.7, midType: "sma", stdMode: "population" },
    atr: { window: 14, smoothing: "wilder", display: "percent", multiplier: 2.5 },
    ma: { fast: 5, mid: 20, slow: 60, maType: "ema" },
    kdj: { window: 9, kSmoothing: 2, dSmoothing: 3, overbought: 85, oversold: 15 },
    obv: { maWindow: 20, scale: "million" },
  },
  meanReversion: {
    label: "均值回归",
    rsi: { window: 10, overbought: 72, oversold: 28, smoothing: "sma" },
    macd: { fast: 12, slow: 26, signal: 9, maType: "ema", histScale: 1 },
    boll: { window: 20, std: 2.4, midType: "sma", stdMode: "sample" },
    atr: { window: 14, smoothing: "sma", display: "absolute", multiplier: 1.8 },
    ma: { fast: 5, mid: 20, slow: 60, maType: "sma" },
    kdj: { window: 9, kSmoothing: 3, dSmoothing: 3, overbought: 80, oversold: 20 },
    obv: { maWindow: 20, scale: "million" },
  },
};

const state = {
  selectedKey: "smic_h",
  datasets: new Map(),
  params: new Map(),
  dateRanges: new Map(),
};

const els = {
  datasetSelect: document.getElementById("datasetSelect"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  dataModules: document.getElementById("dataModules"),
  dataCount: document.getElementById("dataCount"),
  chartTitle: document.getElementById("chartTitle"),
  chartEyebrow: document.getElementById("chartEyebrow"),
  statusPills: document.getElementById("statusPills"),
  warningBox: document.getElementById("warningBox"),
  paramModuleName: document.getElementById("paramModuleName"),
  moduleBinding: document.getElementById("moduleBinding"),
  presetButtons: document.getElementById("presetButtons"),
  rsiControls: document.getElementById("rsiControls"),
  macdControls: document.getElementById("macdControls"),
  bollControls: document.getElementById("bollControls"),
  atrControls: document.getElementById("atrControls"),
  maControls: document.getElementById("maControls"),
  kdjControls: document.getElementById("kdjControls"),
  obvControls: document.getElementById("obvControls"),
  latestDate: document.getElementById("latestDate"),
  latestClose: document.getElementById("latestClose"),
  latestRsi: document.getElementById("latestRsi"),
  latestMacd: document.getElementById("latestMacd"),
  latestAtr: document.getElementById("latestAtr"),
  latestMa: document.getElementById("latestMa"),
  latestKdj: document.getElementById("latestKdj"),
  latestObv: document.getElementById("latestObv"),
  comboState: document.getElementById("comboState"),
  rsiLabel: document.getElementById("rsiLabel"),
  macdLabel: document.getElementById("macdLabel"),
  bollLabel: document.getElementById("bollLabel"),
  atrLabel: document.getElementById("atrLabel"),
  maLabel: document.getElementById("maLabel"),
  kdjLabel: document.getElementById("kdjLabel"),
  obvLabel: document.getElementById("obvLabel"),
  toggleRsi: document.getElementById("toggleRsi"),
  toggleMacd: document.getElementById("toggleMacd"),
  toggleBoll: document.getElementById("toggleBoll"),
  toggleAtr: document.getElementById("toggleAtr"),
  toggleMa: document.getElementById("toggleMa"),
  toggleKdj: document.getElementById("toggleKdj"),
  toggleObv: document.getElementById("toggleObv"),
  downloadCsv: document.getElementById("downloadCsv"),
  downloadParams: document.getElementById("downloadParams"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultModuleParams() {
  const params = clone(PRESETS.balanced);
  params.preset = "balanced";
  params.toggles = { rsi: true, macd: true, boll: true, atr: true, ma: true, kdj: true, obv: true };
  return params;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map((header) => header.replace(/^\uFEFF/, ""));
  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let value = "";
  let inQuotes = false;
  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (char === '"' && line[idx + 1] === '"') {
      value += '"';
      idx += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      out.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  out.push(value);
  return out;
}

function toNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRows(rows) {
  return rows
    .map((row) => ({
      ...row,
      date: parseTradeDate(row.trade_date),
      qfq_open: toNumber(row.qfq_open),
      qfq_high: toNumber(row.qfq_high),
      qfq_low: toNumber(row.qfq_low),
      qfq_close: toNumber(row.qfq_close),
      qfq_pre_close: toNumber(row.qfq_pre_close),
      vol: toNumber(row.vol),
      amount: toNumber(row.amount),
    }))
    .filter((row) => row.date && row.qfq_close != null)
    .sort((a, b) => a.date - b.date);
}

function parseTradeDate(value) {
  const text = String(value);
  if (!/^\d{8}$/.test(text)) return null;
  return new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00`);
}

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  if (!date) return "-";
  return dateInputValue(date);
}

function formatNumber(value, digits = 2) {
  return value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits);
}

async function loadData() {
  els.dataCount.textContent = "Loading...";
  for (const item of DATASETS) {
    try {
      const { text, sourceMode } = await readDatasetText(item);
      const rows = normalizeRows(parseCsv(text));
      setLoadedDataset(item, rows, sourceMode);
    } catch (error) {
      state.datasets.set(item.key, { ...item, rows: [], error: error.message });
      state.params.set(item.key, defaultModuleParams());
    }
  }
}

async function readDatasetText(item) {
  const sourceOverride = new URLSearchParams(window.location.search).get("source");
  const forceEmbedded = sourceOverride === "embedded";
  const preferEmbedded =
    forceEmbedded ||
    window.location.protocol === "file:" ||
    window.location.hostname.endsWith("github.io");
  try {
    if (preferEmbedded) throw new Error("embedded data preferred");
    const response = await fetch(item.path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), sourceMode: "CSV fetch" };
  } catch (fetchError) {
    const embeddedText = window.TASK2_EMBEDDED_CSV?.[item.key];
    if (embeddedText) {
      return { text: embeddedText, sourceMode: preferEmbedded ? "embedded bundle" : "embedded fallback" };
    }
    throw new Error(
      `${fetchError.message}. 请通过本地 HTTP 服务打开页面，或确认 task2_indicator_lab/data-bundle.js 存在。`
    );
  }
}

function setLoadedDataset(item, rows, sourceMode) {
  state.datasets.set(item.key, { ...item, rows, sourceMode, error: null });
  state.params.set(item.key, defaultModuleParams());
  if (rows.length) {
    state.dateRanges.set(item.key, {
      start: rows[0].date,
      end: rows[rows.length - 1].date,
    });
  }
}

function initControls() {
  DATASETS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.label} ${item.tsCode}`;
    els.datasetSelect.appendChild(option);
  });
  els.datasetSelect.value = state.selectedKey;
  els.datasetSelect.addEventListener("change", () => selectDataset(els.datasetSelect.value));

  [els.startDate, els.endDate].forEach((input) => {
    input.addEventListener("change", () => {
      const range = state.dateRanges.get(state.selectedKey);
      range.start = new Date(`${els.startDate.value}T00:00:00`);
      range.end = new Date(`${els.endDate.value}T00:00:00`);
      render();
    });
  });

  [
    [els.toggleRsi, "rsi"],
    [els.toggleMacd, "macd"],
    [els.toggleBoll, "boll"],
    [els.toggleAtr, "atr"],
    [els.toggleMa, "ma"],
    [els.toggleKdj, "kdj"],
    [els.toggleObv, "obv"],
  ].forEach(([input, key]) => {
    input.addEventListener("change", () => {
      const params = state.params.get(state.selectedKey);
      params.toggles[key] = input.checked;
      render();
    });
  });

  els.downloadCsv.addEventListener("click", downloadIndicatorCsv);
  els.downloadParams.addEventListener("click", downloadParamsJson);
}

function selectDataset(key) {
  state.selectedKey = key;
  els.datasetSelect.value = key;
  syncDateInputs();
  render();
}

function syncDateInputs() {
  const data = state.datasets.get(state.selectedKey);
  const range = state.dateRanges.get(state.selectedKey);
  if (!data || !range || !data.rows.length) return;
  els.startDate.min = dateInputValue(data.rows[0].date);
  els.startDate.max = dateInputValue(data.rows[data.rows.length - 1].date);
  els.endDate.min = els.startDate.min;
  els.endDate.max = els.startDate.max;
  els.startDate.value = dateInputValue(range.start);
  els.endDate.value = dateInputValue(range.end);
}

function render() {
  const data = state.datasets.get(state.selectedKey);
  const params = state.params.get(state.selectedKey);
  if (!params) return;
  renderDataModules();
  renderParamControls(params);
  syncToggleInputs(params);

  if (!data || data.error || !data.rows.length) {
    showWarning(data?.error || "No data available");
    return;
  }

  const rows = filteredRows(data.rows);
  const computed = computeIndicators(rows, params);
  const latest = lastValid(computed);
  renderHeader(data, rows, params);
  renderCharts(computed, params);
  renderSummary(latest, data, params);
}

function renderDataModules() {
  els.dataModules.innerHTML = "";
  els.dataCount.textContent = `${DATASETS.length} modules`;
  DATASETS.forEach((item) => {
    const data = state.datasets.get(item.key);
    const params = state.params.get(item.key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `data-card${item.key === state.selectedKey ? " active" : ""}`;
    const presetLabel = params ? PRESETS[params.preset]?.label || "自定义" : "初始化中";
    button.innerHTML = `
      <strong>${item.label}</strong>
      <span>${item.tsCode} · ${item.provider}</span>
      <span>${data?.rows.length || 0} rows · ${item.currency}</span>
      <span>参数模块: ${presetLabel}</span>
    `;
    button.addEventListener("click", () => selectDataset(item.key));
    els.dataModules.appendChild(button);
  });
}

function renderHeader(data, rows, params) {
  els.warningBox.classList.add("hidden");
  els.chartTitle.textContent = `${data.label} ${data.tsCode}`;
  els.chartEyebrow.textContent = "Adjusted qfq_* price basis";
  els.statusPills.innerHTML = "";
  [
    `${rows.length} rows`,
    data.provider,
    data.currency,
    data.sourceMode || "CSV fetch",
    PRESETS[params.preset]?.label || "自定义参数",
  ].forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = text;
    els.statusPills.appendChild(pill);
  });
  if (data.sourceNote) {
    showWarning(data.sourceNote);
  } else if (data.market === "HK-share" && data.provider.includes("Yahoo")) {
    showWarning("Yahoo 港股数据不提供成交额 amount；本工具的七个指标不依赖 amount，OBV 使用 vol。");
  }
}

function showWarning(message) {
  els.warningBox.textContent = message;
  els.warningBox.classList.remove("hidden");
}

function renderParamControls(params) {
  const data = state.datasets.get(state.selectedKey);
  els.paramModuleName.textContent = data ? data.tsCode : "";
  els.moduleBinding.textContent = data
    ? `${data.label} 的数据模块绑定独立参数模块。切换股票时，七个指标参数会切换到该股票自己的保存状态。`
    : "";

  renderPresetButtons(params);
  renderControlGroup(els.rsiControls, [
    range("周期", "rsi.window", params.rsi.window, 2, 60, 1),
    range("超买线", "rsi.overbought", params.rsi.overbought, 50, 95, 1),
    range("超卖线", "rsi.oversold", params.rsi.oversold, 5, 50, 1),
    select("平滑", "rsi.smoothing", params.rsi.smoothing, [["sma", "SMA"], ["ema", "EMA"], ["wilder", "Wilder"]]),
  ]);
  renderControlGroup(els.macdControls, [
    range("快线", "macd.fast", params.macd.fast, 2, 50, 1),
    range("慢线", "macd.slow", params.macd.slow, 5, 120, 1),
    range("信号线", "macd.signal", params.macd.signal, 2, 50, 1),
    select("均线", "macd.maType", params.macd.maType, [["ema", "EMA"], ["sma", "SMA"]]),
    select("柱倍数", "macd.histScale", String(params.macd.histScale), [["1", "1x"], ["2", "2x"]]),
  ]);
  renderControlGroup(els.bollControls, [
    range("周期", "boll.window", params.boll.window, 5, 120, 1),
    range("标准差", "boll.std", params.boll.std, 0.5, 4, 0.1),
    select("中轨", "boll.midType", params.boll.midType, [["sma", "SMA"], ["ema", "EMA"]]),
    select("方差", "boll.stdMode", params.boll.stdMode, [["population", "Population"], ["sample", "Sample"]]),
  ]);
  renderControlGroup(els.atrControls, [
    range("周期", "atr.window", params.atr.window, 2, 60, 1),
    range("倍数线", "atr.multiplier", params.atr.multiplier, 0.5, 5, 0.1),
    select("平滑", "atr.smoothing", params.atr.smoothing, [["sma", "SMA"], ["ema", "EMA"], ["wilder", "Wilder"]]),
    select("显示", "atr.display", params.atr.display, [["absolute", "Absolute"], ["percent", "% of close"]]),
  ]);
  renderControlGroup(els.maControls, [
    range("快线", "ma.fast", params.ma.fast, 2, 80, 1),
    range("中线", "ma.mid", params.ma.mid, 3, 160, 1),
    range("慢线", "ma.slow", params.ma.slow, 5, 240, 1),
    select("均线", "ma.maType", params.ma.maType, [["sma", "SMA"], ["ema", "EMA"]]),
  ]);
  renderControlGroup(els.kdjControls, [
    range("周期", "kdj.window", params.kdj.window, 3, 60, 1),
    range("K平滑", "kdj.kSmoothing", params.kdj.kSmoothing, 1, 10, 1),
    range("D平滑", "kdj.dSmoothing", params.kdj.dSmoothing, 1, 10, 1),
    range("超买线", "kdj.overbought", params.kdj.overbought, 50, 95, 1),
    range("超卖线", "kdj.oversold", params.kdj.oversold, 5, 50, 1),
  ]);
  renderControlGroup(els.obvControls, [
    range("均线", "obv.maWindow", params.obv.maWindow, 2, 120, 1),
    select("缩放", "obv.scale", params.obv.scale, [["raw", "Raw"], ["thousand", "Thousands"], ["million", "Millions"]]),
  ]);
}

function renderPresetButtons(params) {
  els.presetButtons.innerHTML = "";
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = params.preset === key ? "active" : "";
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      const current = state.params.get(state.selectedKey);
      const next = { ...clone(preset), preset: key, toggles: { ...current.toggles } };
      state.params.set(state.selectedKey, next);
      render();
    });
    els.presetButtons.appendChild(button);
  });
}

function renderControlGroup(container, specs) {
  container.innerHTML = "";
  specs.forEach((spec) => container.appendChild(spec.element));
}

function range(label, path, value, min, max, step) {
  const row = document.createElement("label");
  row.className = "control-row";
  const id = `control-${path}`;
  row.innerHTML = `
    <span>${label}</span>
    <input id="${id}-range" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
    <input id="${id}-number" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
  `;
  const rangeInput = row.querySelector(`#${CSS.escape(id)}-range`);
  const numberInput = row.querySelector(`#${CSS.escape(id)}-number`);
  const update = (raw) => {
    const next = step % 1 === 0 ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
    setParam(path, next);
  };
  rangeInput.addEventListener("input", () => update(rangeInput.value));
  numberInput.addEventListener("input", () => update(numberInput.value));
  numberInput.addEventListener("change", () => update(numberInput.value));
  return { element: row };
}

function select(label, path, value, options) {
  const row = document.createElement("label");
  row.className = "control-row";
  const choices = options.map(([optionValue, optionLabel]) => `<option value="${optionValue}">${optionLabel}</option>`).join("");
  row.innerHTML = `<span>${label}</span><select>${choices}</select>`;
  const input = row.querySelector("select");
  input.value = String(value);
  input.addEventListener("change", () => {
    const raw = input.value;
    setParam(path, Number.isFinite(Number(raw)) && raw.trim() !== "" ? Number(raw) : raw);
  });
  return { element: row };
}

function setParam(path, value) {
  const params = state.params.get(state.selectedKey);
  const parts = path.split(".");
  params[parts[0]][parts[1]] = value;
  params.preset = "custom";
  enforceParamRules(params);
  render();
}

function enforceParamRules(params) {
  if (params.macd.fast >= params.macd.slow) params.macd.slow = params.macd.fast + 1;
  if (params.rsi.oversold >= params.rsi.overbought) params.rsi.overbought = params.rsi.oversold + 1;
  if (params.ma.fast >= params.ma.mid) params.ma.mid = params.ma.fast + 1;
  if (params.ma.mid >= params.ma.slow) params.ma.slow = params.ma.mid + 1;
  if (params.kdj.oversold >= params.kdj.overbought) params.kdj.overbought = params.kdj.oversold + 1;
}

function syncToggleInputs(params) {
  els.toggleRsi.checked = params.toggles.rsi;
  els.toggleMacd.checked = params.toggles.macd;
  els.toggleBoll.checked = params.toggles.boll;
  els.toggleAtr.checked = params.toggles.atr;
  els.toggleMa.checked = params.toggles.ma;
  els.toggleKdj.checked = params.toggles.kdj;
  els.toggleObv.checked = params.toggles.obv;
}

function filteredRows(rows) {
  const range = state.dateRanges.get(state.selectedKey);
  return rows.filter((row) => row.date >= range.start && row.date <= range.end);
}

function movingAverage(values, window) {
  return values.map((_, idx) => {
    if (idx + 1 < window) return null;
    const slice = values.slice(idx + 1 - window, idx + 1).filter(Number.isFinite);
    return slice.length === window ? slice.reduce((sum, value) => sum + value, 0) / window : null;
  });
}

function ema(values, span) {
  const alpha = 2 / (span + 1);
  const out = [];
  let prev = null;
  values.forEach((value) => {
    if (!Number.isFinite(value)) {
      out.push(prev);
      return;
    }
    prev = prev == null ? value : alpha * value + (1 - alpha) * prev;
    out.push(prev);
  });
  return out;
}

function wilder(values, window) {
  const out = [];
  let prev = null;
  values.forEach((value, idx) => {
    if (!Number.isFinite(value)) {
      out.push(null);
      return;
    }
    if (idx + 1 < window) {
      out.push(null);
      return;
    }
    if (prev == null) {
      const seed = values.slice(idx + 1 - window, idx + 1).reduce((sum, item) => sum + item, 0) / window;
      prev = seed;
    } else {
      prev = (prev * (window - 1) + value) / window;
    }
    out.push(prev);
  });
  return out;
}

function smooth(values, window, mode) {
  if (mode === "ema") return ema(values, window);
  if (mode === "wilder") return wilder(values, window);
  return movingAverage(values, window);
}

function rollingStd(values, window, sample) {
  return values.map((_, idx) => {
    if (idx + 1 < window) return null;
    const slice = values.slice(idx + 1 - window, idx + 1);
    const mean = slice.reduce((sum, value) => sum + value, 0) / window;
    const denom = sample ? Math.max(window - 1, 1) : window;
    return Math.sqrt(slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / denom);
  });
}

function rollingMin(values, window) {
  return values.map((_, idx) => {
    if (idx + 1 < window) return null;
    const slice = values.slice(idx + 1 - window, idx + 1).filter(Number.isFinite);
    return slice.length === window ? Math.min(...slice) : null;
  });
}

function rollingMax(values, window) {
  return values.map((_, idx) => {
    if (idx + 1 < window) return null;
    const slice = values.slice(idx + 1 - window, idx + 1).filter(Number.isFinite);
    return slice.length === window ? Math.max(...slice) : null;
  });
}

function recursiveSmooth(values, window, seed = 50) {
  const alpha = 1 / Math.max(window, 1);
  const out = [];
  let prev = seed;
  values.forEach((value) => {
    if (!Number.isFinite(value)) {
      out.push(null);
      return;
    }
    prev = alpha * value + (1 - alpha) * prev;
    out.push(prev);
  });
  return out;
}

function obvDivisor(scale) {
  if (scale === "million") return 1_000_000;
  if (scale === "thousand") return 1_000;
  return 1;
}

function computeIndicators(rows, params) {
  const close = rows.map((row) => row.qfq_close);
  const high = rows.map((row) => row.qfq_high);
  const low = rows.map((row) => row.qfq_low);
  const preClose = rows.map((row) => row.qfq_pre_close);
  const volume = rows.map((row) => row.vol ?? 0);
  const changes = close.map((value, idx) => (idx === 0 ? 0 : value - close[idx - 1]));
  const gains = changes.map((value) => Math.max(value, 0));
  const losses = changes.map((value) => Math.max(-value, 0));
  const avgGain = smooth(gains, params.rsi.window, params.rsi.smoothing);
  const avgLoss = smooth(losses, params.rsi.window, params.rsi.smoothing);

  const maFast = params.macd.maType === "sma" ? movingAverage(close, params.macd.fast) : ema(close, params.macd.fast);
  const maSlow = params.macd.maType === "sma" ? movingAverage(close, params.macd.slow) : ema(close, params.macd.slow);
  const dif = close.map((_, idx) => (maFast[idx] == null || maSlow[idx] == null ? null : maFast[idx] - maSlow[idx]));
  const dea = params.macd.maType === "sma" ? movingAverage(dif.map((value) => value ?? 0), params.macd.signal) : ema(dif.map((value) => value ?? 0), params.macd.signal);

  const bollMid = params.boll.midType === "ema" ? ema(close, params.boll.window) : movingAverage(close, params.boll.window);
  const std = rollingStd(close, params.boll.window, params.boll.stdMode === "sample");
  const tr = close.map((_, idx) => Math.max(high[idx] - low[idx], Math.abs(high[idx] - preClose[idx]), Math.abs(low[idx] - preClose[idx])));
  const atr = smooth(tr, params.atr.window, params.atr.smoothing);
  const trendAverage = params.ma.maType === "ema" ? ema : movingAverage;
  const maFastLine = trendAverage(close, params.ma.fast);
  const maMidLine = trendAverage(close, params.ma.mid);
  const maSlowLine = trendAverage(close, params.ma.slow);
  const lowN = rollingMin(low, params.kdj.window);
  const highN = rollingMax(high, params.kdj.window);
  const rsv = close.map((value, idx) => {
    if (lowN[idx] == null || highN[idx] == null) return null;
    const range = highN[idx] - lowN[idx];
    return range === 0 ? 50 : ((value - lowN[idx]) / range) * 100;
  });
  const kdjK = recursiveSmooth(rsv, params.kdj.kSmoothing);
  const kdjD = recursiveSmooth(kdjK, params.kdj.dSmoothing);
  const kdjJ = kdjK.map((value, idx) => (value == null || kdjD[idx] == null ? null : 3 * value - 2 * kdjD[idx]));
  const obv = [];
  let obvValue = 0;
  close.forEach((value, idx) => {
    if (idx === 0) {
      obv.push(0);
      return;
    }
    const direction = value > close[idx - 1] ? 1 : value < close[idx - 1] ? -1 : 0;
    obvValue += direction * volume[idx];
    obv.push(obvValue);
  });
  const obvMa = movingAverage(obv, params.obv.maWindow);
  const divisor = obvDivisor(params.obv.scale);

  return rows.map((row, idx) => {
    const rs = avgLoss[idx] === 0 ? null : avgGain[idx] / avgLoss[idx];
    const rsi = avgLoss[idx] === 0 && avgGain[idx] > 0 ? 100 : rs == null ? null : 100 - 100 / (1 + rs);
    const upper = bollMid[idx] == null || std[idx] == null ? null : bollMid[idx] + params.boll.std * std[idx];
    const lower = bollMid[idx] == null || std[idx] == null ? null : bollMid[idx] - params.boll.std * std[idx];
    const hist = dif[idx] == null || dea[idx] == null ? null : (dif[idx] - dea[idx]) * params.macd.histScale;
    return {
      ...row,
      rsi_14: rsi,
      macd_dif: dif[idx],
      macd_dea: dea[idx],
      macd_hist: hist,
      boll_mid_20: bollMid[idx],
      boll_upper_20_2: upper,
      boll_lower_20_2: lower,
      boll_width: upper == null || lower == null || bollMid[idx] == null ? null : (upper - lower) / bollMid[idx],
      tr: tr[idx],
      atr_14: atr[idx],
      atr_display: params.atr.display === "percent" && atr[idx] != null ? (atr[idx] / row.qfq_close) * 100 : atr[idx],
      ma_fast: maFastLine[idx],
      ma_mid: maMidLine[idx],
      ma_slow: maSlowLine[idx],
      kdj_rsv: rsv[idx],
      kdj_k: kdjK[idx],
      kdj_d: kdjD[idx],
      kdj_j: kdjJ[idx],
      obv_value: obv[idx],
      obv_ma: obvMa[idx],
      obv_display: obv[idx] / divisor,
      obv_ma_display: obvMa[idx] == null ? null : obvMa[idx] / divisor,
    };
  });
}

function lastValid(rows) {
  for (let idx = rows.length - 1; idx >= 0; idx -= 1) {
    const row = rows[idx];
    if ([row.rsi_14, row.macd_dif, row.macd_dea, row.boll_mid_20, row.atr_14, row.ma_mid, row.kdj_k, row.obv_display].every((value) => value != null && Number.isFinite(value))) {
      return row;
    }
  }
  return rows[rows.length - 1];
}

function renderCharts(rows, params) {
  els.maLabel.textContent = params.toggles.ma ? `MA ${params.ma.fast}/${params.ma.mid}/${params.ma.slow} · ${params.ma.maType.toUpperCase()}` : "MA hidden";
  els.bollLabel.textContent = params.toggles.boll ? `BOLL ${params.boll.window}, ${params.boll.std}σ` : "BOLL hidden";
  els.rsiLabel.textContent = params.toggles.rsi ? `${params.rsi.window}d · ${params.rsi.oversold}/${params.rsi.overbought}` : "hidden";
  els.macdLabel.textContent = params.toggles.macd ? `${params.macd.fast}/${params.macd.slow}/${params.macd.signal}` : "hidden";
  els.atrLabel.textContent = params.toggles.atr ? `${params.atr.window}d · ${params.atr.display}` : "hidden";
  els.kdjLabel.textContent = params.toggles.kdj ? `${params.kdj.window}/${params.kdj.kSmoothing}/${params.kdj.dSmoothing}` : "hidden";
  els.obvLabel.textContent = params.toggles.obv ? `MA ${params.obv.maWindow} · ${params.obv.scale}` : "hidden";

  renderPriceChart(document.getElementById("priceChart"), rows, params);
  renderLineChart(document.getElementById("rsiChart"), rows, params.toggles.rsi ? [{ key: "rsi_14", cls: "line-blue" }] : [], { min: 0, max: 100, refs: [params.rsi.oversold, params.rsi.overbought] });
  renderMacdChart(document.getElementById("macdChart"), rows, params);
  renderLineChart(document.getElementById("atrChart"), rows, params.toggles.atr ? [{ key: "atr_display", cls: "line-purple" }] : [], {});
  renderKdjChart(document.getElementById("kdjChart"), rows, params);
  renderLineChart(document.getElementById("obvChart"), rows, params.toggles.obv ? [{ key: "obv_display", cls: "line-blue" }, { key: "obv_ma_display", cls: "line-orange" }] : [], {});
}

function renderPriceChart(svg, rows, params) {
  const series = [{ key: "qfq_close", cls: "line-blue" }];
  if (params.toggles.ma) {
    series.push({ key: "ma_fast", cls: "line-orange" }, { key: "ma_mid", cls: "line-green" }, { key: "ma_slow", cls: "line-purple" });
  }
  if (params.toggles.boll) {
    series.push({ key: "boll_mid_20", cls: "line-slate" }, { key: "boll_upper_20_2", cls: "line-red" }, { key: "boll_lower_20_2", cls: "line-red" });
  }
  renderLineChart(svg, rows, series, { band: params.toggles.boll ? ["boll_upper_20_2", "boll_lower_20_2"] : null });
}

function renderMacdChart(svg, rows, params) {
  if (!params.toggles.macd) {
    renderLineChart(svg, rows, [], {});
    return;
  }
  const plot = setupSvg(svg, rows, ["macd_dif", "macd_dea", "macd_hist"]);
  drawBars(plot, rows, "macd_hist");
  drawLine(plot, rows, "macd_dif", "line-blue");
  drawLine(plot, rows, "macd_dea", "line-orange");
}

function renderKdjChart(svg, rows, params) {
  renderLineChart(
    svg,
    rows,
    params.toggles.kdj
      ? [
          { key: "kdj_k", cls: "line-blue" },
          { key: "kdj_d", cls: "line-orange" },
          { key: "kdj_j", cls: "line-purple" },
        ]
      : [],
    { refs: [params.kdj.oversold, params.kdj.overbought] }
  );
}

function renderLineChart(svg, rows, series, options) {
  const keys = series.map((item) => item.key);
  if (options.band) keys.push(...options.band);
  const plot = setupSvg(svg, rows, keys, options);
  if (options.band) drawBand(plot, rows, options.band[0], options.band[1]);
  (options.refs || []).forEach((value) => drawReference(plot, value));
  series.forEach((item) => drawLine(plot, rows, item.key, item.cls));
}

function setupSvg(svg, rows, keys, options = {}) {
  const width = svg.clientWidth || 600;
  const height = svg.clientHeight || 260;
  const margin = { top: 18, right: 46, bottom: 32, left: 52 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";
  const values = keys.flatMap((key) => rows.map((row) => row[key]).filter((value) => value != null && Number.isFinite(value)));
  if (options.refs) values.push(...options.refs.filter((value) => Number.isFinite(value)));
  let minY = options.min ?? Math.min(...values);
  let maxY = options.max ?? Math.max(...values);
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    minY = 0;
    maxY = 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const pad = (maxY - minY) * 0.08;
  if (options.min == null) minY -= pad;
  if (options.max == null) maxY += pad;
  const x = (idx) => margin.left + (idx / Math.max(rows.length - 1, 1)) * (width - margin.left - margin.right);
  const y = (value) => margin.top + ((maxY - value) / (maxY - minY)) * (height - margin.top - margin.bottom);
  drawGrid(svg, width, height, margin, minY, maxY, y);
  return { svg, rows, width, height, margin, x, y, minY, maxY };
}

function drawGrid(svg, width, height, margin, minY, maxY, y) {
  for (let i = 0; i <= 4; i += 1) {
    const value = minY + ((maxY - minY) * i) / 4;
    const yy = y(value);
    append(svg, "line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, class: "svg-grid" });
    append(svg, "text", { x: 8, y: yy + 4, class: "svg-label" }, formatNumber(value, 1));
  }
  append(svg, "line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: "svg-axis" });
  append(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: "svg-axis" });
}

function drawLine(plot, rows, key, cls) {
  const points = rows
    .map((row, idx) => (row[key] == null || !Number.isFinite(row[key]) ? null : `${plot.x(idx)},${plot.y(row[key])}`))
    .filter(Boolean)
    .join(" ");
  if (points) append(plot.svg, "polyline", { points, class: cls });
}

function drawBand(plot, rows, upperKey, lowerKey) {
  const upper = [];
  const lower = [];
  rows.forEach((row, idx) => {
    if ([row[upperKey], row[lowerKey]].every((value) => value != null && Number.isFinite(value))) {
      upper.push(`${plot.x(idx)},${plot.y(row[upperKey])}`);
      lower.unshift(`${plot.x(idx)},${plot.y(row[lowerKey])}`);
    }
  });
  if (upper.length) append(plot.svg, "polygon", { points: [...upper, ...lower].join(" "), class: "band-fill" });
}

function drawBars(plot, rows, key) {
  const zero = Math.max(plot.margin.top, Math.min(plot.height - plot.margin.bottom, plot.y(0)));
  const barWidth = Math.max(1, (plot.width - plot.margin.left - plot.margin.right) / Math.max(rows.length, 1) - 1);
  rows.forEach((row, idx) => {
    const value = row[key];
    if (value == null || !Number.isFinite(value)) return;
    const yy = plot.y(value);
    append(plot.svg, "rect", {
      x: plot.x(idx) - barWidth / 2,
      y: Math.min(yy, zero),
      width: barWidth,
      height: Math.max(Math.abs(zero - yy), 1),
      class: value >= 0 ? "bar-positive" : "bar-negative",
    });
  });
}

function drawReference(plot, value) {
  const yy = plot.y(value);
  append(plot.svg, "line", { x1: plot.margin.left, y1: yy, x2: plot.width - plot.margin.right, y2: yy, class: "svg-axis", "stroke-dasharray": "4 4" });
}

function append(svg, tag, attrs, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text != null) node.textContent = text;
  svg.appendChild(node);
  return node;
}

function renderSummary(latest, data, params) {
  els.latestDate.textContent = latest ? latest.trade_date : "-";
  els.latestClose.textContent = latest ? `${formatNumber(latest.qfq_close)} ${data.currency}` : "-";
  els.latestRsi.textContent = latest ? formatNumber(latest.rsi_14) : "-";
  els.latestMacd.textContent = latest ? formatNumber(latest.macd_hist, 3) : "-";
  els.latestAtr.textContent = latest ? formatNumber(latest.atr_14) : "-";
  els.latestMa.textContent = latest ? `${formatNumber(latest.ma_fast)}/${formatNumber(latest.ma_mid)}/${formatNumber(latest.ma_slow)}` : "-";
  els.latestKdj.textContent = latest ? formatNumber(latest.kdj_j) : "-";
  els.latestObv.textContent = latest ? formatNumber(latest.obv_display, 2) : "-";
  els.comboState.textContent = latest ? combinedState(latest, params) : "-";
}

function combinedState(row, params) {
  const trend = row.macd_hist > 0 && row.rsi_14 > 50 ? "动能偏强" : row.macd_hist < 0 && row.rsi_14 < 50 ? "动能偏弱" : "指标分歧";
  const position = row.qfq_close > row.boll_upper_20_2 ? "高于上轨" : row.qfq_close < row.boll_lower_20_2 ? "低于下轨" : "轨道内";
  const heat = row.rsi_14 > params.rsi.overbought ? "RSI偏热" : row.rsi_14 < params.rsi.oversold ? "RSI偏冷" : "RSI中性";
  const maTrend = row.ma_fast > row.ma_mid && row.ma_mid > row.ma_slow ? "均线多头" : row.ma_fast < row.ma_mid && row.ma_mid < row.ma_slow ? "均线空头" : "均线交织";
  return `${trend} · ${position} · ${heat} · ${maTrend}`;
}

function downloadIndicatorCsv() {
  const data = state.datasets.get(state.selectedKey);
  const params = state.params.get(state.selectedKey);
  const rows = computeIndicators(filteredRows(data.rows), params);
  const headers = ["trade_date", "ts_code", "qfq_open", "qfq_high", "qfq_low", "qfq_close", "rsi_14", "macd_dif", "macd_dea", "macd_hist", "boll_mid_20", "boll_upper_20_2", "boll_lower_20_2", "boll_width", "tr", "atr_14", "ma_fast", "ma_mid", "ma_slow", "kdj_rsv", "kdj_k", "kdj_d", "kdj_j", "obv_value", "obv_ma", "obv_display", "obv_ma_display"];
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => row[key] ?? "").join(","))].join("\n");
  downloadBlob(csv, `${state.selectedKey}_indicators.csv`, "text/csv;charset=utf-8");
}

function downloadParamsJson() {
  const data = state.datasets.get(state.selectedKey);
  const payload = {
    instrument_key: state.selectedKey,
    ts_code: data.tsCode,
    price_basis: "adjusted",
    data_provider: data.provider,
    params: state.params.get(state.selectedKey),
  };
  downloadBlob(JSON.stringify(payload, null, 2), `${state.selectedKey}_params.json`, "application/json");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function boot() {
  initControls();
  await loadData();
  syncDateInputs();
  render();
}

window.addEventListener("resize", () => render());
boot();
