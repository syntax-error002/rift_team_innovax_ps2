# Digital Detective Engine (Algorithmic Edition)

**Money Muling Detection System**  
*Backend Logic & Graph Algorithms by [Your Name]*

## Overview

The **Digital Detective Engine** is a specialized fraud detection system designed to identify complex financial crimes like Money Muling, Smurfing, and Layering. 

Unlike traditional rule-based systems, this engine uses **Graph Theory (NetworkX)** to build a temporal transaction graph and detect structural anomalies within the data.

### 🧠 Core Backend Logic (The Brain)
The heart of this system is the `main.py` backend, which implements three sophisticated detection algorithms:

1.  **Fraud Rings (Cycle Detection)**
    *   **Algorithm**: DFS (Depth First Search) for simple cycles.
    *   **Logic**: Identifies closed loops of transactions (A → B → C → A) characteristic of round-tripping fraud.
    *   **Score Impact**: +50 Points (High Risk).

2.  **Smurfing (Star Patterns)**
    *   **Algorithm**: Degree Centrality Analysis.
    *   **Logic**: Detects "Fan-Out" (one detections sending to many) or "Fan-In" (many sources consolidating to one) behavior. 
    *   **Threshold**: >10 connections.
    *   **Score Impact**: +30 Points (Medium Risk).

3.  **Shell Accounts (Layering Chains)**
    *   **Algorithm**: Flow Balance Analysis.
    *   **Logic**: Identifies intermediate nodes that act as pass-throughs (Money In ≈ Money Out) with low total activity.
    *   **Score Impact**: +20 Points.

## Architecture

*   **Backend**: Python (FastAPI, NetworkX, Pandas). Handles all data processing, graph construction, and risk scoring.
*   **Frontend**: HTML/JS (Force-Graph). A visualization layer that consumes the JSON output from the backend.

## How to Run

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Start the Engine**:
    ```bash
    uvicorn main:app --reload
    ```
    *(Or run `start_engine.bat` on Windows)*

3.  **Access Dashboard**:
    Open `http://localhost:8000` in your browser.

## Testing
*   **Demo Mode**: Click "LOAD DEMO DATA" on the dashboard to see a pre-loaded fraud scenario.
*   **Custom CSV**: Upload any CSV with columns `sender_id`, `receiver_id`, `amount` to run the analysis.
