const EPSILON = 1e-12;

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values) {
  return sum(values) / values.length;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(sum(values.map((value) => (value - average) ** 2)) / (values.length - 1));
}

function quantileSorted(sorted, probability) {
  if (!sorted.length) return NaN;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }
  let x = 0.99999999999980993;
  const shifted = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a, b, x) {
  const maxIterations = 200;
  const tiny = 1e-300;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logTerm = logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log1p(-x);
  const factor = Math.exp(logTerm);
  if (x < (a + 1) / (a + b + 2)) {
    return (factor * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (factor * betaContinuedFraction(b, a, 1 - x)) / b;
}

export function studentTCdf(value, degreesOfFreedom) {
  if (!Number.isFinite(value)) return value < 0 ? 0 : 1;
  if (!(degreesOfFreedom > 0)) return NaN;
  const x = degreesOfFreedom / (degreesOfFreedom + value ** 2);
  const probability = 0.5 * regularizedBeta(x, degreesOfFreedom / 2, 0.5);
  return value >= 0 ? 1 - probability : probability;
}

function studentTQuantile(probability, degreesOfFreedom) {
  if (!(probability > 0 && probability < 1) || !(degreesOfFreedom > 0)) return NaN;
  if (probability === 0.5) return 0;
  if (probability < 0.5) return -studentTQuantile(1 - probability, degreesOfFreedom);
  let lower = 0;
  let upper = 1;
  while (studentTCdf(upper, degreesOfFreedom) < probability && upper < 1e6) upper *= 2;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (studentTCdf(middle, degreesOfFreedom) < probability) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

function fSurvival(value, numeratorDf, denominatorDf) {
  if (!(value >= 0) || !(numeratorDf > 0) || !(denominatorDf > 0)) return NaN;
  if (!Number.isFinite(value)) return 0;
  const x = (numeratorDf * value) / (numeratorDf * value + denominatorDf);
  return Math.max(0, Math.min(1, 1 - regularizedBeta(x, numeratorDf / 2, denominatorDf / 2)));
}

function regularizedGammaP(shape, value) {
  if (value <= 0) return 0;
  if (value < shape + 1) {
    let term = 1 / shape;
    let total = term;
    let current = shape;
    for (let iteration = 1; iteration <= 200; iteration += 1) {
      current += 1;
      term *= value / current;
      total += term;
      if (Math.abs(term) < Math.abs(total) * 1e-14) break;
    }
    return total * Math.exp(-value + shape * Math.log(value) - logGamma(shape));
  }

  const tiny = 1e-300;
  let b = value + 1 - shape;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let iteration = 1; iteration <= 200; iteration += 1) {
    const an = -iteration * (iteration - shape);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  const q = Math.exp(-value + shape * Math.log(value) - logGamma(shape)) * h;
  return 1 - q;
}

function chiSquareSurvival(value, degreesOfFreedom) {
  if (!(value >= 0) || !(degreesOfFreedom > 0)) return NaN;
  return Math.max(0, Math.min(1, 1 - regularizedGammaP(degreesOfFreedom / 2, value / 2)));
}

export function inverseNormal(probability) {
  if (probability <= 0) return -Infinity;
  if (probability >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  let q;
  let r;
  if (probability < low) {
    q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability <= high) {
    q = probability - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function qrDecomposeAndSolve(inputMatrix, inputVector) {
  const matrix = inputMatrix.map((row) => row.slice());
  const transformed = inputVector.slice();
  const n = matrix.length;
  const p = matrix[0].length;
  const pivot = Array.from({ length: p }, (_, index) => index);
  let maximumColumnNorm = 0;
  for (let column = 0; column < p; column += 1) {
    let squaredNorm = 0;
    for (let row = 0; row < n; row += 1) squaredNorm += matrix[row][column] ** 2;
    maximumColumnNorm = Math.max(maximumColumnNorm, Math.sqrt(squaredNorm));
  }
  const tolerance = EPSILON * Math.max(1, maximumColumnNorm) * Math.max(n, p);
  let rank = p;

  for (let column = 0; column < p; column += 1) {
    let bestColumn = column;
    let bestSquaredNorm = -1;
    for (let candidate = column; candidate < p; candidate += 1) {
      let squaredNorm = 0;
      for (let row = column; row < n; row += 1) squaredNorm += matrix[row][candidate] ** 2;
      if (squaredNorm > bestSquaredNorm) {
        bestSquaredNorm = squaredNorm;
        bestColumn = candidate;
      }
    }

    if (Math.sqrt(Math.max(0, bestSquaredNorm)) <= tolerance) {
      rank = column;
      break;
    }

    if (bestColumn !== column) {
      for (let row = 0; row < n; row += 1) {
        [matrix[row][column], matrix[row][bestColumn]] = [matrix[row][bestColumn], matrix[row][column]];
      }
      [pivot[column], pivot[bestColumn]] = [pivot[bestColumn], pivot[column]];
    }

    let norm = 0;
    for (let row = column; row < n; row += 1) norm = Math.hypot(norm, matrix[row][column]);
    const alpha = matrix[column][column] >= 0 ? -norm : norm;
    const vector = [];
    for (let row = column; row < n; row += 1) vector.push(matrix[row][column]);
    vector[0] -= alpha;
    const vectorSquaredNorm = sum(vector.map((value) => value ** 2));
    if (vectorSquaredNorm <= tolerance ** 2) {
      rank = column;
      break;
    }
    const beta = 2 / vectorSquaredNorm;

    for (let targetColumn = column; targetColumn < p; targetColumn += 1) {
      let projection = 0;
      for (let row = column; row < n; row += 1) projection += vector[row - column] * matrix[row][targetColumn];
      projection *= beta;
      for (let row = column; row < n; row += 1) matrix[row][targetColumn] -= projection * vector[row - column];
    }

    let vectorProjection = 0;
    for (let row = column; row < n; row += 1) vectorProjection += vector[row - column] * transformed[row];
    vectorProjection *= beta;
    for (let row = column; row < n; row += 1) transformed[row] -= vectorProjection * vector[row - column];

    matrix[column][column] = alpha;
    for (let row = column + 1; row < n; row += 1) matrix[row][column] = 0;
  }

  if (rank < p) return { rank, pivot, tolerance };

  const upper = Array.from({ length: p }, (_, row) =>
    Array.from({ length: p }, (_, column) => (column >= row ? matrix[row][column] : 0)));
  const pivotCoefficients = new Array(p).fill(0);
  for (let row = p - 1; row >= 0; row -= 1) {
    let right = transformed[row];
    for (let column = row + 1; column < p; column += 1) right -= upper[row][column] * pivotCoefficients[column];
    pivotCoefficients[row] = right / upper[row][row];
  }

  const coefficients = new Array(p);
  for (let index = 0; index < p; index += 1) coefficients[pivot[index]] = pivotCoefficients[index];

  const inverseUpper = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let target = 0; target < p; target += 1) {
    const solution = new Array(p).fill(0);
    for (let row = p - 1; row >= 0; row -= 1) {
      let right = row === target ? 1 : 0;
      for (let column = row + 1; column < p; column += 1) right -= upper[row][column] * solution[column];
      solution[row] = right / upper[row][row];
    }
    for (let row = 0; row < p; row += 1) inverseUpper[row][target] = solution[row];
  }

  const inverseCrossPivot = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let row = 0; row < p; row += 1) {
    for (let column = 0; column < p; column += 1) {
      for (let index = 0; index < p; index += 1) {
        inverseCrossPivot[row][column] += inverseUpper[row][index] * inverseUpper[column][index];
      }
    }
  }
  const inverseCross = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let row = 0; row < p; row += 1) {
    for (let column = 0; column < p; column += 1) {
      inverseCross[pivot[row]][pivot[column]] = inverseCrossPivot[row][column];
    }
  }

  return { rank, pivot, coefficients, inverseCross, upper, tolerance };
}

function invertMatrix(input) {
  const size = input.length;
  const augmented = input.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivotRow][column])) pivotRow = row;
    }
    if (Math.abs(augmented[pivotRow][column]) < EPSILON) return null;
    [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
    const divisor = augmented[column][column];
    for (let item = 0; item < size * 2; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = 0; item < size * 2; item += 1) augmented[row][item] -= factor * augmented[column][item];
    }
  }
  return augmented.map((row) => row.slice(size));
}

