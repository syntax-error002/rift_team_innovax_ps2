import requests
import io

def reproduce_bad_amount():
    url = "http://localhost:8000/analyze"
    
    # CSV content with currency symbols and commas
    csv_content = """transaction_id,sender_id,receiver_id,amount,timestamp
TXN1,Alice,Bob,"$1,000.00",2026-02-19 10:00:00
TXN2,Bob,Charlie,"2,000.00",2026-02-19 11:00:00
"""
    files = {'file': ('bad_amount.csv', io.BytesIO(csv_content.encode('utf-8')), 'text/csv')}

    print(f"Sending request to {url} with dirty amount strings...")
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 500:
            print("500 Error Body:", response.text)
        elif response.status_code == 200:
             print("Success (Backend handled it)")
        else:
            print("Failed with other code.")
            print("Response:", response.text)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    reproduce_bad_amount()
