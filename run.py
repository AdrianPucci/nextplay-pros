"""Start NextPlay Pros:  python run.py   then open http://127.0.0.1:8000   (python run.py --port 8010 for another port)"""
import argparse
import os

import uvicorn

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    p.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 to open it to phones on the same Wi-Fi")
    a = p.parse_args()
    port, host = a.port, a.host
    print(f"NextPlay Pros running at http://127.0.0.1:{port}  (Ctrl+C to stop)")
    uvicorn.run("app.main:app", host=host, port=port)
