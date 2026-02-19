from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import io
import networkx as nx
from .logic import analyze_transactions

app = FastAPI(title="Financial Forensics Engine")

# CORS Configuration
origins = [
    "http://localhost:3000",  # Next.js Frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GraphResponse(BaseModel):
    elements: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    flagged_accounts: List[Dict[str, Any]]
    fraud_rings: List[Dict[str, Any]]

@app.get("/")
def read_root():
    return {"status": "active", "service": "Financial Forensics Engine"}

@app.post("/analyze", response_model=GraphResponse)
async def analyze_data(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV.")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Validate required columns
        required_cols = {'source', 'target', 'amount', 'timestamp'}
        if not required_cols.issubset(df.columns):
             # Try to map common variations if strict columns aren't found
            df.columns = df.columns.str.lower()
            if not required_cols.issubset(df.columns):
                 raise HTTPException(status_code=400, detail=f"CSV must contain columns: {required_cols}")

        result = analyze_transactions(df)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
