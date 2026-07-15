import { inverseNormal } from "./stats.js";

const COLORS = {
  ink: "#162033",
  muted: "#667085",
  grid: "#e8ebf0",
  blue: "#2457d6",
  teal: "#0f9f8f",
  orange: "#e87929",
  red: "#c43d4b",
  white: "#ffffff",
};

function compactNumber(value) {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1e6 || (absolute > 0 && absolute < 1e-3)) return value.toExponential(2);
  if (absolute >= 1e3) return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function extent(values) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  if (!Number.isFinite(minimum)) return [0, 1];
  if (minimum === maximum) {
    const padding = Math.abs(minimum || 1) * 0.1;
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.06;
  return [minimum - padding, maximum + padding];
}

function setupCanvas(canvas) {
  const width = Math.max(300, canvas.clientWidth || canvas.parentElement?.clientWidth || 600);
  const height = Math.max(270, Math.min(360, width * 0.55));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawAxes(context, width, height, xDomain, yDomain, xLabel, yLabel) {
  const margin = { left: 64, right: 18, top: 20, bottom: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xScale = (value) => margin.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerWidth;
  const yScale = (value) => margin.top + innerHeight - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerHeight;

  context.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillStyle = COLORS.muted;
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index <= 5; index += 1) {
    const xValue = xDomain[0] + ((xDomain[1] - xDomain[0]) * index) / 5;
    const x = xScale(xValue);
    context.beginPath();
    context.moveTo(x, margin.top);
    context.lineTo(x, margin.top + innerHeight);
    context.stroke();
    context.textAlign = "center";
    context.fillText(compactNumber(xValue), x, margin.top + innerHeight + 20);

    const yValue = yDomain[0] + ((yDomain[1] - yDomain[0]) * index) / 5;
    const y = yScale(yValue);
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(margin.left + innerWidth, y);
    context.stroke();
    context.textAlign = "right";
    context.fillText(compactNumber(yValue), margin.left - 9, y + 4);
  }

  context.strokeStyle = "#c8ced8";
  context.strokeRect(margin.left, margin.top, innerWidth, innerHeight);
  context.fillStyle = COLORS.ink;
  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.textAlign = "center";
  context.fillText(xLabel, margin.left + innerWidth / 2, height - 10);
  context.save();
  context.translate(15, margin.top + innerHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(yLabel, 0, 0);
  context.restore();

  return { xScale, yScale, margin, innerWidth, innerHeight };
}

function sampleRows(rows, maximum = 5000) {
  if (rows.length <= maximum) return rows;
  const selected = [];
  const seen = new Set();
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.round((index * (rows.length - 1)) / (maximum - 1));
    selected.push(rows[sourceIndex]);
    seen.add(rows[sourceIndex].rowId);
  }
  for (const row of rows) {
    if (row.flags?.length && !seen.has(row.rowId)) selected.push(row);
  }
  return selected;
}

function bindTooltip(canvas, points, formatter) {
  if (canvas.__tooltipMove) canvas.removeEventListener("pointermove", canvas.__tooltipMove);
  if (canvas.__tooltipLeave) canvas.removeEventListener("pointerleave", canvas.__tooltipLeave);
  const tooltip = canvas.parentElement.querySelector(".chart-tooltip");
  const move = (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    let closest = null;
    let distance = 12 ** 2;
    for (const point of points) {
      const candidate = (point.screenX - x) ** 2 + (point.screenY - y) ** 2;
      if (candidate < distance) {
        closest = point;
        distance = candidate;
      }
    }
    if (!closest) {
      tooltip.hidden = true;
      return;
    }
    tooltip.textContent = formatter(closest);
    tooltip.hidden = false;
    const left = Math.min(bounds.width - tooltip.offsetWidth - 8, Math.max(8, x + 12));
    const top = Math.min(bounds.height - tooltip.offsetHeight - 8, Math.max(8, y + 12));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  const leave = () => { tooltip.hidden = true; };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerleave", leave);
  canvas.__tooltipMove = move;
  canvas.__tooltipLeave = leave;
}

function binnedTrend(points, xAccessor, yAccessor, binCount = 14) {
  const sorted = points.slice().sort((a, b) => xAccessor(a) - xAccessor(b));
  const size = Math.max(1, Math.ceil(sorted.length / binCount));
  const trend = [];
  for (let index = 0; index < sorted.length; index += size) {
    const bin = sorted.slice(index, index + size);
    trend.push({ x: mean(bin.map(xAccessor)), y: mean(bin.map(yAccessor)) });
  }
  return trend;
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function scatterPlot(canvas, rows, {
  xAccessor,
  yAccessor,
  xLabel,
  yLabel,
  referenceLine,
  trend = false,
  pointRadius,
  tooltip,
  guides = [],
}) {
  const sampled = sampleRows(rows);
  const xValues = sampled.map(xAccessor);
  const yValues = sampled.map(yAccessor);
  let xDomain = extent(xValues);
  let yDomain = extent(yValues);
  if (referenceLine?.unifiedDomain) {
    const combined = extent([...xValues, ...yValues]);
    xDomain = combined;
    yDomain = combined;
  }
  const { context, width, height } = setupCanvas(canvas);
  const axes = drawAxes(context, width, height, xDomain, yDomain, xLabel, yLabel);

  for (const guide of guides) {
    context.strokeStyle = guide.color || COLORS.orange;
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    if (guide.axis === "x" && guide.value >= xDomain[0] && guide.value <= xDomain[1]) {
      const x = axes.xScale(guide.value);
      context.moveTo(x, axes.margin.top);
      context.lineTo(x, axes.margin.top + axes.innerHeight);
    } else if (guide.axis === "y" && guide.value >= yDomain[0] && guide.value <= yDomain[1]) {
      const y = axes.yScale(guide.value);
      context.moveTo(axes.margin.left, y);
      context.lineTo(axes.margin.left + axes.innerWidth, y);
    }
    context.stroke();
    context.setLineDash([]);
  }

  if (referenceLine) {
    context.strokeStyle = referenceLine.color || COLORS.orange;
    context.lineWidth = 1.5;
    context.setLineDash([6, 5]);
    context.beginPath();
    const startY = referenceLine.yForX(xDomain[0]);
    const endY = referenceLine.yForX(xDomain[1]);
    context.moveTo(axes.xScale(xDomain[0]), axes.yScale(startY));
    context.lineTo(axes.xScale(xDomain[1]), axes.yScale(endY));
    context.stroke();
    context.setLineDash([]);
  }

  if (trend && sampled.length > 4) {
    const trendPoints = binnedTrend(sampled, xAccessor, yAccessor);
    context.strokeStyle = COLORS.teal;
    context.lineWidth = 2;
    context.beginPath();
    trendPoints.forEach((point, index) => {
      const x = axes.xScale(point.x);
      const y = axes.yScale(point.y);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  const screenPoints = [];
  for (const row of sampled) {
    const screenX = axes.xScale(xAccessor(row));
    const screenY = axes.yScale(yAccessor(row));
    const radius = pointRadius ? pointRadius(row) : 3.2;
    const flagged = row.flags?.length > 0;
    context.fillStyle = flagged ? "rgba(196,61,75,.78)" : "rgba(36,87,214,.52)";
    context.beginPath();
    context.arc(screenX, screenY, radius, 0, Math.PI * 2);
    context.fill();
    if (flagged) {
      context.strokeStyle = COLORS.white;
      context.lineWidth = 1;
      context.stroke();
    }
    screenPoints.push({ ...row, screenX, screenY, chartX: xAccessor(row), chartY: yAccessor(row) });
  }
  bindTooltip(canvas, screenPoints, tooltip);
}

function histogram(canvas, residuals) {
  const { context, width, height } = setupCanvas(canvas);
  const [minimum, maximum] = extent(residuals);
  const binCount = Math.max(10, Math.min(30, Math.round(Math.sqrt(residuals.length))));
  const rawMin = Math.min(...residuals);
  const rawMax = Math.max(...residuals);
  const binWidth = rawMax === rawMin ? 1 : (rawMax - rawMin) / binCount;
  const bins = new Array(binCount).fill(0);
  for (const value of residuals) {
    const index = Math.min(binCount - 1, Math.floor((value - rawMin) / binWidth));
    bins[Math.max(0, index)] += 1;
  }
  const maximumCount = Math.max(...bins);
  const average = mean(residuals);
  const standardDeviation = Math.sqrt(mean(residuals.map((value) => (value - average) ** 2)));
  const normalPeak = standardDeviation > 0
    ? residuals.length * binWidth / (standardDeviation * Math.sqrt(2 * Math.PI))
    : 0;
  const axes = drawAxes(context, width, height, [minimum, maximum], [0, Math.max(maximumCount, normalPeak) * 1.1], "残差", "频数");
  const plotBinWidth = axes.innerWidth / binCount;
  bins.forEach((count, index) => {
    const x = axes.margin.left + index * plotBinWidth + 1;
    const y = axes.yScale(count);
    context.fillStyle = "rgba(36,87,214,.65)";
    context.fillRect(x, y, Math.max(1, plotBinWidth - 2), axes.yScale(0) - y);
  });
  if (standardDeviation > 0) {
    context.strokeStyle = COLORS.orange;
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index <= 120; index += 1) {
      const xValue = minimum + ((maximum - minimum) * index) / 120;
      const z = (xValue - average) / standardDeviation;
      const yValue = residuals.length * binWidth * Math.exp(-0.5 * z ** 2)
        / (standardDeviation * Math.sqrt(2 * Math.PI));
      const x = axes.xScale(xValue);
      const y = axes.yScale(yValue);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}

function qqPlot(canvas, rows) {
  const sorted = rows.slice().sort((a, b) => a.residual - b.residual);
  const qqRows = sorted.map((row, index) => ({
    ...row,
    theoretical: inverseNormal((index + 0.5) / sorted.length),
  }));
  const residualAverage = mean(sorted.map((row) => row.residual));
  const residualStd = Math.sqrt(mean(sorted.map((row) => (row.residual - residualAverage) ** 2)));
  scatterPlot(canvas, qqRows, {
    xAccessor: (row) => row.theoretical,
    yAccessor: (row) => row.residual,
    xLabel: "理论正态分位数",
    yLabel: "样本残差分位数",
    referenceLine: { yForX: (x) => residualAverage + residualStd * x, color: COLORS.orange },
    tooltip: (point) => `CSV 第 ${point.rowId} 行 · 理论 ${compactNumber(point.chartX)} · 残差 ${compactNumber(point.chartY)}`,
  });
}

export function renderCharts(result) {
  const rows = result.rows;
  scatterPlot(document.querySelector("#chart-actual"), rows, {
    xAccessor: (row) => row.actual,
    yAccessor: (row) => row.fitted,
    xLabel: `实际值 · ${result.meta.yName}`,
    yLabel: `预测值 · ${result.meta.yName}`,
    referenceLine: { yForX: (x) => x, unifiedDomain: true, color: COLORS.orange },
    tooltip: (point) => `CSV 第 ${point.rowId} 行 · 实际 ${compactNumber(point.chartX)} · 预测 ${compactNumber(point.chartY)}`,
  });

  scatterPlot(document.querySelector("#chart-residual"), rows, {
    xAccessor: (row) => row.fitted,
    yAccessor: (row) => row.residual,
    xLabel: "拟合值",
    yLabel: "残差",
    referenceLine: { yForX: () => 0, color: COLORS.orange },
    trend: true,
    tooltip: (point) => `CSV 第 ${point.rowId} 行 · 拟合 ${compactNumber(point.chartX)} · 残差 ${compactNumber(point.chartY)}`,
  });

  histogram(document.querySelector("#chart-histogram"), rows.map((row) => row.residual));
  qqPlot(document.querySelector("#chart-qq"), rows);

  scatterPlot(document.querySelector("#chart-scale"), rows, {
    xAccessor: (row) => row.fitted,
    yAccessor: (row) => Math.sqrt(Math.abs(row.studentized)),
    xLabel: "拟合值",
    yLabel: "√|学生化残差|",
    trend: true,
    tooltip: (point) => `CSV 第 ${point.rowId} 行 · 拟合 ${compactNumber(point.chartX)} · √|残差| ${compactNumber(point.chartY)}`,
  });

  scatterPlot(document.querySelector("#chart-leverage"), rows, {
    xAccessor: (row) => row.leverage,
    yAccessor: (row) => row.studentized,
    xLabel: "Leverage",
    yLabel: "学生化残差",
    pointRadius: (row) => Math.min(10, 3 + Math.sqrt(Math.max(0, row.cooksDistance)) * 5),
    guides: [
      { axis: "x", value: result.diagnostics.thresholds.leverage, color: COLORS.orange },
      { axis: "y", value: 2, color: COLORS.red },
      { axis: "y", value: -2, color: COLORS.red },
    ],
    tooltip: (point) => `CSV 第 ${point.rowId} 行 · Leverage ${compactNumber(point.chartX)} · 学生化残差 ${compactNumber(point.chartY)} · Cook's D ${compactNumber(point.cooksDistance)}`,
  });
}
