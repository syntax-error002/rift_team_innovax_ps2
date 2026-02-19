import networkx as nx
import pandas as pd
from typing import Dict, Any, List
import numpy as np
from networkx.algorithms.community import louvain_communities

def analyze_transactions(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Analyzes transaction data to detect money mules and build a graph.
    Now with INSANE detections: Community Detection & PageRank.
    """
    G = nx.DiGraph()
    
    # 1. Build Graph
    for _, row in df.iterrows():
        src = str(row['source'])
        tgt = str(row['target'])
        amt = float(row['amount'])
        
        # Add edges with attributes
        G.add_edge(src, tgt, amount=amt, timestamp=row.get('timestamp'))
        
        # Add nodes if they don't exist
        if not G.has_node(src): G.add_node(src)
        if not G.has_node(tgt): G.add_node(tgt)

    # 2. "Intense" Analysis Logic
    
    # A. Centrality Analysis (PageRank - "The Kingpin Score")
    try:
        pagerank = nx.pagerank(G, weight='amount', alpha=0.85)
    except:
        pagerank = {n: 0 for n in G.nodes()}

    # B. Community Detection (Louvain - "The Crime Rings")
    # Groups nodes that interact more with each other than with others
    try:
        # Louvain needs undirected graph usually, or convert
        undirected_G = G.to_undirected()
        communities = louvain_communities(undirected_G, weight='amount', seed=42)
        community_map = {}
        for idx, comm in enumerate(communities):
            for node in comm:
                community_map[node] = idx
    except:
        community_map = {n: 0 for n in G.nodes()}

    # C. Benford's Law (Dataset Integrity)
    # Checks if first digits of amounts follow expected distribution (Log10(1 + 1/d))
    # If not, data might be synthetic/fraudulent.
    first_digits = [int(str(abs(int(amt)))[:1]) for amt in df['amount'] if amt >= 1]
    benford_alert = False
    if len(first_digits) > 100:
        digit_1_count = first_digits.count(1)
        # Expected freq of '1' is ~30.1%
        freq_1 = digit_1_count / len(first_digits)
        if freq_1 < 0.20 or freq_1 > 0.40: # Wide tolerance for hackathon
            benford_alert = True

    # D. Mules & Smurfing (Flow Analysis)
    in_degree = dict(G.in_degree(weight='amount'))
    out_degree = dict(G.out_degree(weight='amount'))
    
    suspicious_nodes = []
    
    for node in G.nodes():
        curr_in = in_degree.get(node, 0)
        curr_out = out_degree.get(node, 0)
        pr_score = pagerank.get(node, 0)
        comm_id = community_map.get(node, -1)
        
        # Flow Imbalance 
        balance = curr_in - curr_out
        flow_ratio = curr_out / (curr_in + 0.001) 
        
        is_suspicious = False
        risk_score = 0
        node_type = "standard"

        # Heuristic 1: Mule (Pass-through)
        if curr_in > 1000 and abs(balance) < (curr_in * 0.1): 
            is_suspicious = True
            risk_score += 40
            node_type = "mule"

        # Heuristic 2: Structuring / Smurfing (Many small ins, one big out)
        # Assuming < $10,000 is the reporting threshold, closer to 9000-9999 is suspicious
        # Or just many small transactions coming in.
        avg_in_tx = curr_in / (G.in_degree(node) + 0.001)
        if G.in_degree(node) > 5 and avg_in_tx < 3000 and curr_out > (curr_in * 0.9):
             is_suspicious = True
             risk_score += 35
             node_type = "aggregator" # Smurf aggregator

        # Heuristic 3: Source / Kingpin (High PR + High Out + Low In)
        if pr_score > 0.05: # High relative influence
            risk_score += 20
            if curr_out > (curr_in * 1.5): # Net exporter of funds
                 node_type = "source"
                 risk_score += 15

        # Assign attributes to graph
        G.nodes[node]['risk_score'] = risk_score
        G.nodes[node]['type'] = node_type
        G.nodes[node]['suspicious'] = is_suspicious or risk_score > 5
        G.nodes[node]['community'] = comm_id
        G.nodes[node]['pagerank'] = pr_score
        
        if G.nodes[node]['suspicious']:
            suspicious_nodes.append({
                "id": node,
                "risk_score": float(f"{risk_score:.2f}"),
                "type": node_type,
                "community": comm_id,
                "reason": f"High Flow + PR {pr_score:.3f}"
            })

    # 3. Detect Cycles (Circular Trading)
    try:
        cycles = list(nx.simple_cycles(G))
        fraud_rings = [c for c in cycles if len(c) > 2 and len(c) < 6]
        
        for ring in fraud_rings:
            for node in ring:
                 G.nodes[node]['risk_score'] += 50
                 G.nodes[node]['suspicious'] = True
                 G.nodes[node]['type'] = 'ring_member'
                 
    except Exception:
        fraud_rings = []

    # 4. JSON Format for Cytoscape (Include Community Colors?)
    elements = []
    
    # Nodes
    for node, attrs in G.nodes(data=True):
        elements.append({
            "data": {
                "id": node,
                "risk_score": attrs.get('risk_score', 0),
                "type": attrs.get('type', 'standard'),
                "suspicious": attrs.get('suspicious', False),
                "community": attrs.get('community', 0),
                "pagerank": attrs.get('pagerank', 0)
            }
        })
        
    # Edges
    for u, v, attrs in G.edges(data=True):
        elements.append({
            "data": {
                "source": u,
                "target": v,
                "amount": attrs.get('amount', 0),
                "timestamp": attrs.get('timestamp', '')
            }
        })

    metrics = {
        "total_transactions": len(df),
        "total_volume": float(df['amount'].sum()),
        "suspicious_count": len(suspicious_nodes),
        "graph_density": nx.density(G),
        "benford_status": "Abnormal" if benford_alert else "Normal"
    }

    return {
        "elements": elements,
        "metrics": metrics,
        "flagged_accounts": suspicious_nodes,
        "fraud_rings": [{"ring_id": f"RING_{i}", "member_accounts": list(ring), "pattern_type": "Cycle", "risk_score": 90} for i, ring in enumerate(fraud_rings)]
    }
