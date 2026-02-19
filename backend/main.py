import pandas as pd
import networkx as nx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import io
import json
import collections

app = FastAPI(title="Digital Detective Engine (Algorithmic)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def analyze_fraud_graph(df: pd.DataFrame) -> Dict[str, Any]:
    # --- 1. Temporal Graph Construction ---
    G = nx.DiGraph()
    
    # Optional Timestamp handling if present
    has_timestamp = 'timestamp' in df.columns
    if has_timestamp:
        df['timestamp'] = pd.to_datetime(df['timestamp'])

    for _, row in df.iterrows():
        # Edge attributes: 'amount', and 'timestamp' if available
        attr = {'amount': row['amount']}
        if has_timestamp:
            attr['timestamp'] = row['timestamp']
        
        G.add_edge(row['sender_id'], row['receiver_id'], **attr)

    scores = {node: 0 for node in G.nodes()}
    reasons = {node: [] for node in G.nodes()}
    node_types = {node: "Grey" for node in G.nodes()}
    
    # Track metrics for "Explainable Output"
    stats = {
        "cycles_found": 0,
        "smurfs_found": 0,
        "shells_found": 0
    }

    # --- 2. Multi-dimensional Behavioral Fingerprint & Anomaly Scoring ---

    # A. Cycle Detection (DFS) -> Fraud Rings
    try:
        cycles = list(nx.simple_cycles(G))
        for cycle in cycles:
            if 3 <= len(cycle) <= 5:
                stats["cycles_found"] += 1
                for node in cycle:
                    if "Loop Participant" not in str(reasons[node]):
                        scores[node] += 50
                        reasons[node].append(f"High Risk: Part of {len(cycle)}-node Cycle (Fraud Ring)")
                        node_types[node] = "Red"
    except Exception as e:
        print(f"Cycle error: {e}")

    # B. Fan-in/Fan-out -> Smurfing
    for node in G.nodes():
        in_degree = G.in_degree(node)
        out_degree = G.out_degree(node)
        
        if in_degree >= 10:
            scores[node] += 30
            reasons[node].append(f"Smurfing: Fan-In detected ({in_degree} sources)")
            node_types[node] = "Red"
            stats["smurfs_found"] += 1
        elif out_degree >= 10: # content with 'or' logic, adding check
            scores[node] += 30
            reasons[node].append(f"Smurfing: Fan-Out detected ({out_degree} destinations)")
            node_types[node] = "Red"
            stats["smurfs_found"] += 1

    # C. Chain Analysis -> Shell Accounts (Layered Shells)
    # Logic: Low total degree (<=2) but bridging value (In ~= Out)
    for node in G.nodes():
        in_d = G.in_degree(node)
        out_d = G.out_degree(node)
        
        if in_d == 1 and out_d == 1:
            # It's a pure link. Check balance.
            in_edges = list(G.in_edges(node, data=True))
            out_edges = list(G.out_edges(node, data=True))
            
            in_amt = sum(d.get('amount', 0) for u, v, d in in_edges)
            out_amt = sum(d.get('amount', 0) for u, v, d in out_edges)
            
            # Use a small epsilon or percentage for "approximate" match
            if out_amt > 0 and 0.9 <= (in_amt / out_amt) <= 1.1:
                scores[node] += 20
                reasons[node].append("Shell Account: Passive money mule (Layering)")
                if node_types[node] == "Grey": 
                    node_types[node] = "Orange"
                stats["shells_found"] += 1

    # --- 3. Ensemble Detection & Explainable Output ---
    
    # Generate a Programmatic "Report" similar to what an AI would write
    top_suspicious = [n for n in G.nodes() if scores[n] > 0]
    top_suspicious.sort(key=lambda x: scores[x], reverse=True)
    
    report_lines = ["<h3><strong>AUTOMATED FORENSIC REPORT</strong></h3>"]
    report_lines.append(f"<p><strong>Total Accounts Analyzed:</strong> {G.number_of_nodes()}<br>")
    report_lines.append(f"<strong>Total Transactions:</strong> {G.number_of_edges()}</p>")
    report_lines.append("<hr>")
    report_lines.append("<h4><strong>DETECTED ANOMALIES</strong></h4>")
    report_lines.append("<ul>")
    if stats["cycles_found"]:
        report_lines.append(f"<li>≡ƒö┤ <strong>Fraud Rings (Cycles):</strong> Detected {stats['cycles_found']} active circular laundering schemes.</li>")
    if stats["smurfs_found"]:
        report_lines.append(f"<li>≡ƒö┤ <strong>Smurfing (Stars):</strong> Identified {stats['smurfs_found']} accounts with high fan-in/fan-out activity.</li>")
    if stats["shells_found"]:
        report_lines.append(f"<li>≡ƒƒá <strong>Shell Accounts:</strong> Flagged {stats['shells_found']} intermediaries facilitating layering.</li>")
    
    if not top_suspicious:
        report_lines.append("<li>Γ£à No significant fraud patterns detected.</li>")
    report_lines.append("</ul>")

    report_lines.append("<h4><strong>HIGH RISK ENTITIES</strong></h4>")
    for node in top_suspicious[:5]: # Top 5
        report_lines.append(f"<p><strong>ID: {node}</strong> (Score: {scores[node]})<br>")
        report_lines.append(f"<em style='color:#ccc'>{reasons[node][0]}</em></p>")
    
    explainable_output = "".join(report_lines)

    # Format for JSON Output
    flagged_accounts = []
    for node in top_suspicious:
        risk_type = "Red" if scores[node] >= 50 else ("Orange" if scores[node] >= 20 else "Grey")
        flagged_accounts.append({
            "id": str(node),
            "risk_score": scores[node],
            "reason": "; ".join(reasons[node]) if reasons[node] else "Clean",
            "type": node_types[node].lower(), # red, orange, grey -> mapped to frontend types?
            "community": 0 # Default
        })
    
    # Cytoscape Elements
    elements = []
    for node in G.nodes():
        elements.append({
            "data": {
                "id": str(node),
                "risk_score": scores[node],
                "type": node_types[node].lower(), # red, orange, grey
                "suspicious": scores[node] > 0
            }
        })
    for u, v, d in G.edges(data=True):
        elements.append({
            "data": {
                "source": str(u),
                "target": str(v),
                "amount": str(d.get('amount', ''))
            }
        })

    # Fraud Rings Data (Re-extracting for frontend)
    fraud_rings_data = []
    try:
        cycles = list(nx.simple_cycles(G))
        for i, cycle in enumerate(cycles):
            if 3 <= len(cycle) <= 5:
                fraud_rings_data.append({
                    "ring_id": f"RING_{i+1}",
                    "member_accounts": list(cycle),
                    "pattern_type": "Cycle",
                    "risk_score": 90
                })
    except:
        pass

    metrics = {
        "total_transactions": len(df),
        "total_volume": float(df['amount'].sum()) if 'amount' in df.columns else 0,
        "suspicious_count": len(flagged_accounts),
        "graph_density": nx.density(G),
        "benford_status": "Normal" # Placeholder
    }

    return {
        "network_analysis": flagged_accounts, # Legacy support
        "flagged_accounts": flagged_accounts, # Frontend expects this
        "fraud_rings": fraud_rings_data,
        "metrics": metrics,
        "elements": elements,
        "explainable_report": explainable_output
    }

@app.get("/sample-csv")
async def get_sample_csv():
    # Sample data showing all 3 patterns
    # Sample data showing all 3 patterns with strict spec
    sample_data = """transaction_id,sender_id,receiver_id,amount,timestamp
TXN1001,CycleA,CycleB,1000,2026-02-18 10:00:00
TXN1002,CycleB,CycleC,1000,2026-02-18 10:05:00
TXN1003,CycleC,CycleA,1000,2026-02-18 10:10:00
TXN2001,SmurfMaster,S1,500,2026-02-18 11:00:00
TXN2002,SmurfMaster,S2,500,2026-02-18 11:01:00
TXN2003,SmurfMaster,S3,500,2026-02-18 11:02:00
TXN2004,SmurfMaster,S4,500,2026-02-18 11:03:00
TXN2005,SmurfMaster,S5,500,2026-02-18 11:04:00
TXN2006,SmurfMaster,S6,500,2026-02-18 11:05:00
TXN2007,SmurfMaster,S7,500,2026-02-18 11:06:00
TXN2008,SmurfMaster,S8,500,2026-02-18 11:07:00
TXN2009,SmurfMaster,S9,500,2026-02-18 11:08:00
TXN2010,SmurfMaster,S10,500,2026-02-18 11:09:00
TXN2011,SmurfMaster,S11,500,2026-02-18 11:10:00
TXN3001,Source,ShellAccount,5000,2026-02-18 12:00:00
TXN3002,ShellAccount,Sink,5000,2026-02-18 12:30:00
"""
    return Response(content=sample_data, media_type="text/csv")

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    print(f"Received file upload request: {file.filename}")
    if not file.filename.endswith('.csv'):
        print("Error: File is not a CSV")
        raise HTTPException(status_code=400, detail="CSV required")
    
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except:
        raise HTTPException(status_code=400, detail="Invalid CSV file")
    
    required = {'sender_id', 'receiver_id', 'amount'}
    # Helper to clean columns if they have spaces
    df.columns = [c.strip() for c in df.columns]
    
    if not required.issubset(df.columns):
        raise HTTPException(status_code=400, detail=f"Missing columns. Required: {required}")

    # Data Cleaning: Handle currency symbols ($1,000.00) in amount
    try:
        if df['amount'].dtype == 'object':
            df['amount'] = df['amount'].astype(str).str.replace(r'[$,\s]', '', regex=True)
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
    except Exception as e:
        print(f"Data cleaning error: {e}")
        raise HTTPException(status_code=400, detail="Invalid data in 'amount' column")

    try:
        result = analyze_fraud_graph(df)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis Logic Error: {str(e)}")

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    with open("index.html", "r") as f:
        return f.read()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
