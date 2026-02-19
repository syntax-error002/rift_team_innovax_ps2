@echo off
echo Starting Digital Detective Engine...
echo Access the dashboard at http://localhost:8000
uvicorn main:app --reload --port 8000
pause
