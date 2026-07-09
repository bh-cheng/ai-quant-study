from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class TurtleStrategyConfig:
    entry_window: int = 20
    exit_window: int = 10
    n_window: int = 20
    stop_n: float = 2.0
    price_prefix: str = "qfq"

    def validate(self) -> None:
        if self.entry_window <= 1:
            raise ValueError("entry_window must be greater than 1.")
        if self.exit_window <= 1:
            raise ValueError("exit_window must be greater than 1.")
        if self.n_window <= 1:
            raise ValueError("n_window must be greater than 1.")
        if self.stop_n <= 0:
            raise ValueError("stop_n must be positive.")


def required_price_columns(config: TurtleStrategyConfig | None = None) -> list[str]:
    config = config or TurtleStrategyConfig()
    p = config.price_prefix
    return [f"{p}_open", f"{p}_high", f"{p}_low", f"{p}_close", f"{p}_pre_close"]


def validate_stock_data(data: pd.DataFrame, config: TurtleStrategyConfig | None = None) -> None:
    config = config or TurtleStrategyConfig()
    config.validate()

    required = ["trade_date", "ts_code", *required_price_columns(config)]
    missing = [col for col in required if col not in data.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    if data["trade_date"].duplicated().any():
        dupes = data.loc[data["trade_date"].duplicated(), "trade_date"].head(5).tolist()
        raise ValueError(f"trade_date contains duplicates, examples: {dupes}")

    if data["ts_code"].nunique(dropna=False) != 1:
        raise ValueError("Single-file backtest expects exactly one ts_code.")

    if not data["trade_date"].astype(str).is_monotonic_increasing:
        raise ValueError("trade_date must be sorted ascending before strategy calculation.")

    price_cols = required_price_columns(config)
    null_counts = data[price_cols].isna().sum()
    bad_nulls = null_counts[null_counts.gt(0)]
    if not bad_nulls.empty:
        raise ValueError(f"Adjusted price columns contain nulls: {bad_nulls.to_dict()}")

    p = config.price_prefix
    high = pd.to_numeric(data[f"{p}_high"], errors="coerce")
    low = pd.to_numeric(data[f"{p}_low"], errors="coerce")
    open_ = pd.to_numeric(data[f"{p}_open"], errors="coerce")
    close = pd.to_numeric(data[f"{p}_close"], errors="coerce")
    if (high < pd.concat([open_, low, close], axis=1).max(axis=1)).any():
        raise ValueError("qfq_high is below one of qfq_open/qfq_low/qfq_close.")
    if (low > pd.concat([open_, high, close], axis=1).min(axis=1)).any():
        raise ValueError("qfq_low is above one of qfq_open/qfq_high/qfq_close.")

    if "vol" in data.columns and pd.to_numeric(data["vol"], errors="coerce").lt(0).any():
        raise ValueError("vol contains negative values.")

    min_rows = max(config.entry_window, config.exit_window, config.n_window) + 2
    if len(data) < min_rows:
        raise ValueError(f"Need at least {min_rows} rows, got {len(data)}.")


def calculate_true_range(data: pd.DataFrame, config: TurtleStrategyConfig | None = None) -> pd.Series:
    config = config or TurtleStrategyConfig()
    p = config.price_prefix
    high = pd.to_numeric(data[f"{p}_high"], errors="coerce")
    low = pd.to_numeric(data[f"{p}_low"], errors="coerce")
    prev_close = pd.to_numeric(data[f"{p}_pre_close"], errors="coerce")
    return pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)


def calculate_turtle_n(tr: pd.Series, window: int = 20) -> pd.Series:
    """Calculate the original Turtle N smoothing from true range."""
    tr = pd.to_numeric(tr, errors="coerce").reset_index(drop=True)
    values = np.full(len(tr), np.nan, dtype=float)
    if len(tr) < window:
        return pd.Series(values, index=tr.index)

    initial = tr.iloc[:window].mean()
    values[window - 1] = initial
    for idx in range(window, len(tr)):
        prev = values[idx - 1]
        values[idx] = ((window - 1) * prev + tr.iloc[idx]) / window
    return pd.Series(values, index=tr.index)


def add_turtle_indicators(
    data: pd.DataFrame,
    config: TurtleStrategyConfig | None = None,
) -> pd.DataFrame:
    """Add Turtle N, Donchian channels, and long-only signal columns."""
    config = config or TurtleStrategyConfig()
    config.validate()

    result = data.copy().reset_index(drop=True)
    validate_stock_data(result, config)

    if "date" not in result.columns:
        result["date"] = pd.to_datetime(result["trade_date"].astype(str), format="%Y%m%d")
    else:
        result["date"] = pd.to_datetime(result["date"])

    p = config.price_prefix
    high = pd.to_numeric(result[f"{p}_high"], errors="coerce")
    low = pd.to_numeric(result[f"{p}_low"], errors="coerce")
    close = pd.to_numeric(result[f"{p}_close"], errors="coerce")

    result["tr"] = calculate_true_range(result, config)
    result[f"n_{config.n_window}"] = calculate_turtle_n(result["tr"], config.n_window)
    result["n_for_signal"] = result[f"n_{config.n_window}"].shift(1)
    result[f"entry_high_{config.entry_window}"] = (
        high.rolling(config.entry_window, min_periods=config.entry_window).max().shift(1)
    )
    result[f"exit_low_{config.exit_window}"] = (
        low.rolling(config.exit_window, min_periods=config.exit_window).min().shift(1)
    )

    entry_col = f"entry_high_{config.entry_window}"
    exit_col = f"exit_low_{config.exit_window}"
    result["breakout_long"] = close.gt(result[entry_col]) & result["n_for_signal"].notna()
    result["exit_long"] = close.lt(result[exit_col])
    result["stop_long"] = False
    result["signal"] = 0
    result.loc[result["breakout_long"], "signal"] = 1
    result.loc[result["exit_long"], "signal"] = -1
    return result
