from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import networkx as nx
from datetime import timedelta
from collections import defaultdict
import io

app = FastAPI()


def analyze_transactions(df: pd.DataFrame):

    required_columns = {"sender_id", "receiver_id", "amount", "timestamp"}
    if not required_columns.issubset(df.columns):
        raise ValueError("CSV must contain sender_id, receiver_id, amount, timestamp")

    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df.dropna(subset=required_columns, inplace=True)

    G = nx.DiGraph()

    for _, row in df.iterrows():
        G.add_edge(
            row["sender_id"],
            row["receiver_id"],
            amount=row["amount"],
            timestamp=row["timestamp"]
        )

    suspicion_scores = defaultdict(int)
    fraud_rings = []
    ring_members = set()
    ring_counter = 1

    # --------------------------
    # Pattern 1: Cycles
    # --------------------------
    cycles = list(nx.simple_cycles(G))
    for cycle in cycles:
        if 3 <= len(cycle) <= 5:
            ring_id = f"RING_{ring_counter}"
            fraud_rings.append({
                "ring_id": ring_id,
                "accounts": cycle,
                "ring_size": len(cycle)
            })
            for acc in cycle:
                suspicion_scores[acc] += 50
                ring_members.add(acc)
            ring_counter += 1

    # --------------------------
    # Pattern 2: Smurfing
    # --------------------------
    for node in G.nodes():
        if G.in_degree(node) > 10 or G.out_degree(node) > 10:
            suspicion_scores[node] += 30

    # --------------------------
    # Pattern 3: Layering
    # --------------------------
    tx_counts = (
        df.groupby("sender_id").size()
        .add(df.groupby("receiver_id").size(), fill_value=0)
    )

    for node in G.nodes():
        total_tx = tx_counts.get(node, 0)
        if total_tx < 3 and G.in_degree(node) > 0 and G.out_degree(node) > 0:
            suspicion_scores[node] += 20

    # --------------------------
    # High Velocity (72h)
    # --------------------------
    for account in G.nodes():
        acc_tx = df[
            (df["sender_id"] == account) |
            (df["receiver_id"] == account)
        ]
        if len(acc_tx) >= 2:
            if (acc_tx["timestamp"].max() -
                acc_tx["timestamp"].min()) <= timedelta(hours=72):
                suspicion_scores[account] += 20

    # =====================================================
    # NEW FEATURE 1: Mule Leader Detection
    # =====================================================
    betweenness = nx.betweenness_centrality(G)
    tx_threshold = sorted(betweenness.values(), reverse=True)

    if len(tx_threshold) > 0:
        cutoff = tx_threshold[max(1, int(0.05 * len(tx_threshold))) - 1]
    else:
        cutoff = 0

    for node in G.nodes():
        if (
            betweenness.get(node, 0) >= cutoff and
            tx_counts.get(node, 0) < 10 and
            node in ring_members
        ):
            suspicion_scores[node] += 40

    # =====================================================
    # NEW FEATURE 2: Coordinated Burst Detection
    # =====================================================
    df["hour_window"] = df["timestamp"].dt.floor("H")
    grouped = df.groupby("hour_window")

    for _, group in grouped:
        accounts = set(group["sender_id"]).union(set(group["receiver_id"]))
        if len(accounts) >= 5:
            for acc in accounts:
                suspicion_scores[acc] += 40

    # =====================================================
    # NEW FEATURE 3: Risk Propagation
    # =====================================================
    high_risk = [acc for acc, score in suspicion_scores.items() if score >= 70]

    for acc in high_risk:
        for neighbor in G.successors(acc):
            suspicion_scores[neighbor] += 15
        for neighbor in G.predecessors(acc):
            suspicion_scores[neighbor] += 15

        for neighbor in G.successors(acc):
            for second in G.successors(neighbor):
                suspicion_scores[second] += 5

    # --------------------------
    # Merchant Protection
    # --------------------------
    suspicious_accounts = []

    for account in G.nodes():
        score = suspicion_scores.get(account, 0)

        if tx_counts.get(account, 0) > 1000:
            score = min(score, 10)

        score = min(score, 100)

        if score > 0:
            suspicious_accounts.append({
                "account_id": account,
                "suspicion_score": score
            })

    summary = {
        "total_accounts": len(G.nodes()),
        "total_transactions": len(df),
        "total_suspicious_accounts": len(suspicious_accounts),
        "total_fraud_rings": len(fraud_rings)
    }

    return {
        "suspicious_accounts": suspicious_accounts,
        "fraud_rings": fraud_rings,
        "summary": summary
    }


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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def health():
    return {"status": "Money Muling Detection Engine Running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