function calculateVifs(predictorMatrix) {
  const predictorCount = predictorMatrix[0]?.length || 0;
  if (predictorCount === 0) return [];
  if (predictorCount === 1) return [1];
  const averages = Array.from({ length: predictorCount }, (_, column) => mean(predictorMatrix.map((row) => row[column])));
  const standardDeviations = Array.from({ length: predictorCount }, (_, column) =>
    sampleStandardDeviation(predictorMatrix.map((row) => row[column])));
  const correlation = Array.from({ length: predictorCount }, () => new Array(predictorCount).fill(0));
  for (let row = 0; row < predictorCount; row += 1) {
    for (let column = 0; column < predictorCount; column += 1) {
      let covariance = 0;
      for (const observation of predictorMatrix) {
        covariance += (observation[row] - averages[row]) * (observation[column] - averages[column]);
      }
      correlation[row][column] = covariance
        / ((predictorMatrix.length - 1) * standardDeviations[row] * standardDeviations[column]);
    }
  }
  const inverse = invertMatrix(correlation);
  return inverse ? inverse.map((row, index) => Math.max(1, row[index])) : new Array(predictorCount).fill(Infinity);
}

function jacobiEigenvalues(input) {
  const matrix = input.map((row) => row.slice());
  const size = matrix.length;
  if (size === 1) return [matrix[0][0]];
  for (let iteration = 0; iteration < 100 * size * size; iteration += 1) {
    let first = 0;
    let second = 1;
    let maximum = Math.abs(matrix[first][second]);
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        if (Math.abs(matrix[row][column]) > maximum) {
          maximum = Math.abs(matrix[row][column]);
          first = row;
          second = column;
        }
      }
    }
    if (maximum < 1e-14) break;
    const angle = 0.5 * Math.atan2(2 * matrix[first][second], matrix[second][second] - matrix[first][first]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const aa = matrix[first][first];
    const bb = matrix[second][second];
    const ab = matrix[first][second];
    matrix[first][first] = cosine ** 2 * aa - 2 * sine * cosine * ab + sine ** 2 * bb;
    matrix[second][second] = sine ** 2 * aa + 2 * sine * cosine * ab + cosine ** 2 * bb;
    matrix[first][second] = 0;
    matrix[second][first] = 0;
    for (let index = 0; index < size; index += 1) {
      if (index === first || index === second) continue;
      const firstValue = matrix[index][first];
      const secondValue = matrix[index][second];
      matrix[index][first] = cosine * firstValue - sine * secondValue;
      matrix[first][index] = matrix[index][first];
      matrix[index][second] = sine * firstValue + cosine * secondValue;
      matrix[second][index] = matrix[index][second];
    }
  }
  return matrix.map((row, index) => row[index]).sort((a, b) => b - a);
}

