from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd


def recommend_charts(profile: dict[str, Any]) -> list[dict[str, Any]]:
    types = profile["types"]
    numeric = types["numeric"]
    categorical = types["categorical"]
    dates = types["date"]
    recommendations: list[dict[str, Any]] = []

    if dates and numeric:
        recommendations.append(
            {
                "type": "line",
                "title": f"{numeric[0]} trend by {dates[0]}",
                "xKey": dates[0],
                "yKey": numeric[0],
                "aggregation": "sum",
                "reason": "A line chart is best for showing change over time.",
            }
        )

    if categorical and numeric:
        recommendations.append(
            {
                "type": "bar",
                "title": f"{numeric[0]} by {categorical[0]}",
                "xKey": categorical[0],
                "yKey": numeric[0],
                "aggregation": "sum",
                "reason": "A bar chart makes category comparison easy.",
            }
        )
        recommendations.append(
            {
                "type": "pie",
                "title": f"{numeric[0]} share by {categorical[0]}",
                "xKey": categorical[0],
                "yKey": numeric[0],
                "aggregation": "sum",
                "reason": "A pie chart shows contribution share across categories.",
            }
        )

    if len(numeric) >= 2:
        recommendations.append(
            {
                "type": "scatter",
                "title": f"{numeric[0]} vs {numeric[1]}",
                "xKey": numeric[0],
                "yKey": numeric[1],
                "aggregation": "none",
                "reason": "A scatter plot helps reveal correlation and clusters.",
            }
        )
        recommendations.append(
            {
                "type": "heatmap",
                "title": "Correlation heatmap",
                "xKey": numeric[0],
                "yKey": numeric[1],
                "aggregation": "correlation",
                "reason": "A heatmap summarizes relationships between numeric columns.",
            }
        )

    if numeric:
        recommendations.append(
            {
                "type": "histogram",
                "title": f"{numeric[0]} distribution",
                "xKey": numeric[0],
                "yKey": "count",
                "aggregation": "count",
                "reason": "A histogram shows distribution and skew.",
            }
        )
        recommendations.append(
            {
                "type": "box",
                "title": f"{numeric[0]} outlier check",
                "xKey": numeric[0],
                "yKey": numeric[0],
                "aggregation": "distribution",
                "reason": "A box plot highlights spread, median, and outliers.",
            }
        )

    return recommendations[:8]


def aggregate_chart_data(
    frame: pd.DataFrame,
    chart_type: str,
    x_key: Optional[str],
    y_key: Optional[str],
    aggregation: str = "sum",
) -> list[dict[str, Any]]:
    if chart_type == "scatter" and x_key and y_key:
        data = frame[[x_key, y_key]].dropna()
        return data.replace({np.nan: None}).to_dict(orient="records")

    if chart_type == "heatmap":
        numeric = frame.select_dtypes(include=[np.number]).columns.tolist()
        corr = frame[numeric].corr(numeric_only=True).round(3)
        output: list[dict[str, Any]] = []
        for row_name, row in corr.iterrows():
            for column_name, value in row.items():
                output.append({"x": row_name, "y": column_name, "value": None if pd.isna(value) else float(value)})
        return output

    if chart_type in {"histogram", "box"} and x_key:
        series = pd.to_numeric(frame[x_key], errors="coerce").dropna()
        if chart_type == "box":
            return [{"name": x_key, "value": float(value)} for value in series.tolist()]

        counts, bins = np.histogram(series, bins=min(10, max(3, int(np.sqrt(len(series))))))
        return [
            {"bin": f"{bins[index]:.1f} - {bins[index + 1]:.1f}", "count": int(count)}
            for index, count in enumerate(counts)
        ]

    if not x_key or not y_key or x_key not in frame.columns or y_key not in frame.columns:
        return []

    numeric_y = pd.to_numeric(frame[y_key], errors="coerce")
    working = frame.assign(**{y_key: numeric_y}).dropna(subset=[x_key])

    if aggregation == "avg":
        grouped = working.groupby(x_key, dropna=False)[y_key].mean()
    elif aggregation == "count":
        grouped = working.groupby(x_key, dropna=False)[y_key].count()
    elif aggregation == "min":
        grouped = working.groupby(x_key, dropna=False)[y_key].min()
    elif aggregation == "max":
        grouped = working.groupby(x_key, dropna=False)[y_key].max()
    else:
        grouped = working.groupby(x_key, dropna=False)[y_key].sum()

    return (
        grouped.reset_index()
        .rename(columns={x_key: "name", y_key: "value"})
        .replace({np.nan: None})
        .to_dict(orient="records")
    )
