import pandas as pd
import random
from datetime import datetime, timedelta

def generate_mixed_data():
    data = []
    base_time = datetime(2026, 2, 19, 10, 0, 0)
    
    # --- PATTERN 1: The "Spider Web" (Smurfing + Layering) ---
    # Smart Mule -> 5 Layering Accounts -> 1 Aggregator
    source = "SPIDER_SOURCE"
    aggregator = "SPIDER_BOSS"
    layers = [f"LAYER_{i}" for i in range(1, 6)]
    
    # Phase 1: Fan-out from Source
    for i, layer in enumerate(layers):
        data.append({
            "transaction_id": f"TXN_WEB_1_{i}",
            "sender_id": source,
            "receiver_id": layer,
            "amount": 2000.00,
            "timestamp": (base_time + timedelta(minutes=i*5)).strftime("%Y-%m-%d %H:%M:%S")
        })
        
        # Phase 2: Fan-in to Aggregator (Structuring)
        data.append({
            "transaction_id": f"TXN_WEB_2_{i}",
            "sender_id": layer,
            "receiver_id": aggregator,
            "amount": 1950.00, # Slightly less
            "timestamp": (base_time + timedelta(minutes=30 + i*5)).strftime("%Y-%m-%d %H:%M:%S")
        })

    # --- PATTERN 2: The "Triangle of Death" (Cycle) ---
    # A tight, high-value loop
    data.append({"transaction_id": "TXN_CYC_1", "sender_id": "CARTEL_A", "receiver_id": "CARTEL_B", "amount": 50000, "timestamp": (base_time + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")})
    data.append({"transaction_id": "TXN_CYC_2", "sender_id": "CARTEL_B", "receiver_id": "CARTEL_C", "amount": 48000, "timestamp": (base_time + timedelta(minutes=20)).strftime("%Y-%m-%d %H:%M:%S")})
    data.append({"transaction_id": "TXN_CYC_3", "sender_id": "CARTEL_C", "receiver_id": "CARTEL_A", "amount": 45000, "timestamp": (base_time + timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")})

    # --- PATTERN 3: "Noise" (Normal People) ---
    # Just to show the contrast
    innocents = ["Alice", "Bob", "Charlie", "David", "Eve", "Shop_X", "Shop_Y"]
    for i in range(10):
        sender = random.choice(innocents)
        receiver = random.choice(innocents)
        if sender == receiver: continue
        data.append({
            "transaction_id": f"TXN_NORM_{i}",
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": round(random.uniform(50, 500), 2),
            "timestamp": (base_time + timedelta(minutes=random.randint(0, 120))).strftime("%Y-%m-%d %H:%M:%S")
        })

    # --- INTERACTION: Contamination ---
    # One innocent person accidentally pays a fraudster (False Positive risk or legitimate commerce?)
    data.append({
        "transaction_id": "TXN_RISK_1", 
        "sender_id": "Alice", 
        "receiver_id": "LAYER_1", 
        "amount": 100.00, 
        "timestamp": (base_time + timedelta(minutes=60)).strftime("%Y-%m-%d %H:%M:%S")
    })

    df = pd.DataFrame(data)
    df = df.sort_values(by="timestamp")
    
    output_path = "mixed_test_data.csv"
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} heterogeneous transactions in {output_path}")

if __name__ == "__main__":
    generate_mixed_data()
