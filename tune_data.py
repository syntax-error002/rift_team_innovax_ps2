import pandas as pd
import os

input_file = 'transactions_3.csv'
temp_file = 'transactions_3_temp.csv'

if not os.path.exists(input_file):
    print(f"Error: {input_file} not found.")
    exit(1)

try:
    df = pd.read_csv(input_file)
    print(f"Read {len(df)} rows.")
except Exception as e:
    print(f"Error reading: {e}")
    exit(1)

# Check if already tuned to avoid double prefixing if run multiple times
if 'transaction_id' in df.columns:
    print("info: transaction_id already exists. Checking formatting...")
    # verifying column order
else:
    # 1. Generate transaction_id
    df['transaction_id'] = [f"TXN_{i+1:05d}" for i in range(len(df))]

# 2. Format sender_id and receiver_id
# We only format if they look like raw numbers (e.g. '4645') to avoid 'ACC_ACC_4645'
def format_id(val):
    s = str(val)
    if s.startswith('ACC_'):
        return s
    return f"ACC_{s}"

df['sender_id'] = df['sender_id'].apply(format_id)
df['receiver_id'] = df['receiver_id'].apply(format_id)

# 3. Columns Order
target_columns = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp']
# Filter to existing
cols_to_use = [c for c in target_columns if c in df.columns]
# If we have extra cols, append them? No, user wants specific format.
df_tuned = df[cols_to_use]

# Write to temp
df_tuned.to_csv(temp_file, index=False)
print("Wrote temp file.")

# Replace
try:
    os.replace(temp_file, input_file)
    print(f"Successfully overwrote {input_file} with tuned data.")
    print("Preview headers:", df_tuned.columns.tolist())
    print("Preview row 1:", df_tuned.iloc[0].tolist())
except OSError as e:
    print(f"Error overwriting file (maybe locked?): {e}")
    # Fallback: try copy content
    import shutil
    try:
        shutil.copyfile(temp_file, input_file)
        print("Overwrote using shutil.copyfile")
    except Exception as e2:
        print(f"Failed copyfile too: {e2}")
    
    if os.path.exists(temp_file):
        os.remove(temp_file)
