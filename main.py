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
        report_lines.append(f"<li>🔴 <strong>Fraud Rings (Cycles):</strong> Detected {stats['cycles_found']} active circular laundering schemes.</li>")
    if stats["smurfs_found"]:
        report_lines.append(f"<li>🔴 <strong>Smurfing (Stars):</strong> Identified {stats['smurfs_found']} accounts with high fan-in/fan-out activity.</li>")
    if stats["shells_found"]:
        report_lines.append(f"<li>🟠 <strong>Shell Accounts:</strong> Flagged {stats['shells_found']} intermediaries facilitating layering.</li>")
    
    if not top_suspicious:
        report_lines.append("<li>✅ No significant fraud patterns detected.</li>")
    report_lines.append("</ul>")

    report_lines.append("<h4><strong>HIGH RISK ENTITIES</strong></h4>")
    for node in top_suspicious[:5]: # Top 5
        report_lines.append(f"<p><strong>ID: {node}</strong> (Score: {scores[node]})<br>")
        report_lines.append(f"<em style='color:#ccc'>{reasons[node][0]}</em></p>")
    
    explainable_output = "".join(report_lines)

    # Format for JSON Output
    results = []
    for node in G.nodes():
        risk_type = "Red" if scores[node] >= 50 else ("Orange" if scores[node] >= 20 else "Grey")
        results.append({
            "id": str(node),
            "score": scores[node],
            "reason": "; ".join(reasons[node]) if reasons[node] else "Clean",
            "type": risk_type
        })
    
    # Graph Data
    graph_data = {
        "nodes": [{"id": str(n), "score": scores[n], "type": node_types[n]} for n in G.nodes()],
        "links": [{"source": str(u), "target": str(v), "amount": d['amount']} for u, v, d in G.edges(data=True)]
    }

    return {
        "network_analysis": results,
        "graph_data": graph_data,
        "explainable_report": explainable_output
    }

@app.get("/sample-csv")
async def get_sample_csv():
    # Sample data showing all 3 patterns
    sample_data = """sender_id,receiver_id,amount
CycleA,CycleB,1000
CycleB,CycleC,1000
CycleC,CycleA,1000
SmurfMaster,S1,500
SmurfMaster,S2,500
SmurfMaster,S3,500
SmurfMaster,S4,500
SmurfMaster,S5,500
SmurfMaster,S6,500
SmurfMaster,S7,500
SmurfMaster,S8,500
SmurfMaster,S9,500
SmurfMaster,S10,500
SmurfMaster,S11,500
Source,ShellAccount,5000
ShellAccount,Sink,5000
"""
    return Response(content=sample_data, media_type="text/csv")

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
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

    result = analyze_fraud_graph(df)
    return result

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    with open("index.html", "r") as f:
        return f.read()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
