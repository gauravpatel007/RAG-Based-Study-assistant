import urllib.request
import json
import os

os.environ['http_proxy'] = ''
os.environ['https_proxy'] = ''
os.environ['HTTP_PROXY'] = ''
os.environ['HTTPS_PROXY'] = ''

url = 'http://localhost:8000/api/v1/auth/register'
data = json.dumps({"username": "admin", "password": "admin"}).encode('utf-8')
headers = {'Content-Type': 'application/json', 'Origin': 'http://localhost:5169'}
req = urllib.request.Request(url, data=data, headers=headers)

try:
    with urllib.request.urlopen(req) as res:
        print("Success:", res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("Error:", e.read().decode('utf-8'))
