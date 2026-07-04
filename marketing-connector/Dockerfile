# Same image runs under GitHub Actions today and as a Cloud Run Job later.
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
COPY pipeline ./pipeline
RUN pip install --no-cache-dir .

# SQL files are read relative to the project root at runtime.
COPY sql ./sql

ENTRYPOINT ["python", "-m", "pipeline.jobs.run_daily"]
