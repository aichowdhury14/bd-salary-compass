"""BD Salary Compass: data pipeline for Bangladesh salary benchmarks, tax and market analysis."""

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = PIPELINE_DIR / "data"
PROJECT_DIR = PIPELINE_DIR.parent
WEB_DATA_DIR = PROJECT_DIR / "web" / "src" / "data"
REPORTS_DIR = PROJECT_DIR / "reports"
