import requests

def test_upload():
    url = "http://localhost:8000/analyze"
    files = {'file': open('mixed_test_data.csv', 'rb')}
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success! Backend is working.")
            print("Response Keys:", response.json().keys())
        else:
            print("Failed.")
            print("Response:", response.text)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_upload()
