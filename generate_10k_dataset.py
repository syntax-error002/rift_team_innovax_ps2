import pandas as pd
import random
from datetime import datetime, timedelta

output_file = 'transactions_10k.csv'
TOTAL_TXNS = 10000
START_TIME = datetime(2026, 2, 18, 9, 0, 0)

# Helper to generate IDs
def get_user_id(idx):
    return f"ACC_MOCK_{idx}"

transactions = []

# --- 1. FRAUD PATTERNS (The "Interesting" Data) ---

# A. Structuring (Smurfing): Many small -> One Big
# We create 20 Structuring sets.
# Each set: 10-15 smurfs send ~2000-2900 to 1 Aggregator
for group_id in range(20):
    aggregator = f"ACC_STRUCT_AGG_{group_id}"
    num_smurfs = random.randint(10, 15)
    
    # Inflow
    for i in range(num_smurfs):
        smurf = f"ACC_SMURF_{group_id}_{i}"
        amt = random.uniform(2100, 2900) # < 3000 threshold
        transactions.append({
            "sender_id": smurf,
            "receiver_id": aggregator,
            "amount": round(amt, 2),
            "timestamp": START_TIME + timedelta(minutes=random.randint(0, 600))
        })
        
    # Outflow (Cashing out)
    # Aggregator sends large chunk to a Sink
    sink = f"ACC_SINK_STRUCT_{group_id}"
    total_in = 2500 * num_smurfs # approx
    out_amt = total_in * 0.95 # Keep 5%
    transactions.append({
        "sender_id": aggregator,
        "receiver_id": sink,
        "amount": round(out_amt, 2),
        "timestamp": START_TIME + timedelta(minutes=600 + random.randint(10, 60))
    })

# B. Mule Chains (Layering)
# 50 Chains: Source -> Mule -> Sink
# Mule receives > 1000, keeps < 10%
for chain_id in range(50):
    source = f"ACC_SOURCE_{chain_id}"
    mule = f"ACC_MULE_{chain_id}"
    sink = f"ACC_SINK_{chain_id}"
    
    amt = random.uniform(5000, 50000)
    
    # Leg 1: Source -> Mule
    t1 = START_TIME + timedelta(minutes=random.randint(100, 300))
    transactions.append({
        "sender_id": source,
        "receiver_id": mule,
        "amount": round(amt, 2),
        "timestamp": t1
    })
    
    # Leg 2: Mule -> Sink (Quick transfer, low retention)
    amt_forward = amt * random.uniform(0.92, 0.98) # Keep 2-8%
    t2 = t1 + timedelta(minutes=random.randint(5, 120))
    transactions.append({
        "sender_id": mule,
        "receiver_id": sink,
        "amount": round(amt_forward, 2),
        "timestamp": t2
    })

# C. Fraud Rings (Cycles)
# 10 Rings of 3-5 members
for ring_id in range(10):
    ring_size = random.randint(3, 5)
    members = [f"ACC_RING_{ring_id}_{m}" for m in range(ring_size)]
    base_amt = random.uniform(10000, 20000)
    
    for i in range(ring_size):
        sender = members[i]
        receiver = members[(i + 1) % ring_size] # Circular
        
        # Add some noise to amount so it's not identical
        amt = base_amt * random.uniform(0.98, 1.02)
        
        transactions.append({
            "sender_id": sender,
            "receiver_id": receiver,
            "amount": round(amt, 2),
            "timestamp": START_TIME + timedelta(minutes=random.randint(0, 1000))
        })

# D. Fan-Out (Payroll/Distribution or "Kingpin")
# One Source -> Many Targets
# 5 Kingpins
for pid in range(5):
    kingpin = f"ACC_KINGPIN_{pid}"
    num_receivers = random.randint(20, 50)
    for i in range(num_receivers):
        target = f"ACC_DROP_{pid}_{i}"
        amt = random.uniform(500, 2000)
        transactions.append({
            "sender_id": kingpin,
            "receiver_id": target,
            "amount": round(amt, 2),
            "timestamp": START_TIME + timedelta(minutes=random.randint(0, 1000))
        })

# --- 2. NORMAL TRAFFIC (Background Noise) ---
# Fill the rest to reach 10k
current_count = len(transactions)
remaining = TOTAL_TXNS - current_count

# Pool of normal users (re-use to create density)
normal_users = [f"ACC_USER_{i}" for i in range(2000)] # 2000 users for 9k txns = avg 4.5 txns per user

# Merchants/Services
merchants = ["ACC_AMAZON", "ACC_WALMART", "ACC_UBER", "ACC_NETFLIX", "ACC_STARBUCKS", "ACC_TARGET"]

for _ in range(remaining):
    # Determine type of txn
    rand_val = random.random()
    
    if rand_val < 0.6: 
        # P2M (Person to Merchant)
        sender = random.choice(normal_users)
        receiver = random.choice(merchants)
        amt = random.uniform(10, 500)
    elif rand_val < 0.9:
        # P2P (Person to Person)
        sender = random.choice(normal_users)
        receiver = random.choice(normal_users)
        while receiver == sender: receiver = random.choice(normal_users)
        amt = random.uniform(20, 1000)
    else:
        # Salary/Income (Merchant to Person)
        sender = "ACC_CORP_PAYROLL_" + str(random.randint(1, 5))
        receiver = random.choice(normal_users)
        amt = random.uniform(2000, 5000)

    transactions.append({
        "sender_id": sender,
        "receiver_id": receiver,
        "amount": round(amt, 2),
        "timestamp": START_TIME + timedelta(minutes=random.randint(0, 1440)) # 24h window
    })

# Convert to DF
df = pd.DataFrame(transactions)

# Add Transaction IDs
df['transaction_id'] = [f"TXN_{i+1:05d}" for i in range(len(df))]

# Reorder columns
df = df[['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp']]

# Shuffle rows so patterns aren't contiguous blocks
df = df.sample(frac=1).reset_index(drop=True)

# Save
try:
    df.to_csv(output_file, index=False)
    print(f"Successfully generated {len(df)} transactions to {output_file}")
    print("Patterns included: Structuring, Mule Chains, Fraud Rings, Kingpin Fan-outs, Normal Traffic")
except Exception as e:
    print(f"Error saving: {e}")
