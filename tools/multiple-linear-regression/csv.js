const MISSING_TOKENS = new Set(["", "na", "n/a", "null", "nan"]);
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseRecords(text, delimiter, allowUnclosedQuote = false) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        field += "\n";
        line += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      records.push({ values: row, line: recordLine });
      row = [];
      field = "";
      line += 1;
      recordLine = line;
    } else {
      field += character;
    }
  }

  if (inQuotes && !allowUnclosedQuote) {
    throw new Error(`第 ${recordLine} 行存在未闭合的引号。`);
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push({ values: row, line: recordLine });
  }

  return records;
}

function mode(values) {
  const counts = new Map();
  let bestValue = null;
  let bestCount = 0;
  for (const value of values) {
    const next = (counts.get(value) || 0) + 1;
    counts.set(value, next);
    if (next > bestCount) {
      bestValue = value;
      bestCount = next;
    }
  }
  return { value: bestValue, count: bestCount };
}

export function detectDelimiter(text) {
  const sample = text.slice(0, 200_000);
  const candidates = [",", "\t", ";"];
  let winner = { delimiter: ",", score: -Infinity };

  for (const delimiter of candidates) {
    let records;
    try {
      records = parseRecords(sample, delimiter, true)
        .filter((record) => record.values.some((value) => value.trim() !== ""))
        .slice(0, 30);
    } catch {
      continue;
    }
    if (!records.length) continue;
    const widths = records.map((record) => record.values.length);
    const common = mode(widths);
    const consistency = common.count / widths.length;
    const score = common.value > 1 ? common.value * consistency : -1;
    if (score > winner.score) winner = { delimiter, score };
  }

  return winner.delimiter;
}

export function parseNumeric(value) {
  const normalized = String(value ?? "").trim();
  if (MISSING_TOKENS.has(normalized.toLowerCase())) {
    return { kind: "missing", value: null };
  }
  if (!NUMBER_PATTERN.test(normalized)) {
    return { kind: "invalid", value: null };
  }
  const number = Number(normalized);
  return Number.isFinite(number)
    ? { kind: "number", value: number }
    : { kind: "invalid", value: null };
}

export function inferColumns(headers, records) {
  return headers.map((name, columnIndex) => {
    let numericCount = 0;
    let missingCount = 0;
    let invalidCount = 0;
    const invalidExamples = [];

    for (const record of records) {
      const parsed = parseNumeric(record.values[columnIndex]);
      if (parsed.kind === "number") numericCount += 1;
      if (parsed.kind === "missing") missingCount += 1;
      if (parsed.kind === "invalid") {
        invalidCount += 1;
        if (invalidExamples.length < 3) {
          invalidExamples.push({ line: record.line, value: record.values[columnIndex] });
        }
      }
    }

    let type = "text";
    if (numericCount === 0 && invalidCount === 0) type = "empty";
    else if (numericCount > 0 && invalidCount === 0) type = "numeric";
    else if (numericCount > 0) type = "mixed";

    return {
      name,
      index: columnIndex,
      type,
      numericCount,
      missingCount,
      invalidCount,
      invalidExamples,
    };
  });
}

export function parseCsv(text, requestedDelimiter = "auto") {
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("CSV 内容为空。请上传文件或粘贴包含表头的数据。 ");
  }

  const normalized = text.replace(/^\uFEFF/, "");
  const delimiter = requestedDelimiter === "auto" ? detectDelimiter(normalized) : requestedDelimiter;
  const parsed = parseRecords(normalized, delimiter);
  const nonEmpty = parsed.filter((record) => record.values.some((value) => value.trim() !== ""));
  const skippedBlankRows = parsed.length - nonEmpty.length;

  if (nonEmpty.length < 2) {
    throw new Error("CSV 至少需要一行表头和一行数据。 ");
  }

  const headers = nonEmpty[0].values.map((value) => value.trim());
  const emptyHeaderIndex = headers.findIndex((header) => header === "");
  if (emptyHeaderIndex >= 0) {
    throw new Error(`第 ${emptyHeaderIndex + 1} 列的字段名为空。请补充字段名后重试。`);
  }

  const seen = new Map();
  for (const header of headers) {
    const normalizedHeader = header.toLocaleLowerCase();
    if (seen.has(normalizedHeader)) {
      throw new Error(`存在重复字段名“${header}”。字段名必须唯一。`);
    }
    seen.set(normalizedHeader, true);
  }

  const warnings = [];
  const records = [];
  for (const sourceRecord of nonEmpty.slice(1)) {
    const values = sourceRecord.values.slice();
    if (values.length > headers.length) {
      throw new Error(`第 ${sourceRecord.line} 行有 ${values.length} 列，但表头只有 ${headers.length} 列。`);
    }
    if (values.length < headers.length) {
      warnings.push(`第 ${sourceRecord.line} 行缺少 ${headers.length - values.length} 个尾部字段，已按空值处理。`);
      while (values.length < headers.length) values.push("");
    }
    records.push({ values, line: sourceRecord.line });
  }

  if (skippedBlankRows) warnings.push(`已忽略 ${skippedBlankRows} 个空白行。`);
  const columns = inferColumns(headers, records);

  return {
    headers,
    records,
    columns,
    delimiter,
    warnings,
    rowCount: records.length,
    columnCount: headers.length,
  };
}

export function delimiterLabel(delimiter) {
  if (delimiter === "\t") return "制表符";
  if (delimiter === ";") return "分号";
  return "逗号";
}
