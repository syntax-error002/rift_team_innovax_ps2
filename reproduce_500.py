import requests

def reproduce_500():
    url = "http://localhost:8000/analyze"
    # Try with peak_test_data.csv which might be causing the crash
    try:
        files = {'file': open('peak_test_data.csv', 'rb')}
    except FileNotFoundError:
        print("peak_test_data.csv not found, trying mixed_test_data.csv")
        files = {'file': open('mixed_test_data.csv', 'rb')}

    print(f"Sending request to {url} with {files['file'].name}...")
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success! Backend handled it.")
        else:
            print("Failed.")
            print("Response:", response.text)
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    reproduce_500()
