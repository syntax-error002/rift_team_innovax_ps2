import requests

def test_proxy():
    # Test the Next.js Proxy URL (Port 3000)
    url = "http://localhost:3000/api/analyze"
    files = {'file': open('mixed_test_data.csv', 'rb')}
    
    print(f"Sending request to PROXY {url}...")
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success! Proxy is working.")
        else:
            print("Failed.")
            print("Response:", response.text[:200])
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_proxy()
