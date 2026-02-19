
import pandas as pd
import networkx as nx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from typing import List, Dict, Any
import io
import time
import math
import collections
import numpy as np

app = FastAPI(title="RIFT 2026 Detection Engine")

# CORS is essential for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── HELPER FUNCTIONS ─────────────────────────────────────────────

def find_cycles_bounded(G, length_bound=5):
    """
    Optimized cycle detection restricted by length.
    Finds cycles of length 2 to length_bound.
    """
    cycles = []
    try:
        # 1. Decompose into Strongly Connected Components (SCCs)
        sccs = [scc for scc in nx.strongly_connected_components(G) if len(scc) > 1]
        
        for scc in sccs:
            # Heuristic: If SCC is massive (>100 nodes), it's a "Complex Network" 
            # and simple_cycles will hang. We treat the whole SCC as a ring of interest 
            # separately, but for strict cycle enumeration, we skip or sample.
            if len(scc) > 100:
                continue 
            
            subG = G.subgraph(scc)
            
            # 2. Run simple_cycles on the manageable component
            # This generator yields cycles. We filter them on the fly.
            cycle_gen = nx.simple_cycles(subG)
            
            count = 0
            for cycle in cycle_gen:
                if 2 < len(cycle) <= length_bound:
                    cycles.append(cycle)
                    count += 1
                
                if count > 200: # Per-SCC limit to prevent flooding
                    break
    except Exception as e:
        print(f"Cycle detection warning: {e}")
        
    return cycles

def calculate_benford_deviation(amounts: pd.Series) -> float:
    """Calculate deviation from Benford's Law (First Digit Law)."""
    if len(amounts) < 50: return 0.0
    
    first_digits = [int(str(abs(x))[0]) for x in amounts if x >= 1]
    if not first_digits: return 0.0
    
    counts = collections.Counter(first_digits)
    total = len(first_digits)
    
    deviation = 0.0
    for d in range(1, 10):
        empirical = counts[d] / total
        expected = math.log10(1 + 1/d)
        deviation += (empirical - expected) ** 2 / expected
        
    return round(deviation, 4)

