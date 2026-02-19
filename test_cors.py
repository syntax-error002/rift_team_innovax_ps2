import requests

def test_cors():
    url = "http://localhost:8000/analyze"
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    
    print(f"Sending OPTIONS request to {url}...")
    try:
        response = requests.options(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print("Headers:")
        for k, v in response.headers.items():
            if 'access-control' in k.lower():
                print(f"{k}: {v}")
                
        if response.status_code == 200 and 'access-control-allow-origin' in {k.lower(): v for k, v in response.headers.items()}:
             print("\nCORS Configuration: OK")
        else:
             print("\nCORS Configuration: POTENTIALLY BROKEN")
             
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_cors()
