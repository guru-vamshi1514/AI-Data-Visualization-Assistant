from __future__ import annotations

import os
from io import BytesIO
from typing import Any, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.chart_recommender import aggregate_chart_data, recommend_charts
from services.data_profiler import DatasetContext, build_context, load_csv
from services.llm_assistant import ask_llm

load_dotenv()

app = FastAPI(title="AI-Powered Data Visualization Assistant for Automated Insights and Decision Support API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5175",
        "http://localhost:5175",
        "http://127.0.0.1:5176",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATASETS: dict[str, DatasetContext] = {}


class AskRequest(BaseModel):
    dataset_id: str
    question: str


class ChartRequest(BaseModel):
    dataset_id: str
    chart_type: str
    x_key: Optional[str] = None
    y_key: Optional[str] = None
    aggregation: str = "sum"


def get_dataset(dataset_id: str) -> DatasetContext:
    dataset = DATASETS.get(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found. Upload a CSV first.")
    return dataset


def dataset_response(dataset_id: str, file_name: str, context: DatasetContext) -> dict[str, Any]:
    recommendations = recommend_charts(context.profile)
    return {
        "datasetId": dataset_id,
        "fileName": file_name,
        "profile": context.profile,
        "cleaningReport": context.cleaning_report,
        "insights": context.insights,
        "recommendations": recommendations,
    }


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "AI-Powered Data Visualization Assistant API",
        "version": "1.0.0",
        "status": "running",
        "docs": "http://127.0.0.1:8000/docs",
        "endpoints": {
            "GET /": "This page — API overview",
            "GET /health": "Health check",
            "GET /docs": "Interactive Swagger API documentation",
            "POST /upload": "Upload a CSV dataset for profiling and analysis",
            "POST /ask": "Ask a natural language question about your dataset",
            "POST /chart-data": "Get aggregated chart data for a visualization",
            "GET /report/{dataset_id}": "Get the full analysis report for a dataset",
        },
        "frontend": "http://localhost:5173",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "ok",
        "has_openai": has_openai,
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini") if has_openai else None,
        "port": 8000,
    }


@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    filename_lower = (file.filename or "").lower()
    valid_exts = (".csv", ".xlsx", ".xls", ".json")
    if not any(filename_lower.endswith(ext) for ext in valid_exts):
        raise HTTPException(status_code=400, detail="Only CSV, Excel (.xlsx, .xls), and JSON files are supported.")

    content = await file.read()
    try:
        if filename_lower.endswith(".csv"):
            frame = load_csv(BytesIO(content))
        elif filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
            import pandas as pd
            frame = pd.read_excel(BytesIO(content))
            frame.columns = [str(c).strip() for c in frame.columns]
            frame = frame.dropna(how="all")
        elif filename_lower.endswith(".json"):
            import pandas as pd
            frame = pd.read_json(BytesIO(content))
            frame.columns = [str(c).strip() for c in frame.columns]
            frame = frame.dropna(how="all")
        else:
            frame = load_csv(BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc

    dataset_id = str(uuid4())
    context = build_context(frame)
    DATASETS[dataset_id] = context
    return dataset_response(dataset_id, file.filename, context)


@app.post("/ask")
def ask_assistant(request: AskRequest) -> dict[str, Any]:
    dataset = get_dataset(request.dataset_id)
    answer = ask_llm(
        request.question,
        dataset.profile,
        dataset.insights,
        cleaning_report=dataset.cleaning_report,
        frame=dataset.frame,
    )
    chart = answer.get("chart")
    chart_data = []

    if chart:
        chart_data = aggregate_chart_data(
            dataset.frame,
            chart.get("type", "bar"),
            chart.get("xKey"),
            chart.get("yKey"),
            chart.get("aggregation", "sum"),
        )

    return {
        "answer": answer.get("answer", ""),
        "chart": chart,
        "chartData": chart_data,
        "insights": answer.get("insights", dataset.insights),
        "source": answer.get("source", "assistant"),
    }


@app.post("/chart-data")
def chart_data(request: ChartRequest) -> dict[str, Any]:
    dataset = get_dataset(request.dataset_id)
    data = aggregate_chart_data(
        dataset.frame,
        request.chart_type,
        request.x_key,
        request.y_key,
        request.aggregation,
    )
    return {"data": data}


@app.get("/report/{dataset_id}")
def report(dataset_id: str) -> dict[str, Any]:
    dataset = get_dataset(dataset_id)
    return {
        "profile": dataset.profile,
        "cleaningReport": dataset.cleaning_report,
        "insights": dataset.insights,
        "recommendations": recommend_charts(dataset.profile),
    }