# ─── MAIN ANALYSIS LOGIC ──────────────────────────────────────────

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    start_time = time.perf_counter()
    
    # 1. LOAD DATA EFFICIENTLY
    content = await file.read()
    try:
        # Peek at columns first to decide on parse_dates
        peek_df = pd.read_csv(io.BytesIO(content), nrows=1)
        has_timestamp = 'timestamp' in peek_df.columns
        
        df = pd.read_csv(
            io.BytesIO(content), 
            dtype={
                'sender_id': 'string',
                'receiver_id': 'string',
                'amount': 'float32',
                'transaction_id': 'string'
            }, 
            parse_dates=['timestamp'] if has_timestamp else None
        )
    except Exception as e:
         raise HTTPException(status_code=400, detail=f"CSV Load Error: {str(e)}")

    # 2. NORMALIZE COLUMNS
    # Guide.md requires: sender_id, receiver_id, amount, timestamp
    # Application logic uses: source, target
    df.columns = [c.strip() for c in df.columns]
    
    rename_map = {}
    if 'sender_id' in df.columns: rename_map['sender_id'] = 'source'
    if 'receiver_id' in df.columns: rename_map['receiver_id'] = 'target'
    
    # If using source/target (legacy or different format)
    if 'source' in df.columns and 'sender_id' not in df.columns: pass # already good
    
    df = df.rename(columns=rename_map)
    
    if 'source' not in df.columns or 'target' not in df.columns:
        raise HTTPException(status_code=400, detail="Missing required columns: sender_id, receiver_id")

    # Clean amount column
    if df['amount'].dtype == 'object':
         df['amount'] = df['amount'].astype(str).str.replace(r'[$,\s]', '', regex=True)
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)

    # 3. BUILD GRAPH
    # Create DiGraph directly from Pandas for speed
    edge_attr = ['amount']
    if 'timestamp' in df.columns: edge_attr.append('timestamp')
    
    G = nx.from_pandas_edgelist(
        df, 
        source='source', 
        target='target', 
        edge_attr=edge_attr, 
        create_using=nx.DiGraph()
    )

    # 4. PRE-CALCULATE METRICS
    in_degrees = dict(G.in_degree())
    out_degrees = dict(G.out_degree())
    
    # Calculate flows
    node_in_volume = collections.defaultdict(float)
    node_out_volume = collections.defaultdict(float)
    
    # Iterate edges for volume - this is faster than G.in_edges(data=True) loop for massive graphs
    # if we iterate DataFrame. But Graph iteration is OK for 10-20k.
    for u, v, d in G.edges(data=True):
        amt = d.get('amount', 0)
        node_out_volume[u] += amt
        node_in_volume[v] += amt

    # 5. DETECT FRAUD PATTERNS
    
    suspicious_accounts_map = {} # ID -> Dict
    fraud_rings_list = []
    
    # Helper to flag account
    def flag_account(node_id, score, reason, p_type, ring_id=None):
        if node_id not in suspicious_accounts_map:
            suspicious_accounts_map[node_id] = {
                "account_id": str(node_id),
                "suspicion_score": 0,
                "detected_patterns": set(),
                "ring_id": ring_id or "NONE",
                "community": 0 # Default
            }
        
        # Update score (MAX aggregation or simple addition? Logic says additive but capped)
        current = suspicious_accounts_map[node_id]
        current["suspicion_score"] = min(100, current["suspicion_score"] + score)
        current["detected_patterns"].add(p_type)
        if ring_id: current["ring_id"] = ring_id

    # A. SMURFING (Structure / Placement)
    # High Fan-In or High Fan-Out
    FAN_THRESHOLD = 10
    
    for node in G.nodes():
        ind = in_degrees.get(node, 0)
        outd = out_degrees.get(node, 0)
        
        # Fan-In (Aggregation)
        if ind >= FAN_THRESHOLD:
            # Check Temporal Concentration if possible
            is_rapid = False
            if 'timestamp' in df.columns:
                 # Get timestamps for this receiver
                 # Optimization: access df directly
                 ts = df[df['target'] == node]['timestamp'].sort_values()
                 if not ts.empty:
                     window_hours = (ts.iloc[-1] - ts.iloc[0]).total_seconds() / 3600
                     if len(ts) > 10 and window_hours < 72: # 72h window rule
                         is_rapid = True
            
            score = 85 if is_rapid else 60
            reason = "Rapid Aggregation (Fan-In)" if is_rapid else "High Fan-In Aggregation"
            flag_account(node, score, reason, "fan_in_aggregator")

        # Fan-Out (Dispersion)
        if outd >= FAN_THRESHOLD:
            score = 60
            flag_account(node, score, "High Fan-Out Dispersion", "fan_out_source")

    # B. SHELL ACCOUNTS (Layering)
    # Low Degree (1-3 in/out) + Pass-through behavior (In ~= Out)
    for node in G.nodes():
        if node in suspicious_accounts_map: continue # optimizing
        
        ind = in_degrees.get(node, 0)
        outd = out_degrees.get(node, 0)
        
        if 1 <= ind <= 3 and 1 <= outd <= 3:
            in_vol = node_in_volume[node]
            out_vol = node_out_volume[node]
            
            if in_vol > 1000: # Ignore micros
                ratio = out_vol / in_vol
                if 0.90 <= ratio <= 1.05: # Retains < 10%
                    flag_account(node, 75, "Shell Account (Layering)", "shell_account")

    # C. CYCLES (Fraud Rings)
    raw_cycles = find_cycles_bounded(G, length_bound=5)
    
    for i, cycle in enumerate(raw_cycles):
        ring_id = f"RING_{i+1:03d}"
        
        # Calculate Ring metrics
        cycle_volume = 0
        for k in range(len(cycle)):
            src, dst = cycle[k], cycle[(k + 1) % len(cycle)]
            if G.has_edge(src, dst):
                cycle_volume += G[src][dst].get('amount', 0)
        
        fraud_rings_list.append({
            "ring_id": ring_id,
            "member_accounts": list(cycle),
            "pattern_type": "Circular Flow",
            "risk_score": 95,
            "volume": cycle_volume
        })
        
        for node in cycle:
            flag_account(node, 95, f"Member of {ring_id}", "circular_flow", ring_id)

    # D. BENFORD'S LAW (Global Check)
    benford_dev = calculate_benford_deviation(df['amount'])
    benford_status = "Normal"
    if benford_dev > 0.05: benford_status = "Suspicious"
    elif benford_dev > 0.02: benford_status = "Warning"

    # 6. ENHANCED METRICS CALCULATION
    # Calculate additional metrics for better insights
    total_volume = df['amount'].sum()
    avg_transaction_size = df['amount'].mean()
    high_value_threshold = df['amount'].quantile(0.95)
    
    # Calculate average risk score
    if suspicious_accounts_map:
        avg_risk_score = sum(acc['suspicion_score'] for acc in suspicious_accounts_map.values()) / len(suspicious_accounts_map)
    else:
        avg_risk_score = 0.0
    
    # High risk count (score >= 70)
    high_risk_count = sum(1 for acc in suspicious_accounts_map.values() if acc['suspicion_score'] >= 70)
    
    # 7. CONSTRUCT OUTPUT
    
    # 7.1 Format Suspicious Accounts List
    # Convert sets to lists for JSON
    formatted_accounts = []
    for acc in suspicious_accounts_map.values():
        acc['detected_patterns'] = list(acc['detected_patterns'])
        # Map to Frontend Keys (id, risk_score, type, reason)
        acc['id'] = acc['account_id']
        acc['risk_score'] = acc['suspicion_score']
        # Derive primary type
        patterns = acc['detected_patterns']
        if 'circular_flow' in patterns: acc['type'] = 'ring_member'
        elif 'fan_in_aggregator' in patterns: acc['type'] = 'aggregator'
        elif 'fan_out_source' in patterns: acc['type'] = 'source'
        elif 'shell_account' in patterns: acc['type'] = 'mule'
        else: acc['type'] = 'suspicious'
        
        acc['reason'] = ", ".join(patterns)
        formatted_accounts.append(acc)
        
    formatted_accounts.sort(key=lambda x: x['risk_score'], reverse=True)

    # 6.2 Frontend Elements (Nodes/Edges)
    # We must include ALL nodes and edges, marking suspicious ones
    elements = []
    suspicious_ids = set(suspicious_accounts_map.keys())
    
    for node in G.nodes():
        is_susp = node in suspicious_ids
        attrs = suspicious_accounts_map.get(node, {})
        elements.append({
            "data": {
                "id": str(node),
                "risk_score": attrs.get('suspicion_score', 0),
                "type": attrs.get('type', 'standard'),
                "suspicious": is_susp,
                "detected_patterns": attrs.get('detected_patterns', []),
                "ring_id": attrs.get('ring_id', 'NONE'),
                "in_degree": in_degrees.get(node, 0),
                "out_degree": out_degrees.get(node, 0)
            }
        })
        
    for u, v, d in G.edges(data=True):
        elements.append({
            "data": {
                "source": str(u),
                "target": str(v),
                "amount": d.get('amount', 0),
                "timestamp": str(d.get('timestamp', ''))
            }
        })
        
    processing_time = round(time.perf_counter() - start_time, 4)
    
    # 6.3 Explainable Report (HTML)
    report_lines = [
        "<h3><strong>FORENSIC ANALYSIS REPORT</strong></h3>",
        f"<p>Processed <strong>{len(df)}</strong> transactions involving <strong>{len(G)}</strong> accounts.</p>",
        f"<p>Status: <span style='color:{'red' if benford_status=='Suspicious' else 'green'}'>{benford_status}</span> (Benford Deviation: {benford_dev})</p>",
        "<hr>",
        "<h4><strong>KEY FINDINGS</strong></h4>",
        "<ul>"
    ]
    if fraud_rings_list:
        report_lines.append(f"<li>🚨 <strong>{len(fraud_rings_list)} Fraud Rings</strong> detected (Circular flows).</li>")
    
    smurf_count = sum(1 for a in formatted_accounts if 'aggregator' in a['type'] or 'source' in a['type'])
    if smurf_count:
        report_lines.append(f"<li>📉 <strong>{smurf_count} Smurfing Nodes</strong> (High Fan-in/Fan-out) identified.</li>")
        
    shell_count = sum(1 for a in formatted_accounts if 'shell' in a['type'] or 'mule' in a['type'])
    if shell_count:
         report_lines.append(f"<li>🐚 <strong>{shell_count} Shell/Mule Accounts</strong> flagged (Layering).</li>")
         
    if not formatted_accounts:
        report_lines.append("<li>✅ No significant anomalies detected.</li>")
        
    report_lines.append("</ul>")
    
    return {
        # Guide.md & Frontend Required Keys
        "suspicious_accounts": formatted_accounts,
        "fraud_rings": fraud_rings_list,
        "summary": {
            "total_accounts_analyzed": len(G.nodes()),
            "total_transactions": len(df),
            "suspicious_accounts_flagged": len(formatted_accounts),
            "fraud_rings_detected": len(fraud_rings_list),
            "processing_time_seconds": processing_time,
            "benford_status": benford_status,
            "graph_density": nx.density(G),
            "high_risk_count": high_risk_count,
            "avg_risk_score": round(avg_risk_score, 2),
            "total_volume": round(float(total_volume), 2),
            "avg_transaction_size": round(float(avg_transaction_size), 2)
        },
        # Keys expected by Frontend (ResultsTable/Page) for internal logic
        "flagged_accounts": formatted_accounts, # ALIAS for legacy
        "elements": elements,
        "metrics": { # ALIAS for legacy
            "total_accounts_analyzed": len(G.nodes()),
            "total_transactions": len(df),
            "suspicious_accounts_flagged": len(formatted_accounts),
            "fraud_rings_detected": len(fraud_rings_list),
            "processing_time_seconds": processing_time,
            "high_risk_count": high_risk_count,
            "avg_risk_score": round(avg_risk_score, 2),
            "graph_density": nx.density(G),
            "benford_status": benford_status,
            "benford_deviation": benford_dev,
            "total_volume": round(float(total_volume), 2)
        },
        "explainable_report": "\n".join(report_lines)
    }

@app.get("/sample-csv")
async def get_sample_csv():
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

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    try:
        with open("index.html", "r") as f:
            return f.read()
    except:
        return "Backend is running. Please access via Frontend."

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