function calculateConditionNumber(designMatrix) {
  const columnCount = designMatrix[0].length;
  const norms = Array.from({ length: columnCount }, (_, column) =>
    Math.sqrt(sum(designMatrix.map((row) => row[column] ** 2))));
  const cross = Array.from({ length: columnCount }, () => new Array(columnCount).fill(0));
  for (let row = 0; row < columnCount; row += 1) {
    for (let column = 0; column < columnCount; column += 1) {
      for (const observation of designMatrix) {
        cross[row][column] += (observation[row] / norms[row]) * (observation[column] / norms[column]);
      }
    }
  }
  const eigenvalues = jacobiEigenvalues(cross);
  const maximum = Math.max(...eigenvalues);
  const minimum = Math.min(...eigenvalues);
  if (minimum <= Math.max(1e-14, maximum * 1e-14)) return Infinity;
  return Math.sqrt(maximum / minimum);
}

function auxiliaryR2(target, predictors) {
  const matrix = predictors.map((row) => [1, ...row]);
  const solved = qrDecomposeAndSolve(matrix, target);
  if (solved.rank < matrix[0].length) return NaN;
  const fitted = matrix.map((row) => sum(row.map((value, index) => value * solved.coefficients[index])));
  const average = mean(target);
  const total = sum(target.map((value) => (value - average) ** 2));
  const error = sum(target.map((value, index) => (value - fitted[index]) ** 2));
  return total > 0 ? Math.max(0, Math.min(1, 1 - error / total)) : 0;
}

