"""Start Next Play:  python run.py   then open http://127.0.0.1:8000   (python run.py --port 8010 for another port)"""
import argparse
import os

import uvicorn

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    port = p.parse_args().port
    print(f"Next Play running at http://127.0.0.1:{port}  (Ctrl+C to stop)")
    uvicorn.run("app.main:app", host="127.0.0.1", port=port)
