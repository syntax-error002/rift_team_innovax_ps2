import pandas as pd
import random
from datetime import datetime, timedelta
import uuid

def generate_peak_data(num_transactions=500):
    data = []
    base_time = datetime(2026, 2, 18, 9, 0, 0)
    
    # 1. STRUCTURING (Smurfing) SCENARIO
    # "Aggregator" receives many small payments just below $10k
    aggregator = "AGGREGATOR_KING"
    for i in range(20):
        sender = f"STRUCT_MULE_{i}"
        amount = random.uniform(9000, 9900) # Just below $10k reporting threshold
        time_offset = timedelta(minutes=random.randint(0, 60))
        data.append({
            "transaction_id": f"TXN_STRUCT_{i}",
            "sender_id": sender,
            "receiver_id": aggregator,
            "amount": round(amount, 2),
            "timestamp": (base_time + time_offset).strftime("%Y-%m-%d %H:%M:%S")
        })

    # 2. FRAUD RING (Cycle)
    # A -> B -> C -> D -> E -> A
    ring_members = ["RING_A", "RING_B", "RING_C", "RING_D", "RING_E"]
    ring_amount = 50000.00
    for i in range(len(ring_members)):
        sender = ring_members[i]
        receiver = ring_members[(i + 1) % len(ring_members)]
        time_offset = timedelta(minutes=60 + (i * 10))
        data.append({
            "transaction_id": f"TXN_RING_{i}",
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": ring_amount,
            "timestamp": (base_time + time_offset).strftime("%Y-%m-%d %H:%M:%S")
        })

    # 3. FAN-OUT (Payroll or Disbursement Layering)
    # One source sending to many sinks
    source = "UNKNOWN_SOURCE"
    for i in range(15):
        receiver = f"LAYER_MULE_{i}"
        amount = random.uniform(2000, 4000)
        time_offset = timedelta(minutes=120 + i)
        data.append({
            "transaction_id": f"TXN_FANOUT_{i}",
            "sender_id": source,
            "receiver_id": receiver,
            "amount": round(amount, 2),
            "timestamp": (base_time + time_offset).strftime("%Y-%m-%d %H:%M:%S")
        })

    # 4. RANDOM BACKGROUND NOISE (Normal traffic)
    # To test graph density and noise filtering
    merchants = ["AMAZON", "UBER", "WALMART", "STARBUCKS", "NETFLIX"]
    users = [f"USER_{i}" for i in range(50)]
    
    for i in range(num_transactions - len(data)):
        sender = random.choice(users)
        receiver = random.choice(merchants if random.random() > 0.3 else users)
        if sender == receiver: continue
        
        amount = random.uniform(10, 500)
        time_offset = timedelta(minutes=random.randint(0, 480)) # 8 hours spread
        
        data.append({
            "transaction_id": f"TXN_NORM_{i}",
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": round(amount, 2),
            "timestamp": (base_time + time_offset).strftime("%Y-%m-%d %H:%M:%S")
        })

    # Create DataFrame and sort by time
    df = pd.DataFrame(data)
    df = df.sort_values(by="timestamp")
    
    # Save to CSV
    output_path = "peak_test_data.csv"
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} transactions in {output_path}")

if __name__ == "__main__":
    generate_peak_data()
