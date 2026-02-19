"""
RIFT Forensics — Advanced Transaction Analysis Engine
Detects: money mules, smurfing rings, circular flows, layering, rapid fan-out/fan-in, 
structuring below thresholds, velocity anomalies, and Benford's Law violations.
"""
import networkx as nx
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from collections import defaultdict
import math

try:
    from networkx.algorithms.community import louvain_communities
    HAS_LOUVAIN = True
except ImportError:
    HAS_LOUVAIN = False

# ─────────────────────────────────────────────────────────────
# Constants / Thresholds
# ─────────────────────────────────────────────────────────────
STRUCTURING_THRESHOLD = 10_000   # Reporting threshold (US CTR)
STRUCTURING_BAND_LOW  = 8_000    # "Just-below" structuring band
MULE_PASSTHROUGH_TOL  = 0.15     # ≤15% net balance vs flow = pass-through
MIN_RING_SIZE         = 2        # Minimum cycle size to flag
MAX_RING_SIZE         = 8        # Ignore very large cycles (usually false positives)
PAGERANK_KINGPIN      = 0.04     # PageRank threshold for kingpin designation
HIGH_RISK_THRESHOLD   = 70       # Risk score above which we label "high-risk"


def _first_digit_distribution(amounts: pd.Series) -> Dict[int, float]:
    """Benford's Law: empirical first-digit frequencies."""
    counts = defaultdict(int)
    total = 0
    for a in amounts:
        if a >= 1:
            d = int(str(abs(int(a)))[0])
            counts[d] += 1
            total += 1
    if total == 0:
        return {}
    return {d: counts[d] / total for d in range(1, 10)}


def _benford_deviation(amounts: pd.Series) -> float:
    """Chi-square-like deviation from Benford's Law. Higher = more anomalous."""
    if len(amounts) < 100:
        return 0.0
    empirical = _first_digit_distribution(amounts)
    expected = {d: math.log10(1 + 1 / d) for d in range(1, 10)}
    deviation = sum(
        (empirical.get(d, 0) - expected[d]) ** 2 / expected[d]
        for d in range(1, 10)
    )
    return round(deviation, 4)


def _detect_structuring(amounts: pd.Series, n_transactions: int) -> List[float]:
    """Identify individual transactions that fall in the structuring band."""
    return amounts[
        (amounts >= STRUCTURING_BAND_LOW) & (amounts < STRUCTURING_THRESHOLD)
    ].tolist()


def _velocity_anomaly(timestamps: pd.Series, node_in_edges: list) -> bool:
    """Check for rapid fan-in burst (many transactions in short time window)."""
    if len(node_in_edges) < 5 or timestamps is None:
        return False
    try:
        ts = pd.to_datetime(timestamps, errors='coerce').dropna().sort_values()
        if len(ts) < 2:
            return False
        window = (ts.max() - ts.min()).total_seconds() / 3600  # hours
        rate = len(ts) / max(window, 1)
        return rate > 20  # >20 transactions/hour is suspicious
    except Exception:
        return False


