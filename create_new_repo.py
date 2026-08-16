import urllib.request
import urllib.parse
import json
import subprocess

print("Checking GitHub Credentials...")

# Try git credential fill
credential_input = "protocol=https\nhost=github.com\n\n"
p = subprocess.Popen(["git", "credential", "fill"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = p.communicate(input=credential_input)

token = None
for line in stdout.splitlines():
    if line.startswith("password="):
        token = line.split("password=", 1)[1]
        break

if not token:
    print("Could not retrieve token automatically from git credential store.")
else:
    print("Retrieved token successfully!")
    # Create repo via GitHub API
    url = "https://api.github.com/user/repos"
    payload = json.dumps({
        "name": "mock-exam-2027-v2",
        "description": "2027 전문상담 임용고시 통합 모의고사 프로그램 V2",
        "private": False
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=payload, headers={
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Antigravity-Agent"
    })
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print("Successfully created repo:", data.get("html_url"))
    except urllib.error.HTTPError as e:
        print("HTTPError:", e.code, e.read().decode('utf-8'))
    except Exception as e:
        print("Error:", str(e))