function calculateResidualSummary(residuals) {
  const sorted = residuals.slice().sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: quantileSorted(sorted, 0.25),
    median: quantileSorted(sorted, 0.5),
    q3: quantileSorted(sorted, 0.75),
    max: sorted.at(-1),
  };
}

function calculateJarqueBera(residuals) {
  const n = residuals.length;
  const average = mean(residuals);
  const centered = residuals.map((value) => value - average);
  const second = mean(centered.map((value) => value ** 2));
  if (second <= EPSILON) return { statistic: 0, pValue: 1, skewness: 0, excessKurtosis: 0 };
  const skewness = mean(centered.map((value) => value ** 3)) / second ** 1.5;
  const excessKurtosis = mean(centered.map((value) => value ** 4)) / second ** 2 - 3;
  const statistic = (n / 6) * (skewness ** 2 + excessKurtosis ** 2 / 4);
  return { statistic, pValue: chiSquareSurvival(statistic, 2), skewness, excessKurtosis };
}

export function fitOLS({ y, X, xNames, yName = "Y", includeIntercept = true, confidence = 0.95, rowIds = [] }) {
  if (!Array.isArray(y) || !Array.isArray(X) || y.length !== X.length || y.length === 0) {
    throw new Error("模型输入维度不一致或没有有效样本。 ");
  }
  const predictorCount = X[0]?.length || 0;
  if (predictorCount < 1 || X.some((row) => row.length !== predictorCount)) {
    throw new Error("至少需要一个自变量，且每行自变量数量必须一致。 ");
  }
  if (xNames.length !== predictorCount) throw new Error("自变量名称与数据列数量不一致。 ");
  if (![y, ...X].flat().every(Number.isFinite)) throw new Error("模型数据包含非有限数值。 ");

  const n = y.length;
  const designMatrix = X.map((row) => (includeIntercept ? [1, ...row] : row.slice()));
  const parameterCount = designMatrix[0].length;
  if (n <= parameterCount) throw new Error(`有效样本数必须大于待估参数数目（当前 n=${n}，p=${parameterCount}）。`);
  if (sampleStandardDeviation(y) <= EPSILON) throw new Error("应变量没有变异，无法进行回归。 ");
  for (let column = 0; column < predictorCount; column += 1) {
    if (sampleStandardDeviation(X.map((row) => row[column])) <= EPSILON) {
      throw new Error(`自变量“${xNames[column]}”是常数列，无法估计其系数。`);
    }
  }

  const solved = qrDecomposeAndSolve(designMatrix, y);
  if (solved.rank < parameterCount) {
    throw new Error(`设计矩阵秩不足（rank=${solved.rank}，p=${parameterCount}）。请移除重复或完全共线的自变量。`);
  }

  const coefficientsVector = solved.coefficients;
  const fitted = designMatrix.map((row) => sum(row.map((value, index) => value * coefficientsVector[index])));
  const residuals = y.map((value, index) => value - fitted[index]);
  const sse = Math.max(0, sum(residuals.map((value) => value ** 2)));
  const yMean = mean(y);
  const sst = includeIntercept
    ? sum(y.map((value) => (value - yMean) ** 2))
    : sum(y.map((value) => value ** 2));
  const ssr = Math.max(0, sst - sse);
  const residualDf = n - parameterCount;
  const modelDf = includeIntercept ? parameterCount - 1 : parameterCount;
  const totalDf = includeIntercept ? n - 1 : n;
  const mse = sse / residualDf;
  const msr = modelDf > 0 ? ssr / modelDf : NaN;
  const fStatistic = mse > 0 ? msr / mse : Infinity;
  const fPValue = fSurvival(fStatistic, modelDf, residualDf);
  const rSquared = sst > 0 ? 1 - sse / sst : NaN;
  const adjustedRSquared = includeIntercept
    ? 1 - (1 - rSquared) * ((n - 1) / residualDf)
    : 1 - (1 - rSquared) * (n / residualDf);
  const residualStandardError = Math.sqrt(mse);
  const rmse = Math.sqrt(sse / n);
  const mae = mean(residuals.map(Math.abs));
  const logLikelihood = sse > 0
    ? -0.5 * n * (Math.log(2 * Math.PI) + 1 + Math.log(sse / n))
    : Infinity;
  const aic = Number.isFinite(logLikelihood) ? -2 * logLikelihood + 2 * parameterCount : -Infinity;
  const bic = Number.isFinite(logLikelihood) ? -2 * logLikelihood + Math.log(n) * parameterCount : -Infinity;
  const criticalT = studentTQuantile(1 - (1 - confidence) / 2, residualDf);
  const predictorVifs = calculateVifs(X);
  const yStd = sampleStandardDeviation(y);
  const coefficientNames = includeIntercept ? ["截距", ...xNames] : xNames.slice();

  const coefficientRows = coefficientNames.map((name, index) => {
    const variance = Math.max(0, mse * solved.inverseCross[index][index]);
    const standardError = Math.sqrt(variance);
    const estimate = coefficientsVector[index];
    const tStatistic = standardError > 0 ? estimate / standardError : (estimate === 0 ? 0 : Math.sign(estimate) * Infinity);
    const pValue = Number.isFinite(tStatistic)
      ? Math.max(0, Math.min(1, 2 * (1 - studentTCdf(Math.abs(tStatistic), residualDf))))
      : 0;
    const predictorIndex = includeIntercept ? index - 1 : index;
    const vif = predictorIndex >= 0 ? predictorVifs[predictorIndex] : null;
    const standardBeta = predictorIndex >= 0
      ? estimate * sampleStandardDeviation(X.map((row) => row[predictorIndex])) / yStd
      : null;
    return {
      name,
      estimate,
      standardError,
      standardBeta,
      tStatistic,
      pValue,
      confidenceLower: estimate - criticalT * standardError,
      confidenceUpper: estimate + criticalT * standardError,
      vif,
      tolerance: vif == null ? null : (Number.isFinite(vif) ? 1 / vif : 0),
    };
  });

  const leverage = designMatrix.map((row) => {
    let value = 0;
    for (let first = 0; first < parameterCount; first += 1) {
      for (let second = 0; second < parameterCount; second += 1) {
        value += row[first] * solved.inverseCross[first][second] * row[second];
      }
    }
    return Math.max(0, Math.min(1, value));
  });
  const studentized = residuals.map((residual, index) => {
    const denominator = Math.sqrt(mse * Math.max(EPSILON, 1 - leverage[index]));
    return denominator > 0 ? residual / denominator : 0;
  });
  const cooksDistance = residuals.map((residual, index) => {
    if (!(mse > 0)) return 0;
    const oneMinus = Math.max(EPSILON, 1 - leverage[index]);
    return (residual ** 2 / (parameterCount * mse)) * (leverage[index] / oneMinus ** 2);
  });
  const leverageThreshold = (2 * parameterCount) / n;
  const cooksThreshold = 4 / n;
  const diagnosticRows = y.map((actual, index) => {
    const flags = [];
    if (Math.abs(studentized[index]) > 2) flags.push("大残差");
    if (leverage[index] > leverageThreshold) flags.push("高杠杆");
    if (cooksDistance[index] > cooksThreshold) flags.push("高影响");
    return {
      rowId: rowIds[index] ?? index + 1,
      actual,
      fitted: fitted[index],
      residual: residuals[index],
      studentized: studentized[index],
      leverage: leverage[index],
      cooksDistance: cooksDistance[index],
      flags,
    };
  });

  let durbinNumerator = 0;
  for (let index = 1; index < residuals.length; index += 1) {
    durbinNumerator += (residuals[index] - residuals[index - 1]) ** 2;
  }
  const durbinWatson = sse > 0 ? durbinNumerator / sse : NaN;
  const jarqueBera = calculateJarqueBera(residuals);
  const squaredResiduals = residuals.map((value) => value ** 2);
  const bpR2 = auxiliaryR2(squaredResiduals, X);
  const bpStatistic = Number.isFinite(bpR2) ? n * bpR2 : NaN;
  const breuschPagan = {
    statistic: bpStatistic,
    pValue: Number.isFinite(bpStatistic) ? chiSquareSurvival(bpStatistic, predictorCount) : NaN,
    degreesOfFreedom: predictorCount,
  };
  const conditionNumber = calculateConditionNumber(designMatrix);
  const maxVif = predictorVifs.length ? Math.max(...predictorVifs) : NaN;
  const counts = {
    largeResidual: diagnosticRows.filter((row) => row.flags.includes("大残差")).length,
    highLeverage: diagnosticRows.filter((row) => row.flags.includes("高杠杆")).length,
    highInfluence: diagnosticRows.filter((row) => row.flags.includes("高影响")).length,
  };

  const warnings = [];
  if (n / parameterCount < 10) warnings.push("有效样本相对参数数量偏少，系数和诊断结果可能不稳定。 ");
  if (maxVif > 10) warnings.push("存在严重多重共线性风险（最大 VIF > 10）。 ");
  else if (maxVif > 5) warnings.push("存在值得关注的多重共线性（最大 VIF > 5）。 ");
  if (conditionNumber > 1_000) warnings.push("设计矩阵条件数很高，系数可能对数据微小变化敏感。 ");
  if (jarqueBera.pValue < 0.05) warnings.push("Jarque–Bera 检验提示残差可能偏离正态分布。 ");
  if (breuschPagan.pValue < 0.05) warnings.push("Breusch–Pagan 检验提示可能存在异方差，常规标准误需谨慎解释。 ");
  if (durbinWatson < 1.5 || durbinWatson > 2.5) warnings.push("Durbin–Watson 与 2 相差较大；若数据有自然顺序，请检查残差相关性。 ");
  if (counts.highInfluence > 0) warnings.push(`检测到 ${counts.highInfluence} 个 Cook's distance 较高的观测，请结合业务背景复核。`);
  if (!includeIntercept) warnings.push("当前为无截距模型，R² 使用未中心化口径，不能与普通含截距模型直接比较。 ");

  return {
    meta: {
      yName,
      xNames: xNames.slice(),
      n,
      predictorCount,
      parameterCount,
      includeIntercept,
      confidence,
      modelDf,
      residualDf,
      totalDf,
    },
    metrics: {
      multipleR: rSquared >= 0 ? Math.sqrt(rSquared) : NaN,
      rSquared,
      adjustedRSquared,
      residualStandardError,
      sse,
      ssr,
      sst,
      rmse,
      mae,
      fStatistic,
      fPValue,
      aic,
      bic,
      mse,
      msr,
      logLikelihood,
    },
    anova: [
      { source: "回归", sumSquares: ssr, degreesOfFreedom: modelDf, meanSquare: msr, fStatistic, pValue: fPValue },
      { source: "残差", sumSquares: sse, degreesOfFreedom: residualDf, meanSquare: mse, fStatistic: null, pValue: null },
      { source: "总计", sumSquares: sst, degreesOfFreedom: totalDf, meanSquare: null, fStatistic: null, pValue: null },
    ],
    coefficients: coefficientRows,
    diagnostics: {
      residualSummary: calculateResidualSummary(residuals),
      durbinWatson,
      jarqueBera,
      breuschPagan,
      conditionNumber,
      maxVif,
      counts,
      thresholds: { leverage: leverageThreshold, cooksDistance: cooksThreshold, studentizedResidual: 2 },
    },
    rows: diagnosticRows,
    warnings,
  };
}
