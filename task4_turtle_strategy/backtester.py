from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from turtle_strategy import TurtleStrategyConfig, add_turtle_indicators


@dataclass(frozen=True)
class TurtleBacktestConfig:
    initial_cash: float = 100_000.0
    risk_per_unit: float = 0.01
    fee_rate: float = 0.001
    slippage_rate: float = 0.0005
    annual_periods: int = 252
    allow_fractional_shares: bool = True

    def validate(self) -> None:
        if self.initial_cash <= 0:
            raise ValueError("initial_cash must be positive.")
        if self.risk_per_unit <= 0:
            raise ValueError("risk_per_unit must be positive.")
        if self.fee_rate < 0:
            raise ValueError("fee_rate cannot be negative.")
        if self.slippage_rate < 0:
            raise ValueError("slippage_rate cannot be negative.")
        if self.annual_periods <= 0:
            raise ValueError("annual_periods must be positive.")


def _safe_float(value: object, default: float = np.nan) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out


def run_turtle_backtest(
    data: pd.DataFrame,
    strategy_config: TurtleStrategyConfig | None = None,
    backtest_config: TurtleBacktestConfig | None = None,
) -> pd.DataFrame:
    strategy_config = strategy_config or TurtleStrategyConfig()
    backtest_config = backtest_config or TurtleBacktestConfig()
    strategy_config.validate()
    backtest_config.validate()

    result = add_turtle_indicators(data, strategy_config)
    p = strategy_config.price_prefix
    n_col = f"n_{strategy_config.n_window}"
    entry_col = f"entry_high_{strategy_config.entry_window}"
    exit_col = f"exit_low_{strategy_config.exit_window}"

    cash = float(backtest_config.initial_cash)
    shares = 0.0
    entry_price = np.nan
    entry_n = np.nan
    stop_price = np.nan
    position_units = 0
    pending_order: dict[str, object] | None = None
    records: list[dict[str, object]] = []

    for idx, row in result.iterrows():
        open_price = _safe_float(row[f"{p}_open"])
        close_price = _safe_float(row[f"{p}_close"])
        current_date = row["date"]
        trade_action = "HOLD"
        trade_reason = ""
        signal_date = ""
        execution_date = ""
        execution_price = np.nan
        trade_value = 0.0
        fee = 0.0
        slippage_cost = 0.0
        target_units = position_units

        if pending_order is not None:
            order_side = str(pending_order["side"])
            order_reason = str(pending_order["reason"])
            signal_date = str(pending_order["signal_date"])
            execution_date = current_date.strftime("%Y-%m-%d")

            if order_side == "BUY" and shares <= 0 and cash > 0:
                n_for_size = _safe_float(pending_order.get("n_for_size"))
                if n_for_size > 0 and open_price > 0:
                    execution_price = open_price * (1 + backtest_config.slippage_rate)
                    unit_risk_cash = cash * backtest_config.risk_per_unit
                    unit_shares = unit_risk_cash / (strategy_config.stop_n * n_for_size)
                    max_affordable = cash / (execution_price * (1 + backtest_config.fee_rate))
                    shares_to_buy = min(unit_shares, max_affordable)
                    if not backtest_config.allow_fractional_shares:
                        shares_to_buy = np.floor(shares_to_buy)
                    if shares_to_buy > 0:
                        trade_value = shares_to_buy * execution_price
                        fee = trade_value * backtest_config.fee_rate
                        slippage_cost = shares_to_buy * open_price * backtest_config.slippage_rate
                        cash -= trade_value + fee
                        shares = shares_to_buy
                        entry_price = execution_price
                        entry_n = n_for_size
                        stop_price = entry_price - strategy_config.stop_n * entry_n
                        position_units = 1
                        target_units = 1
                        trade_action = "BUY"
                        trade_reason = order_reason

            elif order_side == "SELL" and shares > 0:
                execution_price = open_price * (1 - backtest_config.slippage_rate)
                trade_value = shares * execution_price
                fee = trade_value * backtest_config.fee_rate
                slippage_cost = shares * open_price * backtest_config.slippage_rate
                cash += trade_value - fee
                shares = 0.0
                entry_price = np.nan
                entry_n = np.nan
                stop_price = np.nan
                position_units = 0
                target_units = 0
                trade_action = "SELL"
                trade_reason = order_reason

            pending_order = None

        equity = cash + shares * close_price
        stop_trigger = bool(shares > 0 and np.isfinite(stop_price) and close_price <= stop_price)
        result.at[idx, "stop_long"] = stop_trigger

        # Generate the order that can be executed on the next trading day.
        if idx < len(result) - 1:
            if shares > 0:
                if stop_trigger:
                    pending_order = {
                        "side": "SELL",
                        "reason": "2N stop loss",
                        "signal_date": current_date.strftime("%Y-%m-%d"),
                    }
                elif bool(row["exit_long"]):
                    pending_order = {
                        "side": "SELL",
                        "reason": f"{strategy_config.exit_window}-day low exit",
                        "signal_date": current_date.strftime("%Y-%m-%d"),
                    }
            elif bool(row["breakout_long"]):
                pending_order = {
                    "side": "BUY",
                    "reason": f"{strategy_config.entry_window}-day high breakout",
                    "signal_date": current_date.strftime("%Y-%m-%d"),
                    "n_for_size": _safe_float(row["n_for_signal"]),
                }

        records.append(
            {
                "stop_price": stop_price,
                "target_units": target_units,
                "position_units": position_units,
                "shares": shares,
                "cash": cash,
                "trade_action": trade_action,
                "trade_reason": trade_reason,
                "signal_date": signal_date,
                "execution_date": execution_date,
                "execution_price": execution_price,
                "trade_value": trade_value,
                "fee": fee,
                "slippage_cost": slippage_cost,
                "portfolio_value": equity,
            }
        )

    portfolio = pd.concat([result, pd.DataFrame(records)], axis=1)
    portfolio["strategy_return"] = portfolio["portfolio_value"].pct_change().fillna(0.0)
    first_close = float(portfolio[f"{p}_close"].iloc[0])
    portfolio["benchmark_value"] = (
        backtest_config.initial_cash * portfolio[f"{p}_close"].astype(float) / first_close
    )
    portfolio["benchmark_return"] = portfolio["benchmark_value"].pct_change().fillna(0.0)
    portfolio["running_max"] = portfolio["portfolio_value"].cummax()
    portfolio["drawdown"] = portfolio["portfolio_value"] / portfolio["running_max"] - 1.0

    ordered = [
        "trade_date",
        "date",
        "ts_code",
        f"{p}_open",
        f"{p}_high",
        f"{p}_low",
        f"{p}_close",
        "tr",
        n_col,
        "n_for_signal",
        entry_col,
        exit_col,
        "breakout_long",
        "exit_long",
        "stop_long",
        "stop_price",
        "target_units",
        "position_units",
        "shares",
        "cash",
        "trade_action",
        "trade_reason",
        "signal_date",
        "execution_date",
        "execution_price",
        "trade_value",
        "fee",
        "slippage_cost",
        "portfolio_value",
        "strategy_return",
        "benchmark_value",
        "benchmark_return",
        "drawdown",
    ]
    extras = [col for col in portfolio.columns if col not in ordered]
    return portfolio[ordered + extras]


