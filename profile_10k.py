import pandas as pd
import time
import cProfile
import pstats
from backend.logic import analyze_transactions

def profile_run():
    print("Loading 10k dataset...")
    try:
        df = pd.read_csv('transactions_10k.csv')
    except FileNotFoundError:
        print("transactions_10k.csv not found. Please run generate_10k_dataset.py first.")
        return

    print(f"Loaded {len(df)} transactions.")
    
    # Preprocessing to match main.py
    df = df.rename(columns={'sender_id': 'source', 'receiver_id': 'target'})
    if 'amount' in df.columns:
        if df['amount'].dtype == 'object':
            df['amount'] = df['amount'].astype(str).str.replace(r'[$,\s]', '', regex=True)
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)

    print("Starting analysis...")
    start_time = time.time()
    
    # Run analysis
    result = analyze_transactions(df)
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"Analysis completed in {duration:.4f} seconds.")
    print(f"Nodes: {result['metrics']['total_nodes']}")
    print(f"Edges: {result['metrics']['total_edges']}")
    print(f"Rings found: {result['metrics']['rings_count']}")
    
    if duration > 30:
        print("FAIL: Duration > 30s")
    else:
        print("PASS: Duration <= 30s")

if __name__ == "__main__":
    profile_run()
