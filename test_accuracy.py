import pandas as pd
from backend.logic import analyze_transactions
import time

def verify_accuracy():
    print("Loading 10k dataset...")
    try:
        df = pd.read_csv('transactions_10k.csv')
    except FileNotFoundError:
        print("Dataset not found.")
        return

    # Preprocessing
    df = df.rename(columns={'sender_id': 'source', 'receiver_id': 'target'})
    if 'amount' in df.columns and df['amount'].dtype == 'object':
        df['amount'] = df['amount'].astype(str).str.replace(r'[$,\s]', '', regex=True)
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)

    print("Running analysis...")
    start_time = time.time()
    result = analyze_transactions(df)
    duration = time.time() - start_time
    
    metrics = result['metrics']
    flagged = result['flagged_accounts']
    rings = result['fraud_rings']
    
    print("-" * 30)
    print(f"Time Taken: {duration:.2f}s")
    print("-" * 30)
    
    # Ground Truth Expectations (from generate_10k_dataset.py)
    EXPECTED_RINGS = 10
    EXPECTED_KINGPINS = 5
    EXPECTED_STRUCTURING_GROUPS = 20
    
    print(f"Rings Detected: {metrics['rings_count']} (Expected ~{EXPECTED_RINGS})")
    
    # Count specific detected types
    detected_types = {}
    for acc in flagged:
        t = acc['type']
        detected_types[t] = detected_types.get(t, 0) + 1
        
    print("Detected Account Types:")
    for t, count in detected_types.items():
        print(f"  - {t}: {count}")

    # Check for specific known patterns from the generator code logic
    # We can check if "ACC_KINGPIN_0" is in the flagged list
    kingpins_found = 0
    for i in range(5):
        kp_id = f"ACC_KINGPIN_{i}"
        found = any(a['id'] == kp_id for a in flagged)
        if found: kingpins_found += 1
        
    print(f"Kingpins Identified: {kingpins_found}/5")
    
    pass_rings = metrics['rings_count'] >= EXPECTED_RINGS
    pass_kp = kingpins_found >= 4
    
    if pass_rings and pass_kp:
         print("\nSUCCESS: High Accuracy Detected!")
    else:
         print("\nWARNING: Accuracy may need tuning.")

if __name__ == "__main__":
    verify_accuracy()
