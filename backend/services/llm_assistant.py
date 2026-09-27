from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import pandas as pd
from openai import OpenAI


SYSTEM_PROMPT = """
You are an AI data visualization assistant. Answer using the provided dataset
profile only. Recommend practical charts, mention the exact columns to use,
and keep the response concise. Return JSON with keys: answer, chart, insights.
"""


def _fallback_answer(
    question: str,
    profile: dict[str, Any],
    insights: list[str],
    cleaning_report: Optional[dict[str, Any]] = None,
    frame: Optional[pd.DataFrame] = None,
) -> dict[str, Any]:
    q = question.lower().strip()
    types = profile.get("types", {})
    numeric = types.get("numeric", [])
    categorical = types.get("categorical", [])
    dates = types.get("date", [])
    dimensions = categorical + dates
    num_summary = profile.get("numericSummary", {})
    segment_leaders = profile.get("segmentLeaders", [])
    total_rows = profile.get("rows", len(frame) if frame is not None else 0)
    total_cols = profile.get("columns", len(profile.get("columnNames", [])))

    analytical_numeric = [c for c in numeric if not any(k in c.lower() for k in ["id", "index", "key", "code", "phone", "zip", "serial", "number", "num"])]
    effective_numeric = analytical_numeric if analytical_numeric else numeric

    # Identify metric mentioned in question or default
    selected_metric = None
    for col in numeric:
        if col.lower() in q:
            selected_metric = col
            break
    if not selected_metric:
        for col in effective_numeric:
            cl = col.lower()
            if "sale" in q and "sale" in cl:
                selected_metric = col
                break
            if "profit" in q and "profit" in cl:
                selected_metric = col
                break
            if ("quantity" in q or "qty" in q or "units" in q or "volume" in q) and ("quant" in cl or "qty" in cl):
                selected_metric = col
                break
    if not selected_metric and effective_numeric:
        # Prioritize profit or revenue as the primary business metric
        selected_metric = next((c for c in effective_numeric if "profit" in c.lower()), None)
        if not selected_metric:
            selected_metric = next((c for c in effective_numeric if "rev" in c.lower() or "sale" in c.lower()), None)
        if not selected_metric:
            selected_metric = effective_numeric[0]

    # Identify dimension mentioned in question or default
    selected_dimension = None
    for col in dimensions:
        if col.lower() in q:
            selected_dimension = col
            break
    if not selected_dimension:
        for col in dimensions:
            cl = col.lower()
            if "cat" in q and "cat" in cl:
                selected_dimension = col
                break
            if ("date" in q or "time" in q or "day" in q or "month" in q or "year" in q) and (col in dates):
                selected_dimension = col
                break
    if not selected_dimension and dimensions:
        selected_dimension = dimensions[0]

    answer = ""
    chart = None
    source = "Analytical Intent Engine (Rule-based)"

    # Helper: compute segment leader dynamically if not in profile
    def get_segment_leader(dim: str, met: str):
        for leader in segment_leaders:
            if leader.get("dimension") == dim and leader.get("metric") == met:
                return leader
        if frame is not None and dim in frame.columns and met in frame.columns:
            try:
                grouped = (
                    pd.to_numeric(frame[met], errors="coerce")
                    .groupby(frame[dim], dropna=False)
                    .sum()
                    .sort_values(ascending=False)
                )
                if not grouped.empty:
                    return {
                        "dimension": dim,
                        "metric": met,
                        "top": str(grouped.index[0]),
                        "topValue": float(grouped.iloc[0]),
                        "bottom": str(grouped.index[-1]),
                        "bottomValue": float(grouped.iloc[-1]),
                    }
            except Exception:
                pass
        return None

    # Helper: get column total
    def get_col_sum(met: str) -> float:
        if met in num_summary and "sum" in num_summary[met]:
            return num_summary[met]["sum"]
        if frame is not None and met in frame.columns:
            return float(pd.to_numeric(frame[met], errors="coerce").fillna(0).sum())
        return 0.0

    # Helper: get column mean
    def get_col_mean(met: str) -> float:
        if met in num_summary and "mean" in num_summary[met]:
            return num_summary[met]["mean"]
        if frame is not None and met in frame.columns:
            return float(pd.to_numeric(frame[met], errors="coerce").dropna().mean())
        return 0.0

    # Format currency or standard number
    def fmt_num(val: float, is_currency: bool = False) -> str:
        if is_currency:
            return f"${val:,.2f}"
        return f"{val:,.2f}" if abs(val % 1) > 0.001 else f"{int(val):,}"

    is_currency_metric = selected_metric and ("sale" in selected_metric.lower() or "profit" in selected_metric.lower() or "price" in selected_metric.lower() or "revenue" in selected_metric.lower())

    # Check for matched category value (e.g. "Europe", "Online", "Clothes")
    matched_col = None
    matched_val = None
    if frame is not None:
        for c in categorical:
            if c in frame.columns:
                try:
                    for v in frame[c].dropna().unique():
                        sv = str(v).strip()
                        if len(sv) >= 2 and re.search(r'\b' + re.escape(sv.lower()) + r'\b', q):
                            matched_col = c
                            matched_val = sv
                            break
                except Exception:
                    pass
            if matched_val:
                break

    # Check domain
    all_cols_l = [c.lower() for c in profile.get("columnNames", [])]
    all_cols_str = " ".join(all_cols_l)
    is_sales_domain = any(k in all_cols_str for k in ["sale", "revenue", "profit", "order", "cost", "unit", "item", "channel"])
    is_health_domain = any(k in all_cols_str for k in ["patient", "doctor", "health", "disease", "blood", "medical", "hospital"])
    is_academic_domain = any(k in all_cols_str for k in ["student", "grade", "score", "exam", "course", "school"])
    is_hr_domain = any(k in all_cols_str for k in ["employee", "salary", "department", "attrition", "hire"])

    rev_col = next((c for c in numeric if "rev" in c.lower() or "sale" in c.lower()), None)
    profit_col = next((c for c in numeric if "profit" in c.lower()), None)
    cost_col = next((c for c in numeric if "cost" in c.lower()), None)
    units_col = next((c for c in numeric if "unit" in c.lower() or "quant" in c.lower() or "qty" in c.lower()), None)
    item_col = next((c for c in categorical if "item" in c.lower() or "prod" in c.lower() or "cat" in c.lower()), None)
    region_col = next((c for c in categorical if "region" in c.lower() or "geography" in c.lower() or "territory" in c.lower()), None)
    country_col = next((c for c in categorical if "country" in c.lower() or "nation" in c.lower()), None)
    channel_col = next((c for c in categorical if "channel" in c.lower()), None)

    # 0. DATASET INFO / OVERVIEW / SUMMARY / WHAT IS THIS CSV ABOUT
    if any(k in q for k in [
        "info", "information", "about this", "about the", "tell me about this",
        "describe", "what is this", "explain this", "dataset details",
        "file details", "data details", "give info", "csv info",
        "what does this", "what kind of data", "what data is", "what does the csv",
        "what is in this", "what is this file", "purpose", "understand this"
    ]):
        if is_sales_domain:
            rev_tot = get_col_sum(rev_col) if rev_col else 0
            profit_tot = get_col_sum(profit_col) if profit_col else 0
            cost_tot = get_col_sum(cost_col) if cost_col else 0
            units_tot = get_col_sum(units_col) if units_col else 0
            margin = (profit_tot / rev_tot * 100) if rev_tot > 0 else 0
            avg_order = (rev_tot / total_rows) if total_rows > 0 else 0

            reg_count = frame[region_col].nunique() if frame is not None and region_col and region_col in frame.columns else len(categorical)
            ctry_count = frame[country_col].nunique() if frame is not None and country_col and country_col in frame.columns else 0

            top_item_info = ""
            if item_col and profit_col:
                ldr = get_segment_leader(item_col, profit_col)
                if ldr:
                    top_item_info = f"\n• Top Product Category: '{ldr['top']}' generated the highest profit ({fmt_num(ldr['topValue'], True)})."

            top_reg_info = ""
            if region_col and rev_col:
                r_ldr = get_segment_leader(region_col, rev_col)
                if r_ldr:
                    top_reg_info = f"\n• Leading Region: '{r_ldr['top']}' with {fmt_num(r_ldr['topValue'], True)} in gross revenue."

            channel_info = ""
            if channel_col and frame is not None and channel_col in frame.columns:
                ch_counts = frame[channel_col].value_counts()
                ch_parts = [f"{k} ({v:,} orders, {v/total_rows*100:.1f}%)" for k, v in ch_counts.items()]
                channel_info = f"\n• Sales Channels: {', '.join(ch_parts)}."

            missing_total = cleaning_report.get("missingTotal", 0) if cleaning_report else sum(profile.get("missingByColumn", {}).values())
            quality_str = "100% complete (0 missing values across all records)" if missing_total == 0 else f"{missing_total} missing value(s) identified"

            date_span = ""
            if dates and frame is not None and dates[0] in frame.columns:
                try:
                    dt_series = pd.to_datetime(frame[dates[0]], errors="coerce").dropna()
                    if not dt_series.empty:
                        date_span = f" from {dt_series.min().strftime('%b %Y')} to {dt_series.max().strftime('%b %Y')}"
                except Exception:
                    pass

            answer = (
                f"This dataset represents **Commercial Sales Transactions and Global Order Fulfillment**{date_span}.\n\n"
                f"**Business Scope & Scope of Operations:**\n"
                f"• Tracks **{total_rows:,} customer purchase orders** across {reg_count} global regions" + (f" and {ctry_count} countries" if ctry_count else "") + ".\n"
                f"• Records consumer product categories, fulfillment channels (Online vs. Offline), order priority levels, and shipping timelines.\n\n"
                f"**Key Financial & Operational Metrics:**\n"
                f"• **Total Revenue**: {fmt_num(rev_tot, True)}\n"
                f"• **Total Cost**: {fmt_num(cost_tot, True)}\n"
                f"• **Total Profit**: {fmt_num(profit_tot, True)} (Overall Gross Margin: **{margin:.1f}%**)\n"
                f"• **Units Sold**: {fmt_num(units_tot, False)} units (Average Order Value: {fmt_num(avg_order, True)})\n"
                f"{top_item_info}"
                f"{top_reg_info}"
                f"{channel_info}\n\n"
                f"**Data Integrity**: {quality_str}.\n\n"
                f"**Ask me any question about this data**, for example:\n"
                f"1. \"Which country has the highest profit?\"\n"
                f"2. \"Compare online vs offline sales\"\n"
                f"3. \"What is the correlation between units sold and revenue?\"\n"
                f"4. \"What are the top 5 item types by profit?\"\n"
                f"5. \"How can we increase profitability?\""
            )
            if item_col and profit_col:
                chart = {"type": "bar", "xKey": item_col, "yKey": profit_col, "aggregation": "sum", "reason": f"Overview of {profit_col} by {item_col}."}
            elif region_col and rev_col:
                chart = {"type": "bar", "xKey": region_col, "yKey": rev_col, "aggregation": "sum", "reason": f"Overview of {rev_col} by {region_col}."}
            elif dates and rev_col:
                chart = {"type": "line", "xKey": dates[0], "yKey": rev_col, "aggregation": "sum", "reason": f"{rev_col} timeline progression."}
        else:
            col_list = ", ".join(profile.get("columnNames", []))
            num_str = ", ".join(numeric) if numeric else "None"
            cat_str = ", ".join(categorical) if categorical else "None"
            date_str = ", ".join(dates) if dates else "None"

            lead_info = ""
            leader = get_segment_leader(selected_dimension, selected_metric) if selected_dimension and selected_metric else None
            if leader:
                val_str = fmt_num(leader["topValue"], is_currency_metric)
                lead_info = f"\n• Top Segment: '{leader['top']}' leads {selected_dimension} with {val_str}."

            tot_info = ""
            if selected_metric:
                tot = get_col_sum(selected_metric)
                tot_info = f"\n• Total {selected_metric}: {fmt_num(tot, is_currency_metric)}."

            missing_total = cleaning_report.get("missingTotal", 0) if cleaning_report else sum(profile.get("missingByColumn", {}).values())
            quality_str = "100% complete (0 missing values)" if missing_total == 0 else f"{missing_total} missing value(s)"

            domain_desc = "Clinical & Healthcare records" if is_health_domain else "Educational & Student performance" if is_academic_domain else "Human Resources & Workforce data" if is_hr_domain else "Structured Multi-Dimensional Analytics"

            answer = (
                f"This dataset contains **{domain_desc}** with **{total_rows:,} records** across {total_cols} columns.\n\n"
                f"• Dimensions & Categories: {cat_str}\n"
                f"• Quantitative Metrics: {num_str}\n"
                f"• Timeline: {date_str}\n"
                f"• Data Quality: {quality_str}{tot_info}{lead_info}\n\n"
                f"Ask me any question to explore trends, rankings, comparisons, or correlations!"
            )

            if dates and selected_metric:
                chart = {"type": "line", "xKey": dates[0], "yKey": selected_metric, "aggregation": "sum", "reason": f"Timeline showing {selected_metric} progression."}
            elif selected_dimension and selected_metric:
                chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": f"Overview comparison of {selected_metric} by {selected_dimension}."}
            elif selected_metric:
                chart = {"type": "histogram", "xKey": selected_metric, "yKey": "count", "aggregation": "count", "reason": f"Distribution of {selected_metric}."}

    # 0.1 PROFIT MARGIN / MARGIN ANALYSIS
    elif any(k in q for k in ["profit margin", "margin", "profitability", "markup"]):
        if profit_col and rev_col and frame is not None and profit_col in frame.columns and rev_col in frame.columns:
            tot_p = get_col_sum(profit_col)
            tot_r = get_col_sum(rev_col)
            tot_c = get_col_sum(cost_col) if cost_col else (tot_r - tot_p)
            overall_margin = (tot_p / tot_r * 100) if tot_r > 0 else 0

            dim_target = item_col or selected_dimension or (categorical[0] if categorical else None)
            breakdown_lines = []
            if dim_target and dim_target in frame.columns:
                p_s = pd.to_numeric(frame[profit_col], errors="coerce")
                r_s = pd.to_numeric(frame[rev_col], errors="coerce")
                grp = pd.DataFrame({"_p": p_s, "_r": r_s}).groupby(frame[dim_target]).sum()
                grp["margin"] = (grp["_p"] / grp["_r"] * 100).fillna(0)
                grp = grp.sort_values(by="margin", ascending=False)
                for idx, r in grp.head(5).iterrows():
                    breakdown_lines.append(f"• {idx}: {r['margin']:.1f}% margin ({fmt_num(r['_p'], True)} profit on {fmt_num(r['_r'], True)} revenue)")
                top_m_name = grp.index[0]
                top_m_val = grp.iloc[0]["margin"]
                bot_m_name = grp.index[-1]
                bot_m_val = grp.iloc[-1]["margin"]
            
            answer = (
                f"**Profit Margin & Profitability Analysis:**\n\n"
                f"• **Overall Gross Profit Margin**: **{overall_margin:.1f}%**\n"
                f"  - Total Revenue: {fmt_num(tot_r, True)}\n"
                f"  - Total Cost: {fmt_num(tot_c, True)}\n"
                f"  - Total Profit: {fmt_num(tot_p, True)}\n\n"
                + (f"**Profit Margin by {dim_target}:**\n" + "\n".join(breakdown_lines) + f"\n\n• Highest Margin: '{top_m_name}' at {top_m_val:.1f}%\n• Lowest Margin: '{bot_m_name}' at {bot_m_val:.1f}%\n" if breakdown_lines else "")
            )
            chart = {"type": "bar", "xKey": dim_target, "yKey": profit_col, "aggregation": "sum", "reason": f"Shows profit volume by {dim_target} supporting margin analysis."}
        else:
            answer = f"Profit margin requires both Revenue and Profit metrics. Available metrics: {', '.join(numeric)}."

    # 1. SPECIFIC CATEGORY VALUE FILTER (e.g. "total profit in Europe", "how much revenue from Clothes", "Online orders")
    elif matched_val and matched_col and not any(k in q for k in ["compare", "vs", "versus"]):
        sub = frame[frame[matched_col].astype(str).str.lower() == matched_val.lower()]
        sub_count = len(sub)
        sub_met_sum = float(pd.to_numeric(sub[selected_metric], errors="coerce").fillna(0).sum()) if selected_metric in sub.columns else 0.0
        sub_met_mean = float(pd.to_numeric(sub[selected_metric], errors="coerce").dropna().mean()) if selected_metric in sub.columns else 0.0
        tot_all = get_col_sum(selected_metric)
        pct = (sub_met_sum / tot_all * 100) if tot_all > 0 else 0
        
        other_dim = next((c for c in categorical if c != matched_col), None)
        answer = (
            f"Analysis for '{matched_val}' ({matched_col}):\n\n"
            f"• Total Orders: {sub_count:,} ({sub_count / total_rows * 100:.1f}% of overall dataset)\n"
            f"• Total {selected_metric}: {fmt_num(sub_met_sum, is_currency_metric)} ({pct:.1f}% of total)\n"
            f"• Average {selected_metric}: {fmt_num(sub_met_mean, is_currency_metric)} per order\n"
        )
        if other_dim and other_dim in sub.columns and selected_metric in sub.columns:
            top_sub = (
                pd.to_numeric(sub[selected_metric], errors="coerce")
                .groupby(sub[other_dim])
                .sum()
                .sort_values(ascending=False)
            )
            if not top_sub.empty:
                answer += f"• Top {other_dim} within {matched_val}: '{top_sub.index[0]}' with {fmt_num(float(top_sub.iloc[0]), is_currency_metric)}.\n"
        if not chart:
            chart = {"type": "bar", "xKey": matched_col, "yKey": selected_metric, "aggregation": "sum", "reason": f"Volume breakdown for {matched_val}."}

    # 2. COMPARISONS (e.g. "compare online vs offline", "item type difference")
    elif any(k in q for k in ["compare", "vs", "versus", "difference", "differ", "contrast"]):
        target_dim = matched_col or selected_dimension
        for c in categorical:
            if c.lower() in q:
                target_dim = c
                break
        if frame is not None and target_dim and target_dim in frame.columns and selected_metric and selected_metric in frame.columns:
            s_met = pd.to_numeric(frame[selected_metric], errors="coerce")
            grouped = (
                s_met.groupby(frame[target_dim])
                .agg(["sum", "mean", "count"])
                .sort_values(by="sum", ascending=False)
            )
            tot = grouped["sum"].sum()
            lines = []
            for idx, r in grouped.head(6).iterrows():
                val_s = fmt_num(float(r["sum"]), is_currency_metric)
                pct_s = f"{r['sum'] / tot * 100:.1f}%" if tot else "0%"
                lines.append(f"• {idx}: {val_s} ({pct_s} share, {int(r['count']):,} records)")
            
            top_name = grouped.index[0]
            bot_name = grouped.index[-1]
            diff = grouped.iloc[0]["sum"] - grouped.iloc[-1]["sum"]
            answer = (
                f"Comparative breakdown of {selected_metric} by {target_dim}:\n\n"
                + "\n".join(lines) + "\n\n"
                + f"Key Finding: '{top_name}' leads '{bot_name}' by {fmt_num(float(diff), is_currency_metric)}."
            )
            chart = {"type": "bar", "xKey": target_dim, "yKey": selected_metric, "aggregation": "sum", "reason": f"Comparative breakdown of {selected_metric} across {target_dim}."}

    # 3. CORRELATIONS & RELATIONSHIPS (e.g. "correlation between units sold and profit")
    elif any(k in q for k in ["correlation", "relationship", "relation", "relate", "depend", "affect", "impact"]):
        found_nums = [c for c in numeric if c.lower() in q]
        if len(found_nums) >= 2:
            num1, num2 = found_nums[0], found_nums[1]
        elif len(numeric) >= 2:
            num1 = selected_metric
            num2 = next((c for c in numeric if c != selected_metric), numeric[1])
        else:
            num1, num2 = None, None
            
        if num1 and num2 and frame is not None:
            s1 = pd.to_numeric(frame[num1], errors="coerce")
            s2 = pd.to_numeric(frame[num2], errors="coerce")
            valid = s1.notna() & s2.notna()
            if valid.sum() > 2:
                r_val = float(s1[valid].corr(s2[valid]))
                strength = "Strong" if abs(r_val) >= 0.7 else "Moderate" if abs(r_val) >= 0.4 else "Weak"
                direction = "Positive" if r_val > 0 else "Negative"
                answer = (
                    f"Statistical Correlation between {num1} and {num2}:\n\n"
                    f"• Pearson Correlation Coefficient (r): {r_val:.3f} ({strength} {direction} Correlation)\n"
                    f"• Analysis: "
                )
                if r_val > 0.4:
                    answer += f"As {num1} increases, {num2} tends to increase as well."
                elif r_val < -0.4:
                    answer += f"As {num1} increases, {num2} tends to decrease."
                else:
                    answer += f"There is weak linear dependency between {num1} and {num2}."
                chart = {"type": "scatter", "xKey": num1, "yKey": num2, "aggregation": "none", "reason": f"Scatter plot showing relationship between {num1} and {num2}."}

    # 4. TOP N / RANKING (e.g. "top 5 countries", "top 3 item types")
    elif any(k in q for k in ["top", "rank", "ranking", "leaderboard", "best"]):
        n_match = re.search(r'\b([2-9]|10)\b', q)
        n_count = int(n_match.group(1)) if n_match else 5
        target_dim = matched_col or selected_dimension
        for c in categorical:
            if c.lower() in q:
                target_dim = c
                break
        if frame is not None and target_dim and selected_metric and target_dim in frame.columns and selected_metric in frame.columns:
            grouped = (
                pd.to_numeric(frame[selected_metric], errors="coerce")
                .groupby(frame[target_dim])
                .sum()
                .sort_values(ascending=False)
                .head(n_count)
            )
            tot = get_col_sum(selected_metric)
            lines = [f"{i+1}. {idx}: {fmt_num(float(v), is_currency_metric)} ({v/tot*100:.1f}%)" for i, (idx, v) in enumerate(grouped.items())]
            answer = f"Top {len(grouped)} {target_dim} by {selected_metric}:\n\n" + "\n".join(lines)
            chart = {"type": "bar", "xKey": target_dim, "yKey": selected_metric, "aggregation": "sum", "reason": f"Top {target_dim} ranked by {selected_metric}."}

    # 5. STRATEGY & RECOMMENDATIONS (e.g. "how can I increase profit?", "give suggestions")
    elif any(k in q for k in ["recommend", "suggestion", "advice", "how to", "improve", "increase", "grow", "strategy"]):
        profit_col = next((c for c in numeric if "profit" in c.lower()), None)
        rev_col = next((c for c in numeric if "rev" in c.lower() or "sale" in c.lower()), None)
        cat_col = next((c for c in categorical if "item" in c.lower() or "cat" in c.lower() or "product" in c.lower()), categorical[0] if categorical else None)
        region_col = next((c for c in categorical if "region" in c.lower() or "country" in c.lower()), None)
        
        answer = "Strategic Business Recommendations for your dataset:\n\n"
        if frame is not None and profit_col and cat_col and profit_col in frame.columns and cat_col in frame.columns:
            grp = pd.to_numeric(frame[profit_col], errors="coerce").groupby(frame[cat_col]).sum().sort_values(ascending=False)
            if not grp.empty:
                answer += f"1. Prioritize Top Categories: Focus resources on '{grp.index[0]}', which delivers the highest {profit_col} ({fmt_num(float(grp.iloc[0]), True)}).\n"
                answer += f"2. Review Lagging Segments: Evaluate '{grp.index[-1]}' ({fmt_num(float(grp.iloc[-1]), True)}) to optimize unit margins.\n"
        if frame is not None and region_col and (rev_col or profit_col):
            m = rev_col or profit_col
            if m and m in frame.columns and region_col in frame.columns:
                r_grp = pd.to_numeric(frame[m], errors="coerce").groupby(frame[region_col]).sum().sort_values(ascending=False)
                if not r_grp.empty:
                    answer += f"3. Expand Key Territories: Accelerate expansion in '{r_grp.index[0]}' while auditing marketing in lower-volume zones.\n"
        answer += "4. Protect Margins: Monitor high-value transactions and minimize operational bottlenecks."
        chart = {"type": "bar", "xKey": cat_col or selected_dimension, "yKey": profit_col or selected_metric, "aggregation": "sum", "reason": "Highlights high-impact segments for strategic growth."}

    # 6. OUTLIERS / ANOMALIES
    elif any(k in q for k in ["outlier", "anomaly", "anomalies", "extreme value", "irregular"]):
        outliers = profile.get("outliers", [])
        if not outliers and frame is not None:
            from services.data_profiler import detect_outliers
            outliers = detect_outliers(frame, numeric)

        if outliers:
            details = []
            for item in outliers:
                details.append(
                    f"'{item['column']}' has {item['count']} possible outlier(s) "
                    f"(values outside [{item['lower']:.2f}, {item['upper']:.2f}])"
                )
            answer = f"Outlier Analysis:\n\n{'; '.join(details)}. A Box Plot is recommended to inspect these extreme points."
            chart = {"type": "box", "xKey": outliers[0]["column"], "yKey": outliers[0]["column"], "aggregation": "distribution", "reason": "Box plot highlights outliers and interquartile spread."}
        else:
            answer = "No statistical outliers were detected across numeric columns using the standard 1.5 × IQR threshold. Values are distributed within expected normal bounds."
            if selected_metric:
                chart = {"type": "box", "xKey": selected_metric, "yKey": selected_metric, "aggregation": "distribution", "reason": "Box plot displays median, quartiles, and whisker bounds."}

    # 7. MISSING VALUES / CLEANING / QUALITY
    elif any(k in q for k in ["missing", "null", "empty cell", "na ", "nan", "data quality", "clean", "completeness"]):
        missing_total = 0
        missing_cols = []
        if cleaning_report:
            missing_total = cleaning_report.get("missingTotal", 0)
            missing_cols = cleaning_report.get("columnsWithMissing", [])
        elif "missingByColumn" in profile:
            missing_total = sum(profile["missingByColumn"].values())
            missing_cols = [{"column": k, "missing": v} for k, v in profile["missingByColumn"].items() if v > 0]

        if missing_total > 0:
            col_list = ", ".join([f"{c['column']} ({c['missing']} missing)" for c in missing_cols])
            answer = f"The dataset contains {missing_total} missing value(s) in: {col_list}. Data imputation or record cleaning is recommended before critical modeling."
        else:
            answer = f"Great news! The dataset is 100% complete with 0 missing values across all {total_rows} rows and {total_cols} columns."
        if selected_dimension and selected_metric:
            chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": "Bar chart comparing complete category aggregates."}

    # 8. AVERAGE / MEAN
    elif any(k in q for k in ["average", "avg", "mean"]):
        if selected_metric:
            avg_val = get_col_mean(selected_metric)
            sum_val = get_col_sum(selected_metric)
            formatted_avg = fmt_num(avg_val, is_currency_metric)
            s_info = num_summary.get(selected_metric, {})
            min_val = s_info.get("min", 0)
            max_val = s_info.get("max", 0)
            answer = (
                f"The average (mean) {selected_metric} is {formatted_avg} per record "
                f"(Total: {fmt_num(sum_val, is_currency_metric)}, Min: {fmt_num(min_val, is_currency_metric)}, Max: {fmt_num(max_val, is_currency_metric)})."
            )
            chart = {"type": "histogram", "xKey": selected_metric, "yKey": "count", "aggregation": "count", "reason": f"Shows distribution and frequency around the average {selected_metric}."}

    # 9. HIGHEST / BEST / TOP / MAX
    elif any(re.search(r'\b' + re.escape(k) + r'\b', q) for k in ["highest", "best", "top", "max", "maximum", "most", "leader"]):
        leader = get_segment_leader(selected_dimension, selected_metric) if selected_dimension and selected_metric else None
        if leader:
            val_str = fmt_num(leader["topValue"], is_currency_metric)
            tot = get_col_sum(selected_metric)
            pct_str = f" ({leader['topValue'] / tot * 100:.1f}% of total)" if tot > 0 else ""
            top_list_str = ""
            if frame is not None and selected_dimension and selected_metric and selected_dimension in frame.columns and selected_metric in frame.columns:
                top_grp = (
                    pd.to_numeric(frame[selected_metric], errors="coerce")
                    .groupby(frame[selected_dimension])
                    .sum()
                    .sort_values(ascending=False)
                    .head(5)
                )
                top_list_str = f"\n\n**Top 5 {selected_dimension} by {selected_metric}:**\n" + "\n".join([
                    f"{i+1}. {idx}: {fmt_num(float(v), is_currency_metric)}" + (f" ({v/tot*100:.1f}%)" if tot > 0 else "")
                    for i, (idx, v) in enumerate(top_grp.items())
                ])
            answer = (
                f"**Top Performer Analysis:**\n\n"
                f"• **'{leader['top']}'** achieved the highest {selected_metric} across all {selected_dimension} segments with a total of **{val_str}**{pct_str}."
                f"{top_list_str}"
            )
            chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": f"Compares {selected_metric} across {selected_dimension} segments."}
        elif selected_metric:
            max_val = num_summary.get(selected_metric, {}).get("max", 0)
            answer = f"The highest recorded single value for {selected_metric} is **{fmt_num(max_val, is_currency_metric)}**."
            chart = {"type": "bar", "xKey": selected_dimension or selected_metric, "yKey": selected_metric, "aggregation": "sum"}

    # 10. LOWEST / WORST / BOTTOM / MIN
    elif any(re.search(r'\b' + re.escape(k) + r'\b', q) for k in ["lowest", "worst", "bottom", "least", "minimum", "min", "smallest"]):
        leader = get_segment_leader(selected_dimension, selected_metric) if selected_dimension and selected_metric else None
        if leader:
            val_str = fmt_num(leader["bottomValue"], is_currency_metric)
            tot = get_col_sum(selected_metric)
            pct_str = f" ({leader['bottomValue'] / tot * 100:.1f}% of total)" if tot > 0 else ""
            bot_list_str = ""
            if frame is not None and selected_dimension and selected_metric and selected_dimension in frame.columns and selected_metric in frame.columns:
                bot_grp = (
                    pd.to_numeric(frame[selected_metric], errors="coerce")
                    .groupby(frame[selected_dimension])
                    .sum()
                    .sort_values(ascending=True)
                    .head(5)
                )
                bot_list_str = f"\n\n**Lowest 5 {selected_dimension} by {selected_metric}:**\n" + "\n".join([
                    f"{i+1}. {idx}: {fmt_num(float(v), is_currency_metric)}" + (f" ({v/tot*100:.1f}%)" if tot > 0 else "")
                    for i, (idx, v) in enumerate(bot_grp.items())
                ])
            answer = (
                f"**Lowest Performer Analysis:**\n\n"
                f"• **'{leader['bottom']}'** recorded the lowest {selected_metric} across all {selected_dimension} segments with **{val_str}**{pct_str}."
                f"{bot_list_str}\n\n"
                f"• Recommendation: Review operational costs, inventory allocation, or pricing strategies for this segment."
            )
            chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": f"Compares {selected_metric} across {selected_dimension} segments."}
        elif selected_metric:
            min_val = num_summary.get(selected_metric, {}).get("min", 0)
            answer = f"The lowest recorded single value for {selected_metric} is **{fmt_num(min_val, is_currency_metric)}**."
            chart = {"type": "bar", "xKey": selected_dimension or selected_metric, "yKey": selected_metric, "aggregation": "sum"}

    # 11. TOTAL / SUM
    elif any(k in q for k in ["total", "sum", "overall", "all sales", "combined", "aggregate"]):
        if selected_metric:
            tot = get_col_sum(selected_metric)
            val_str = fmt_num(tot, is_currency_metric)
            avg = get_col_mean(selected_metric)
            answer = (
                f"**Total Aggregation for {selected_metric}:**\n\n"
                f"• **Overall Total**: **{val_str}** across all {total_rows:,} records\n"
                f"• **Average per Record**: {fmt_num(avg, is_currency_metric)}"
            )
            if selected_dimension:
                chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": f"Breakdown of total {selected_metric} by {selected_dimension}."}
            elif dates:
                chart = {"type": "line", "xKey": dates[0], "yKey": selected_metric, "aggregation": "sum", "reason": f"Timeline showing total {selected_metric} progression."}

    # 12. TREND / TIME / DATE
    elif any(k in q for k in ["trend", "time", "date", "daily", "monthly", "over time", "timeline", "progression"]):
        if dates and selected_metric:
            chart = {"type": "line", "xKey": dates[0], "yKey": selected_metric, "aggregation": "sum", "reason": f"Visualizes {selected_metric} trajectory over {dates[0]}."}
            answer = f"Showing the {selected_metric} trend over {dates[0]}. A line chart highlights momentum, peaks, and dips over time."
        else:
            answer = f"Temporal trend analysis requires a date column. Available dates: {dates or 'None'}. Displaying {selected_metric} breakdown instead."
            if selected_dimension and selected_metric:
                chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum"}

    # 13. BREAKDOWN / SHARE / DISTRIBUTION
    elif any(k in q for k in ["by category", "breakdown", "share", "percentage", "contribution", "distribution"]):
        if selected_dimension and selected_metric:
            chart = {"type": "pie", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum", "reason": f"Shows share of {selected_metric} by {selected_dimension}."}
            tot = get_col_sum(selected_metric)
            answer = f"Here is the breakdown of {selected_metric} by {selected_dimension} (Total: {fmt_num(tot, is_currency_metric)}). A pie or bar chart displays the proportional distribution."
        elif selected_metric:
            chart = {"type": "histogram", "xKey": selected_metric, "yKey": "count", "aggregation": "count", "reason": f"Distribution of {selected_metric} values."}
            answer = f"Displaying the frequency distribution for {selected_metric} across all records."

    # 14. UNIVERSAL DATASET SYNTHESIS (Answers ANY other question with real numbers)
    else:
        dim = selected_dimension or (categorical[0] if categorical else None)
        met = selected_metric or (numeric[0] if numeric else None)
        
        stat_summary = ""
        margin_line = ""
        if rev_col and profit_col:
            r_tot = get_col_sum(rev_col)
            p_tot = get_col_sum(profit_col)
            if r_tot > 0:
                margin_line = f"• Overall Margin: {(p_tot / r_tot * 100):.1f}% (Total Revenue: {fmt_num(r_tot, True)}, Total Profit: {fmt_num(p_tot, True)})\n"

        if met:
            tot = get_col_sum(met)
            avg = get_col_mean(met)
            stat_summary = f"• Total {met}: {fmt_num(tot, is_currency_metric)} (Average: {fmt_num(avg, is_currency_metric)} per record)\n"
            
        leader_summary = ""
        if dim and met:
            ldr = get_segment_leader(dim, met)
            if ldr:
                leader_summary = f"• Top {dim}: '{ldr['top']}' with {fmt_num(ldr['topValue'], is_currency_metric)}\n• Lowest {dim}: '{ldr['bottom']}' with {fmt_num(ldr['bottomValue'], is_currency_metric)}\n"
                
        answer = (
            f"**Comprehensive Analysis for \"{question}\":**\n\n"
            f"Based on your dataset profile of {total_rows:,} records:\n"
            f"{margin_line}"
            f"{stat_summary}"
            f"{leader_summary}"
            f"• Available Dimensions: {', '.join(categorical[:4])}\n"
            f"• Key Quantitative Metrics: {', '.join(numeric[:4])}\n\n"
            f"**Analyst Assessment**: The dataset shows robust commercial performance. We have generated a visual breakdown below to give you direct visibility into performance by {dim}."
        )
        if dim and met:
            chart = {"type": "bar", "xKey": dim, "yKey": met, "aggregation": "sum", "reason": f"Breakdown of {met} by {dim}."}

    # Ensure default chart if still none
    if not chart:
        if dates and numeric:
            chart = {"type": "line", "xKey": dates[0], "yKey": numeric[0], "aggregation": "sum"}
        elif selected_dimension and selected_metric:
            chart = {"type": "bar", "xKey": selected_dimension, "yKey": selected_metric, "aggregation": "sum"}
        elif selected_metric:
            chart = {"type": "histogram", "xKey": selected_metric, "yKey": "count", "aggregation": "count"}

    return {
        "answer": answer,
        "chart": chart,
        "insights": insights[:5],
        "source": source,
    }


def ask_llm(
    question: str,
    profile: dict[str, Any],
    insights: list[str],
    cleaning_report: Optional[dict[str, Any]] = None,
    frame: Optional[pd.DataFrame] = None,
) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    if not api_key:
        return _fallback_answer(question, profile, insights, cleaning_report=cleaning_report, frame=frame)

    client = OpenAI(api_key=api_key)
    payload = {
        "question": question,
        "profile": profile,
        "cleaningReport": cleaning_report,
        "insights": insights,
    }

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload, default=str)},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        parsed = json.loads(content)
        parsed["source"] = f"LLM: {model}"
        return parsed
    except Exception as exc:
        fallback = _fallback_answer(question, profile, insights, cleaning_report=cleaning_report, frame=frame)
        fallback["source"] = f"fallback after LLM error: {exc}"
        return fallback
