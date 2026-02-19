# RIFT Financial Forensics Engine 🛡️

> **Advanced Graph-Based Money Muling Detection System**  
> A sophisticated web application for detecting financial crime patterns, fraud rings, and money laundering networks using graph theory and machine learning techniques.

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)](https://fastapi.tiangolo.com/)
[![NetworkX](https://img.shields.io/badge/NetworkX-Latest-blue)](https://networkx.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## 🎯 Project Overview

The **RIFT Financial Forensics Engine** is a comprehensive solution for detecting sophisticated money muling networks, fraud rings, and financial crime patterns. Built for the RIFT 2026 Hackathon, this system processes transaction data to identify:

- **Circular Fund Routing** (Cycles)
- **Smurfing Patterns** (Fan-in/Fan-out)
- **Layered Shell Networks**
- **Structuring Patterns**
- **Velocity Anomalies**
- **Benford's Law Violations**

---

## ✨ Key Features

### 🎨 **Professional UI/UX**
- **Modern Dashboard** with real-time analytics
- **Interactive Graph Visualization** using Cytoscape.js
- **Comprehensive Analytics Dashboard** with charts and metrics
- **Multiple Export Formats** (JSON, CSV, PDF, PNG)
- **Pattern Explanation System** for educational insights
- **Dark/Light Theme Support** with 5 customizable themes
- **Responsive Design** for all screen sizes

### 🔍 **Advanced Detection Algorithms**
- **Graph-Based Analysis** using NetworkX
- **Cycle Detection** (3-5 node cycles)
- **Community Detection** (Louvain algorithm)
- **PageRank Analysis** for identifying key nodes
- **Temporal Analysis** for rapid transaction detection
- **Benford's Law** compliance checking
- **Structuring Detection** (below-threshold transactions)

### 📊 **Analytics & Reporting**
- **Risk Score Distribution** charts
- **Pattern Type Analysis** with pie charts
- **Fraud Ring Comparison** visualizations
- **Top Risk Accounts** ranking
- **Real-time Processing Metrics**
- **Exportable Reports** in multiple formats

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │   Analytics  │  │   Graph View  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Export Panel │  │ Pattern Info │  │ Results Table │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ CSV Parser   │  │ Graph Builder │  │   Detection  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Cycle Det.  │  │  PageRank    │  │  Community   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **pip** (Python package manager)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/rift-hackathon.git
cd rift-hackathon
```

#### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

#### 3. Frontend Setup

```bash
cd frontend
npm install
```

### Running the Application

#### Start Backend Server

```bash
cd backend
python main.py
# Server runs on http://localhost:8000
```

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
# Application runs on http://localhost:3000
```

---

## 📖 Usage Guide

### 1. Upload Transaction Data

- Navigate to the homepage
- Click "Upload Transaction CSV" or drag & drop a CSV file
- Ensure your CSV has the following columns:
  - `transaction_id` (String)
  - `sender_id` (String)
  - `receiver_id` (String)
  - `amount` (Float)
  - `timestamp` (DateTime: YYYY-MM-DD HH:MM:SS)

### 2. View Analysis Results

The dashboard provides four main views:

#### **Network Graph Tab**
- Interactive visualization of transaction networks
- Color-coded nodes by risk level
- Click nodes to see detailed information
- Filter by risk score and suspicious status

#### **Analytics Tab**
- Risk score distribution charts
- Pattern type analysis
- Fraud ring comparisons
- Top risk accounts visualization

#### **Detection Log Tab**
- Detailed list of suspicious accounts
- Fraud ring information
- Search and filter capabilities

#### **Export Tab**
- Download results in JSON, CSV, PDF, or PNG formats
- Export summary statistics

### 3. Understanding Results

#### Suspicion Score Methodology

The system calculates risk scores (0-100) based on multiple factors:

- **Circular Flow Detection** (95 points): Accounts involved in money cycles
- **Fan-In Aggregation** (60-85 points): Multiple sources → single destination
- **Fan-Out Dispersion** (60 points): Single source → multiple destinations
- **Shell Account** (75 points): Low-degree pass-through accounts
- **Velocity Anomaly** (20 points): Rapid transaction bursts
- **Structuring** (25-45 points): Below-threshold transaction patterns

#### Pattern Types

- **ring_member**: Part of a detected fraud ring
- **aggregator**: Collects funds from multiple sources
- **source**: High-influence originator node
- **mule**: Money mule account (pass-through)
- **shell_account**: Layering account

---

## 🔬 Algorithm Approach

### Graph Construction

1. **Directed Graph Creation**: Transactions become directed edges
2. **Node Attributes**: In-degree, out-degree, volume metrics
3. **Edge Attributes**: Amount, timestamp, transaction count

### Detection Patterns

#### 1. Cycle Detection
- Uses NetworkX `simple_cycles()` on Strongly Connected Components (SCCs)
- Detects cycles of length 3-5 nodes
- All cycle members flagged as fraud ring participants

#### 2. Smurfing Detection
- **Fan-In**: ≥10 incoming edges within 72-hour window
- **Fan-Out**: ≥10 outgoing edges
- Temporal analysis for rapid aggregation/dispersion

#### 3. Shell Account Detection
- Low degree (1-3 in/out edges)
- High volume pass-through (>90% retention ratio)
- Minimal net balance retention

#### 4. PageRank Analysis
- Identifies high-influence nodes (kingpins)
- Threshold: PageRank > 0.04
- Used to flag source/orchestrator accounts

#### 5. Community Detection
- Louvain algorithm for community identification
- Groups related accounts
- Helps identify coordinated networks

### Complexity Analysis

- **Graph Construction**: O(E) where E = number of edges
- **Cycle Detection**: O(V + E) per SCC, worst-case O(V!)
- **PageRank**: O(V + E) per iteration
- **Community Detection**: O(V log V) for Louvain
- **Overall**: O(V + E) for most operations, optimized for 10K+ transactions

---

## 📊 Performance Metrics

- **Processing Time**: ≤ 30 seconds for 10K transactions
- **Precision Target**: ≥ 70% (minimize false positives)
- **Recall Target**: ≥ 60% (catch most fraud rings)
- **False Positive Control**: Filters legitimate merchants/payroll accounts

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Cytoscape.js** - Graph visualization
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Radix UI** - Component primitives

### Backend
- **FastAPI** - Python web framework
- **NetworkX** - Graph analysis
- **Pandas** - Data processing
- **NumPy** - Numerical computations
- **Uvicorn** - ASGI server

---

## 📁 Project Structure

```
rift-hackathon/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── logic.py             # Advanced detection algorithms
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Main dashboard
│   │   │   └── layout.tsx   # Root layout
│   │   └── components/
│   │       ├── GraphView.tsx           # Graph visualization
│   │       ├── AnalyticsDashboard.tsx # Analytics charts
│   │       ├── ResultsTable.tsx       # Results display
│   │       ├── ExportPanel.tsx         # Export functionality
│   │       └── PatternExplainer.tsx   # Pattern explanations
│   └── package.json
└── README.md
```

---

## 🎓 Known Limitations

1. **Large Dataset Handling**: Very large graphs (>50K nodes) may require sampling
2. **Cycle Detection**: Exact cycle enumeration is computationally expensive for large SCCs
3. **False Positives**: High-volume legitimate merchants may trigger alerts
4. **Temporal Analysis**: Requires accurate timestamp data for optimal results
5. **Pattern Overlap**: Accounts may be flagged for multiple patterns simultaneously

---

## 🔮 Future Enhancements

- [ ] Machine Learning-based risk scoring
- [ ] Real-time transaction monitoring
- [ ] Historical trend analysis
- [ ] Multi-currency support
- [ ] Advanced graph layouts (force-directed, hierarchical)
- [ ] API rate limiting and authentication
- [ ] Database integration for historical data
- [ ] Alert system for new detections

---

## 👥 Team Members

- **Your Name** - Full Stack Developer
- **Team Member 2** - Backend Engineer
- **Team Member 3** - Frontend Developer

---

## 📝 License

This project is developed for the RIFT 2026 Hackathon.

---

## 🙏 Acknowledgments

- RIFT 2026 Organizing Team
- NetworkX community
- Next.js and FastAPI communities

---

## 🔗 Links

- **Live Demo**: [Your Deployment URL]
- **GitHub Repository**: [Your GitHub URL]
- **LinkedIn Video**: [Your LinkedIn Post URL]

---

**Built with ❤️ for RIFT 2026 Hackathon**

