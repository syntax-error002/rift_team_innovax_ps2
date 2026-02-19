from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import networkx as nx
from datetime import timedelta
from collections import defaultdict
import io

app = FastAPI(title="Money Muling Detection Engine")

# CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# Core Analysis
# =====================================================

def analyze_transactions(df: pd.DataFrame):

    required_columns = {"sender_id", "receiver_id", "amount", "timestamp"}
    if not required_columns.issubset(df.columns):
        raise ValueError("CSV must contain sender_id, receiver_id, amount, timestamp")

    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df.dropna(inplace=True)

    G = nx.DiGraph()

    for _, row in df.iterrows():
        G.add_edge(row["sender_id"], row["receiver_id"])

    suspicion_scores = defaultdict(int)
    fraud_rings = []
    ring_counter = 1

    # Cycle Detection (Safe version)
    try:
        cycles = list(nx.simple_cycles(G))
        cycles = [c for c in cycles if 3 <= len(c) <= 5]
    except:
        cycles = []

    for cycle in cycles:
        ring_id = f"RING_{ring_counter}"
        fraud_rings.append({
            "ring_id": ring_id,
            "accounts": cycle,
            "ring_size": len(cycle)
        })
        for acc in cycle:
            suspicion_scores[acc] += 50
        ring_counter += 1

    # High degree detection
    for node in G.nodes():
        if G.in_degree(node) > 10 or G.out_degree(node) > 10:
            suspicion_scores[node] += 30

    # Velocity detection
    for account in G.nodes():
        acc_tx = df[
            (df["sender_id"] == account) |
            (df["receiver_id"] == account)
        ]
        if len(acc_tx) >= 2:
            time_diff = acc_tx["timestamp"].max() - acc_tx["timestamp"].min()
            if time_diff <= timedelta(hours=72):
                suspicion_scores[account] += 20

    suspicious_accounts = []

    for account in G.nodes():
        score = min(suspicion_scores.get(account, 0), 100)

        if score >= 70:
            risk = "High"
        elif score >= 40:
            risk = "Medium"
        elif score > 0:
            risk = "Low"
        else:
            continue

        suspicious_accounts.append({
            "account_id": account,
            "suspicion_score": score,
            "risk_level": risk
        })

    suspicious_accounts = sorted(
        suspicious_accounts,
        key=lambda x: x["suspicion_score"],
        reverse=True
    )

    summary = {
        "total_accounts": len(G.nodes()),
        "total_transactions": len(df),
        "total_suspicious_accounts": len(suspicious_accounts),
        "total_fraud_rings": len(fraud_rings)
    }

    return {
        "summary": summary,
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings": fraud_rings
    }

# =====================================================
# API Endpoint
# =====================================================

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        result = analyze_transactions(df)
        return JSONResponse(content=result)

    except Exception as e:
        return {"error": str(e)}

@app.get("/")
def health():
    return {"status": "API Running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