def calculate_trade_stats(portfolio: pd.DataFrame) -> dict[str, float | int]:
    buys = portfolio[portfolio["trade_action"].eq("BUY")].copy()
    sells = portfolio[portfolio["trade_action"].eq("SELL")].copy()
    count = min(len(buys), len(sells))
    if count == 0:
        return {
            "round_trip_count": 0,
            "win_rate": np.nan,
            "average_trade_return": np.nan,
            "worst_trade_return": np.nan,
        }
    returns: list[float] = []
    for idx in range(count):
        buy_value = float(buys.iloc[idx]["trade_value"] + buys.iloc[idx]["fee"])
        sell_value = float(sells.iloc[idx]["trade_value"] - sells.iloc[idx]["fee"])
        if buy_value > 0:
            returns.append(sell_value / buy_value - 1.0)
    if not returns:
        return {
            "round_trip_count": 0,
            "win_rate": np.nan,
            "average_trade_return": np.nan,
            "worst_trade_return": np.nan,
        }
    values = np.array(returns, dtype=float)
    return {
        "round_trip_count": int(len(values)),
        "win_rate": float(np.mean(values > 0)),
        "average_trade_return": float(np.mean(values)),
        "worst_trade_return": float(np.min(values)),
    }


def calculate_performance_metrics(
    portfolio: pd.DataFrame,
    backtest_config: TurtleBacktestConfig | None = None,
) -> dict[str, float | int]:
    backtest_config = backtest_config or TurtleBacktestConfig()
    backtest_config.validate()

    initial = float(backtest_config.initial_cash)
    final = float(portfolio["portfolio_value"].iloc[-1])
    cumulative = final / initial - 1.0
    days = max(1, len(portfolio))
    annualized_return = (1 + cumulative) ** (backtest_config.annual_periods / days) - 1
    daily_returns = portfolio["strategy_return"].astype(float)
    annualized_vol = float(daily_returns.std(ddof=1) * np.sqrt(backtest_config.annual_periods))
    sharpe = np.nan
    if annualized_vol > 0:
        sharpe = float((daily_returns.mean() * backtest_config.annual_periods) / annualized_vol)
    max_drawdown = float(portfolio["drawdown"].min())
    calmar = np.nan if max_drawdown == 0 else float(annualized_return / abs(max_drawdown))
    benchmark_cum = float(portfolio["benchmark_value"].iloc[-1] / portfolio["benchmark_value"].iloc[0] - 1)

    trade_stats = calculate_trade_stats(portfolio)
    metrics: dict[str, float | int] = {
        "initial_cash": initial,
        "final_value": final,
        "cumulative_return": float(cumulative),
        "annualized_return": float(annualized_return),
        "annualized_volatility": annualized_vol,
        "max_drawdown": max_drawdown,
        "sharpe_ratio": sharpe,
        "calmar_ratio": calmar,
        "benchmark_cumulative_return": benchmark_cum,
        "excess_return": float(cumulative - benchmark_cum),
        "exposure_ratio": float(portfolio["position_units"].gt(0).mean()),
        "trade_count": int(portfolio["trade_action"].isin(["BUY", "SELL"]).sum()),
    }
    metrics.update(trade_stats)
    return metrics
