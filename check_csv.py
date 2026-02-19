import requests
import json

url = "http://127.0.0.1:8000/analyze"
filename = "suspicious_activity.csv"

try:
    print(f"Uploading {filename}...")
    with open(filename, 'rb') as f:
        files = {'file': f}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        data = response.json()
        print("\n--- ANALYSIS RESULT ---")
        
        # Print Explanation from Backend
        print(data['explainable_report'].replace("<br>", "\n").replace("<h3>", "\n").replace("</h3>", "").replace("<h4>", "\n").replace("</h4>", "").replace("<p>", "").replace("</p>", "").replace("<ul>", "").replace("</ul>", "").replace("<li>", "- ").replace("</li>", "").replace("<strong>", "").replace("</strong>", "").replace("<em>", "").replace("</em>", "").replace("<hr>", "\n-------------------\n"))
        
    else:
        print(f"Error: {response.status_code} - {response.text}")

except Exception as e:
    print(f"Failed to run check: {e}")