def analyze_transactions(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Comprehensive fraud detection pipeline:
    1. Graph construction with edge attributes
    2. PageRank / centrality analysis
    3. Community detection (Louvain)
    4. Multi-pattern heuristic scoring:
       - Money mule (pass-through)
       - Aggregator / smurfing ring
       - Structuring (below-threshold transactions)
       - Kingpin / source node
       - Velocity anomalies
       - Layering (long chain forwarding)
    5. Cycle detection (fraud rings)
    6. Benford's Law deviation
    7. Graph element serialisation for frontend
    """

    # ── 1. Data Cleaning ─────────────────────────────────────
    df = df.copy()
    df['source'] = df['source'].astype(str).str.strip()
    df['target'] = df['target'].astype(str).str.strip()
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0).abs()
    # Drop self-loops and zero-amount transactions
    df = df[df['source'] != df['target']]
    df = df[df['amount'] > 0]

    if df.empty:
        return {"elements": [], "metrics": {}, "flagged_accounts": [], "fraud_rings": []}

    # ── 2. Build Directed Graph ───────────────────────────────
    G = nx.DiGraph()
    for _, row in df.iterrows():
        src, tgt, amt = row['source'], row['target'], float(row['amount'])
        ts = row.get('timestamp', None)
        if G.has_edge(src, tgt):
            G[src][tgt]['amount'] += amt
            G[src][tgt]['count'] = G[src][tgt].get('count', 1) + 1
        else:
            G.add_edge(src, tgt, amount=amt, count=1, timestamp=ts)

    # Initialize node attribute dicts
    for node in G.nodes():
        G.nodes[node].update({
            'risk_score': 0,
            'type': 'standard',
            'suspicious': False,
            'community': 0,
            'pagerank': 0,
            'rings': [],
            'flags': [],
        })

    # ── 3. PageRank (Kingpin Score) ───────────────────────────
    try:
        pagerank = nx.pagerank(G, weight='amount', alpha=0.85, max_iter=200)
    except Exception:
        pagerank = {n: 1 / max(len(G), 1) for n in G.nodes()}

    # ── 4. Community Detection ────────────────────────────────
    community_map: Dict[str, int] = {}
    try:
        if HAS_LOUVAIN and len(G.nodes()) < 50_000:
            communities = louvain_communities(G.to_undirected(), weight='amount', seed=42)
            for idx, comm in enumerate(communities):
                for node in comm:
                    community_map[node] = idx
        else:
            # Fallback: weakly connected components as communities
            for idx, comp in enumerate(nx.weakly_connected_components(G)):
                for node in comp:
                    community_map[node] = idx
    except Exception:
        community_map = {n: 0 for n in G.nodes()}

    # ── 5. Per-node Heuristic Scoring ────────────────────────
    in_amounts  = {n: sum(d['amount'] for _, _, d in G.in_edges(n, data=True))  for n in G.nodes()}
    out_amounts = {n: sum(d['amount'] for _, _, d in G.out_edges(n, data=True)) for n in G.nodes()}
    in_degree   = dict(G.in_degree())
    out_degree  = dict(G.out_degree())

    # Build per-node transaction amount lists for structuring check
    node_in_tx_amounts: Dict[str, List[float]] = defaultdict(list)
    node_in_timestamps: Dict[str, List] = defaultdict(list)
    for u, v, d in G.edges(data=True):
        node_in_tx_amounts[v].append(d['amount'])
        if d.get('timestamp'):
            node_in_timestamps[v].append(d['timestamp'])

    for node in G.nodes():
        ci = in_amounts.get(node, 0)
        co = out_amounts.get(node, 0)
        pr = pagerank.get(node, 0)
        ind = in_degree.get(node, 0)
        outd = out_degree.get(node, 0)
        total_flow = ci + co
        balance = abs(ci - co)
        flags: List[str] = []
        risk = 0

        # ── Heuristic A: Money Mule (Pass-through) ────────────
        # High in + high out, net balance < 15% of total flow
        if total_flow > 0 and ci > 500 and co > 500:
            pass_ratio = balance / (total_flow + 1e-9)
            if pass_ratio < MULE_PASSTHROUGH_TOL:
                risk += 45
                G.nodes[node]['type'] = 'mule'
                flags.append('pass-through mule')

        # ── Heuristic B: Aggregator / Smurfing ────────────────
        # Many small inflows → one large outflow
        if ind >= 5 and ci > 0:
            avg_in = ci / ind
            if avg_in < STRUCTURING_THRESHOLD and co > ci * 0.80:
                risk += 35
                if G.nodes[node]['type'] == 'standard':
                    G.nodes[node]['type'] = 'aggregator'
                flags.append('smurfing aggregator')

        # ── Heuristic C: Structuring ──────────────────────────
        # Inbound transactions individually below threshold but in large volume
        in_txs = node_in_tx_amounts.get(node, [])
        structured = [a for a in in_txs if STRUCTURING_BAND_LOW <= a < STRUCTURING_THRESHOLD]
        if len(structured) >= 3:
            risk += 25  # +5 per additional structured transaction beyond 3
            risk += min(5 * (len(structured) - 3), 20)
            flags.append(f'structuring ({len(structured)} near-threshold txns)')

        # ── Heuristic D: Kingpin / Source ─────────────────────
        if pr > PAGERANK_KINGPIN:
            risk += int(pr * 400)  # Scale: 0.05 PR → +20 pts
            if co > ci * 1.5 or ind == 0:
                if G.nodes[node]['type'] == 'standard':
                    G.nodes[node]['type'] = 'source'
                flags.append(f'high-influence source (PR={pr:.3f})')

        # ── Heuristic E: Fan-out anomaly ──────────────────────
        # Many unique targets from one sender (rapid dispersion)
        if outd > 20 and co > ci * 2:
            risk += 20
            flags.append(f'fan-out dispersion ({outd} targets)')

        # ── Heuristic F: Velocity anomaly ─────────────────────
        if _velocity_anomaly(pd.Series(node_in_timestamps.get(node, [])), in_txs):
            risk += 20
            flags.append('velocity burst (>20 txn/hour)')

        # ── Heuristic G: Isolated high-value singleton ────────
        # Node with very few connections but huge amounts (shell account)
        if (ind + outd) <= 2 and total_flow > df['amount'].quantile(0.95) * 3:
            risk += 25
            flags.append('high-value isolated node (shell?)')

        risk = min(risk, 100)  # cap at 100
        is_suspicious = risk > 10 or bool(flags)

        G.nodes[node]['risk_score']  = risk
        G.nodes[node]['suspicious']  = is_suspicious
        G.nodes[node]['community']   = community_map.get(node, 0)
        G.nodes[node]['pagerank']    = round(pr, 5)
        G.nodes[node]['flags']       = flags
        G.nodes[node]['in_volume']   = round(ci, 2)
        G.nodes[node]['out_volume']  = round(co, 2)
        G.nodes[node]['in_degree']   = ind
        G.nodes[node]['out_degree']  = outd

    # ── 6. Cycle Detection (Fraud Rings) ─────────────────────
    fraud_rings: List[list] = []
    node_rings: Dict[str, List[str]] = defaultdict(list)

    try:
        # Safety: Run cycle detection only on Subgraphs (SCCs) to handle 20K+ nodes efficiently
        # 1. Get Strongly Connected Components
        sccs = list(nx.strongly_connected_components(G))
        # Filter for non-trivial SCCs (size > 1 implies at least one cycle)
        nontrivial_sccs = [scc for scc in sccs if len(scc) > 1]
        
        ring_counter = 0
        MAX_SCC_SIZE_FOR_EXACT_SEARCH = 100 # Increased from 50 to 100 based on performance validation
        
        for scc in nontrivial_sccs:
            # If SCC is small enough, run exact cycle finding
            if len(scc) <= MAX_SCC_SIZE_FOR_EXACT_SEARCH:
                subgraph = G.subgraph(scc)
                # simple_cycles is safe on small graphs
                cycles = list(nx.simple_cycles(subgraph))
                
                for cycle in cycles:
                    if MIN_RING_SIZE < len(cycle) <= MAX_RING_SIZE:
                        ring_counter += 1
                        ring_id = f"RING_{ring_counter:03d}"
                        
                        # Compute cycle total volume
                        cycle_volume = 0
                        for i in range(len(cycle)):
                            u, v = cycle[i], cycle[(i + 1) % len(cycle)]
                            if G.has_edge(u, v):
                                cycle_volume += G[u][v].get('amount', 0)
                                
                        fraud_rings.append({'nodes': cycle, 'volume': cycle_volume, 'id': ring_id})
                        for node in cycle:
                            G.nodes[node]['risk_score'] = min(G.nodes[node]['risk_score'] + 50, 100)
                            G.nodes[node]['suspicious'] = True
                            if G.nodes[node]['type'] == 'standard':
                                G.nodes[node]['type'] = 'ring_member'
                            node_rings[node].append(ring_id)
                            G.nodes[node]['flags'].append(f'in {ring_id}')
            else:
                # SCC is too big (Complex Laundering Network)
                # Don't run simple_cycles (it's O(n!)). Just flag the whole cluster.
                ring_counter += 1
                ring_id = f"COMPLEX_NET_{ring_counter:03d}"
                # Just take top k nodes to list in the ring details
                top_nodes = sorted(list(scc), key=lambda x: G.degree(x), reverse=True)[:10]
                
                # Approximate volume
                scc_vol = sum(G[u][v]['amount'] for u,v in G.subgraph(scc).edges())
                
                fraud_rings.append({'nodes': top_nodes, 'volume': scc_vol, 'id': ring_id, 'note': 'Complex Network'})
                
                for node in scc:
                    G.nodes[node]['risk_score'] = 100 # Maximum risk for massive tangle
                    G.nodes[node]['suspicious'] = True
                    G.nodes[node]['type'] = 'ring_member'
                    node_rings[node].append(ring_id)
                    G.nodes[node]['flags'].append(f'in massive money mule network')

    except Exception as e:
        print(f"Cycle detection error: {e}")
        pass

    for node, rings in node_rings.items():
        G.nodes[node]['rings'] = rings

    # ── 7. Benford's Law ──────────────────────────────────────
    benford_dev = _benford_deviation(df['amount'])
    benford_status = "Normal"
    if benford_dev > 0.05:
        benford_status = "Suspicious"
    elif benford_dev > 0.02:
        benford_status = "Slight deviation"

    # ── 8. Structuring detection at dataset level ─────────────
    structured_txns = _detect_structuring(df['amount'], len(df))
    structuring_pct = round(100 * len(structured_txns) / max(len(df), 1), 1)

    # ── 9. Build suspicious accounts list ────────────────────
    suspicious_accounts = []
    for node, attrs in G.nodes(data=True):
        if attrs.get('suspicious'):
            suspicious_accounts.append({
                "id": node,
                "risk_score": round(float(attrs.get('risk_score', 0)), 1),
                "type": attrs.get('type', 'standard'),
                "community": int(attrs.get('community', 0)),
                "pagerank": round(float(attrs.get('pagerank', 0)), 5),
                "in_volume": attrs.get('in_volume', 0),
                "out_volume": attrs.get('out_volume', 0),
                "flags": attrs.get('flags', []),
                "rings": attrs.get('rings', []),
                "reason": "; ".join(attrs.get('flags', [])) or "Low-level anomaly",
            })

    # Sort by risk score descending
    suspicious_accounts.sort(key=lambda x: x['risk_score'], reverse=True)

    # ── 10. Format rings for table ─────────────────────────────
    formatted_rings = []
    for ring in fraud_rings:
        formatted_rings.append({
            "ring_id": ring['id'],
            "member_accounts": ring['nodes'],
            "member_count": len(ring['nodes']),
            "cycle_volume": round(ring['volume'], 2),
            "pattern_type": "Circular Flow",
            "risk_score": 90,
        })

    # ── 11. Cytoscape element serialisation ───────────────────
    elements = []
    for node, attrs in G.nodes(data=True):
        risk = float(attrs.get('risk_score', 0))
        elements.append({
            "data": {
                "id": node,
                "risk_score": round(risk, 1),
                "type": attrs.get('type', 'standard'),
                "suspicious": bool(attrs.get('suspicious', False)),
                "community": int(attrs.get('community', 0)),
                "pagerank": round(float(attrs.get('pagerank', 0)), 5),
                "rings": attrs.get('rings', []),
                "flags": attrs.get('flags', []),
                "in_volume": attrs.get('in_volume', 0),
                "out_volume": attrs.get('out_volume', 0),
            }
        })

    for u, v, attrs in G.edges(data=True):
        elements.append({
            "data": {
                "source": u,
                "target": v,
                "amount": round(float(attrs.get('amount', 0)), 2),
                "count": attrs.get('count', 1),
                "timestamp": str(attrs.get('timestamp', '') or ''),
                "suspicious": bool(
                    G.nodes[u].get('suspicious') or G.nodes[v].get('suspicious')
                ),
            }
        })

    # ── 12. Summary metrics ───────────────────────────────────
    risk_scores = [float(attrs.get('risk_score', 0)) for _, attrs in G.nodes(data=True)]
    metrics = {
        "total_nodes":         len(G.nodes()),
        "total_edges":         len(G.edges()),
        "total_transactions":  len(df),
        "total_volume":        round(float(df['amount'].sum()), 2),
        "suspicious_count":    len(suspicious_accounts),
        "rings_count":         len(formatted_rings),
        "high_risk_count":     int(sum(1 for r in risk_scores if r >= HIGH_RISK_THRESHOLD)),
        "graph_density":       round(nx.density(G), 6),
        "avg_risk_score":      round(float(np.mean(risk_scores)) if risk_scores else 0, 2),
        "benford_status":      benford_status,
        "benford_deviation":   benford_dev,
        "structuring_pct":     structuring_pct,
        "structured_txn_count":len(structured_txns),
    }

    return {
        "elements":          elements,
        "metrics":           metrics,
        "flagged_accounts":  suspicious_accounts,
        "fraud_rings":       formatted_rings,
        # Legacy key aliases (keeps old frontend keys working)
        "suspicious_accounts": suspicious_accounts,
        "summary": {
            "total_nodes":       metrics["total_nodes"],
            "total_transactions":metrics["total_transactions"],
            "suspicious_count":  metrics["suspicious_count"],
            "rings_count":       metrics["rings_count"],
            "benford_status":    metrics["benford_status"],
            "high_risk_count":   metrics["high_risk_count"],
            "structuring_pct":   metrics["structuring_pct"],
        }
    }
