from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class DatasetContext:
    frame: pd.DataFrame
    profile: dict[str, Any]
    cleaning_report: dict[str, Any]
    insights: list[str]


def load_csv(file_object) -> pd.DataFrame:
    frame = pd.read_csv(file_object)
    frame.columns = [str(column).strip() for column in frame.columns]
    return frame.dropna(how="all")


def classify_columns(frame: pd.DataFrame) -> dict[str, list[str]]:
    numeric = frame.select_dtypes(include=[np.number]).columns.tolist()
    date_like: list[str] = []
    categorical: list[str] = []

    for column in frame.columns:
        if column in numeric:
            continue

        values = frame[column].dropna()
        parsed = pd.to_datetime(values, errors="coerce")
        date_ratio = float(parsed.notna().mean()) if len(values) else 0

        if date_ratio >= 0.7:
            date_like.append(column)
        else:
            categorical.append(column)

    return {
        "all": frame.columns.tolist(),
        "numeric": numeric,
        "categorical": categorical,
        "date": date_like,
    }


def profile_dataset(frame: pd.DataFrame) -> dict[str, Any]:
    columns = classify_columns(frame)
    missing_by_column = frame.isna().sum().astype(int).to_dict()
    unique_by_column = frame.nunique(dropna=True).astype(int).to_dict()

    numeric_summary: dict[str, dict[str, float]] = {}
    for column in columns["numeric"]:
        series = pd.to_numeric(frame[column], errors="coerce").dropna()
        if series.empty:
            continue
        numeric_summary[column] = {
            "count": int(series.count()),
            "sum": float(series.sum()),
            "mean": float(series.mean()),
            "median": float(series.median()),
            "min": float(series.min()),
            "max": float(series.max()),
            "std": float(series.std()) if len(series) > 1 else 0.0,
        }

    segment_leaders: list[dict[str, Any]] = []
    for dimension in columns["categorical"] + columns["date"]:
        for metric in columns["numeric"]:
            grouped = (
                frame.assign(**{metric: pd.to_numeric(frame[metric], errors="coerce")})
                .groupby(dimension, dropna=False)[metric]
                .sum()
                .sort_values(ascending=False)
            )
            if grouped.empty:
                continue
            segment_leaders.append(
                {
                    "dimension": dimension,
                    "metric": metric,
                    "top": str(grouped.index[0]),
                    "topValue": float(grouped.iloc[0]),
                    "bottom": str(grouped.index[-1]),
                    "bottomValue": float(grouped.iloc[-1]),
                }
            )

    return {
        "rows": int(len(frame)),
        "columns": int(len(frame.columns)),
        "columnNames": frame.columns.tolist(),
        "types": columns,
        "missingByColumn": missing_by_column,
        "uniqueByColumn": unique_by_column,
        "numericSummary": numeric_summary,
        "segmentLeaders": segment_leaders,
        "preview": frame.head(10).replace({np.nan: None}).to_dict(orient="records"),
    }


def cleaning_report(frame: pd.DataFrame) -> dict[str, Any]:
    missing_total = int(frame.isna().sum().sum())
    duplicate_rows = int(frame.duplicated().sum())
    high_missing = [
        {
            "column": column,
            "missing": int(count),
            "percent": round(float(count / max(len(frame), 1) * 100), 2),
        }
        for column, count in frame.isna().sum().items()
        if count > 0
    ]

    inconsistent_categories: list[dict[str, Any]] = []
    for column in frame.select_dtypes(exclude=[np.number]).columns:
        lowered = frame[column].dropna().astype(str).str.strip().str.lower()
        original = frame[column].dropna().astype(str).str.strip()
        for value in lowered.unique():
            variants = sorted(original[lowered == value].unique().tolist())
            if len(variants) > 1:
                inconsistent_categories.append({"column": column, "variants": variants})

    return {
        "missingTotal": missing_total,
        "duplicateRows": duplicate_rows,
        "columnsWithMissing": high_missing,
        "inconsistentCategories": inconsistent_categories[:10],
    }


def detect_outliers(frame: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    outliers: list[dict[str, Any]] = []
    for column in numeric_columns:
        series = pd.to_numeric(frame[column], errors="coerce").dropna()
        if len(series) < 4:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        count = int(((series < lower) | (series > upper)).sum())
        if count:
            outliers.append({"column": column, "count": count, "lower": float(lower), "upper": float(upper)})
    return outliers


def correlation_matrix(frame: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    if len(numeric_columns) < 2:
        return []
    corr = frame[numeric_columns].corr(numeric_only=True).round(3)
    return corr.reset_index(names="metric").replace({np.nan: None}).to_dict(orient="records")


def generate_insights(frame: pd.DataFrame, profile: dict[str, Any], report: dict[str, Any]) -> list[str]:
    insights: list[str] = []
    types = profile["types"]
    numeric = types["numeric"]
    categorical = types["categorical"]

    if numeric:
        totals = {
            column: pd.to_numeric(frame[column], errors="coerce").fillna(0).sum()
            for column in numeric
        }
        top_metric = max(totals, key=totals.get)
        insights.append(f"{top_metric} has the highest total value at {totals[top_metric]:,.2f}.")

    if numeric and categorical:
        metric = numeric[0]
        category = categorical[0]
        grouped = frame.groupby(category, dropna=False)[metric].sum().sort_values(ascending=False)
        if not grouped.empty:
            insights.append(f"{grouped.index[0]} leads {metric} by {category} with {grouped.iloc[0]:,.2f}.")
            insights.append(f"{grouped.index[-1]} is the lowest {category} segment for {metric}.")

    if report["missingTotal"]:
        insights.append(f"The dataset has {report['missingTotal']} missing values that should be reviewed.")

    if report["duplicateRows"]:
        insights.append(f"{report['duplicateRows']} duplicate rows were detected.")

    outliers = detect_outliers(frame, numeric)
    if outliers:
        first = outliers[0]
        insights.append(f"{first['column']} contains {first['count']} possible outlier values.")

    if not insights:
        insights.append("The dataset is clean enough for first-pass visualization and exploration.")

    return insights


def build_context(frame: pd.DataFrame) -> DatasetContext:
    profile = profile_dataset(frame)
    report = cleaning_report(frame)
    profile["outliers"] = detect_outliers(frame, profile["types"]["numeric"])
    profile["correlations"] = correlation_matrix(frame, profile["types"]["numeric"])
    insights = generate_insights(frame, profile, report)
    return DatasetContext(frame=frame, profile=profile, cleaning_report=report, insights=insights)
