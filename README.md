# AI-Powered Data Visualization Assistant for Automated Insights and Decision Support

An AI-powered data analysis and visualization project for automated insights and decision support. Users upload CSV data, ask questions in natural language, receive chart recommendations, inspect data quality, and export charts or insight reports.

## What This Project Includes

- React dashboard for CSV upload, assistant chat, chart recommendations, manual chart building, and data preview
- Python FastAPI backend for dataset profiling, cleaning reports, statistical insights, and chart data preparation
- Optional LLM integration using the OpenAI API
- Browser fallback assistant logic, so the app still works without an API key or backend
- Visualization support for bar, line, pie, scatter, histogram, and correlation heatmap views
- Export chart as PNG and export analysis report as text

## Tools And Libraries

Frontend:

- React
- Vite
- Recharts
- Papa Parse
- Lucide React
- html2canvas

Backend:

- Python
- FastAPI
- Pandas
- NumPy
- Matplotlib
- Seaborn
- Plotly
- Scikit-learn
- Uvicorn

AI / LLM:

- OpenAI API, optional
- Prompt-based dataset question answering
- Rule-based fallback when no key is configured

## Architecture

```text
React Frontend
  | CSV upload
  | Assistant chat
  | Interactive charts
  | Export tools
  v
Python FastAPI Backend
  | Pandas profiling
  | Data quality checks
  | Chart recommendation
  | Optional LLM calls
  v
LLM Layer
  | Natural language answers
  | Chart suggestions
  | Insight explanation
```

## Frontend Setup

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Backend Setup

Install Python 3.11 or newer, then run:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

## LLM Setup

Copy `.env.example` to `.env` and add your API key:

```text
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
VITE_API_BASE_URL=http://127.0.0.1:8000
```

The app works without an API key by using the local fallback assistant.

## Main Backend APIs

- `GET /health`
- `POST /upload`
- `POST /ask`
- `POST /chart-data`
- `GET /report/{dataset_id}`

## Key Features

- Upload CSV datasets
- Detect numeric, categorical, and date columns
- Show missing values, duplicates, category inconsistencies, and outliers
- Generate automatic insights
- Recommend the best chart types
- Ask natural language questions about the dataset
- Build charts manually with chart type, x-axis, y-axis, and aggregation controls
- Export chart as PNG
- Export insight report as text

## Verification

Frontend:

```bash
npm run lint
npm run build
```

Backend, after installing Python dependencies:

```bash
cd backend
python -m uvicorn main:app --reload
```

## Future Scope

- PDF report export
- Excel upload support
- Saved dataset history with SQLite
- More advanced anomaly detection
- Forecasting with scikit-learn
- Authentication for multi-user dashboards
