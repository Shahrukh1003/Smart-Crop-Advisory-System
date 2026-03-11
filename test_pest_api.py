import requests
import sys
import glob

def test_api():
    url = "http://localhost:8000/api/v1/pest-detection/analyze"
    images = glob.glob(r"C:\Users\shahr\.gemini\antigravity\brain\dd79f8a3-bbc6-4480-a861-8fbb2f30c5c3\*_sample_png_*.png")
    
    if not images:
        print("No test images found.")
        return
        
    for img_path in images:
        import os
        print(f"\n--- Testing Image: {os.path.basename(img_path)} ---")
        try:
            with open(img_path, "rb") as f:
                files = {"image": (os.path.basename(img_path), f, "image/png")}
                response = requests.post(url, files=files)
            
            if response.status_code == 200:
                data = response.json()
                print(f"Status: {response.status_code}")
                for det in data.get("detections", []):
                    print(f" - {det['pest_or_disease']} ({det['confidence']}) [Severity: {det['severity'].upper()}]")
            else:
                print(f"Error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_api()
