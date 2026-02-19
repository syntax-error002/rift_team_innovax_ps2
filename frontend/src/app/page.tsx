'use client';

import { Download, RefreshCw, ShieldAlert, PlayCircle, Activity, Search, BarChart3, FileText, Info, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { GraphView } from '@/components/GraphView';
import { ResultsTable } from '@/components/ResultsTable';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { ExportPanel } from '@/components/ExportPanel';
import { PatternExplainer } from '@/components/PatternExplainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SuspiciousAccount = {
  account_id: string;
  suspicion_score: number;
  detected_patterns: string[];
  ring_id: string;
  community?: number;
  pagerank?: number;
};

type FraudRing = {
  ring_id: string;
  member_accounts: string[];
  pattern_type: string;
  risk_score: number;
};

type HackathonSummary = {
  total_accounts_analyzed: number;
  suspicious_accounts_flagged: number;
  fraud_rings_detected: number;
  processing_time_seconds: number;
  // Internal-only convenience for UX; not exported in hackathon JSON
  total_transactions?: number;
  graph_density?: number;
  benford_status?: string;
};

type HackathonResults = {
  summary: HackathonSummary;
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
};

// Enhanced Mock Data for "Real Feel" – already in final JSON shape
const ENHANCED_MOCK_RESULTS: HackathonResults = {
  summary: {
    total_accounts_analyzed: 1542,
    suspicious_accounts_flagged: 24,
    fraud_rings_detected: 5,
    processing_time_seconds: 2.15,
    total_transactions: 7500,
    graph_density: 0.012,
    benford_status: 'Normal',
  },
  suspicious_accounts: [
    { account_id: 'ACC_8821', suspicion_score: 98.5, detected_patterns: ['cycle', 'high_fan_out'], ring_id: 'RING_01' },
    { account_id: 'ACC_STAR', suspicion_score: 95.0, detected_patterns: ['fan_out_source'], ring_id: 'RING_03' },
    { account_id: 'ACC_9912', suspicion_score: 88.0, detected_patterns: ['cycle', 'rapid_movement'], ring_id: 'RING_01' },
    { account_id: 'ACC_1102', suspicion_score: 82.3, detected_patterns: ['shell_node'], ring_id: 'RING_02' },
    { account_id: 'ACC_7731', suspicion_score: 76.5, detected_patterns: ['cycle'], ring_id: 'RING_01' },
    { account_id: 'ACC_MULE_1', suspicion_score: 91.2, detected_patterns: ['fan_in_sink'], ring_id: 'RING_04' },
    { account_id: 'ACC_MULE_2', suspicion_score: 89.4, detected_patterns: ['fan_in_sink'], ring_id: 'RING_04' },
  ],
  fraud_rings: [
    { ring_id: 'RING_01', member_accounts: ['ACC_8821', 'ACC_9912', 'ACC_7731'], pattern_type: 'Money Cycle', risk_score: 98.2 },
    { ring_id: 'RING_02', member_accounts: ['ACC_1102', 'ACC_2203', 'ACC_3304', 'ACC_4405', 'ACC_5506'], pattern_type: 'Layered Shell Network', risk_score: 85.5 },
    { ring_id: 'RING_03', member_accounts: ['ACC_STAR', 'ACC_S1', 'ACC_S2', 'ACC_S3', 'ACC_S4', 'ACC_S5'], pattern_type: 'Smurfing (Fan-Out)', risk_score: 91.0 },
    { ring_id: 'RING_04', member_accounts: ['ACC_MULE_1', 'ACC_MULE_2', 'ACC_SRC_1', 'ACC_SRC_2', 'ACC_SRC_3'], pattern_type: 'Smurfing (Fan-In)', risk_score: 88.7 },
  ]
};

// More complex graph structure
const ENHANCED_GRAPH_ELEMENTS = [
  // --- RING 1: The Cycle (Red Cluster) ---
  { data: { id: 'ACC_8821', suspicious: true, risk_score: 98, type: 'source' } },
  { data: { id: 'ACC_9912', suspicious: true, risk_score: 88, type: 'mule' } },
  { data: { id: 'ACC_7731', suspicious: true, risk_score: 76, type: 'mule' } },
  { data: { source: 'ACC_8821', target: 'ACC_9912', amount: '$50,000' } },
  { data: { source: 'ACC_9912', target: 'ACC_7731', amount: '$48,500' } },
  { data: { source: 'ACC_7731', target: 'ACC_8821', amount: '$45,000' } }, // Cycle closure

  // --- RING 2: Shell Layering (Long Chain) ---
  { data: { id: 'ACC_1102', suspicious: true, risk_score: 82, type: 'layer' } },
  { data: { id: 'ACC_2203', suspicious: true, risk_score: 72, type: 'layer' } },
  { data: { id: 'ACC_3304', suspicious: true, risk_score: 68, type: 'layer' } },
  { data: { id: 'ACC_4405', suspicious: true, risk_score: 65, type: 'layer' } },
  { data: { id: 'ACC_5506', suspicious: true, risk_score: 60, type: 'sink' } },
  { data: { source: 'ACC_1102', target: 'ACC_2203', amount: '$10,000' } },
  { data: { source: 'ACC_2203', target: 'ACC_3304', amount: '$9,800' } },
  { data: { source: 'ACC_3304', target: 'ACC_4405', amount: '$9,600' } },
  { data: { source: 'ACC_4405', target: 'ACC_5506', amount: '$9,500' } },

  // --- RING 3: Fan-Out Smurfing (Star Pattern) ---
  { data: { id: 'ACC_STAR', suspicious: true, risk_score: 95, type: 'source' } },
  { data: { id: 'ACC_S1', suspicious: true, risk_score: 60, type: 'mule' } },
  { data: { id: 'ACC_S2', suspicious: true, risk_score: 60, type: 'mule' } },
  { data: { id: 'ACC_S3', suspicious: true, risk_score: 60, type: 'mule' } },
  { data: { id: 'ACC_S4', suspicious: true, risk_score: 60, type: 'mule' } },
  { data: { id: 'ACC_S5', suspicious: true, risk_score: 60, type: 'mule' } },
  { data: { source: 'ACC_STAR', target: 'ACC_S1', amount: '$2,000' } },
  { data: { source: 'ACC_STAR', target: 'ACC_S2', amount: '$2,000' } },
  { data: { source: 'ACC_STAR', target: 'ACC_S3', amount: '$2,000' } },
  { data: { source: 'ACC_STAR', target: 'ACC_S4', amount: '$2,000' } },
  { data: { source: 'ACC_STAR', target: 'ACC_S5', amount: '$2,000' } },

  // --- Normal High-Traffic Nodes (Context) ---
  { data: { id: 'MERCHANT_A', suspicious: false, type: 'merchant' } },
  { data: { id: 'MERCHANT_B', suspicious: false, type: 'merchant' } },
  { data: { id: 'PAYROLL_X', suspicious: false, type: 'payroll' } },
  { data: { source: 'PAYROLL_X', target: 'ACC_1001', amount: '$3,500' } },
  { data: { source: 'PAYROLL_X', target: 'ACC_1002', amount: '$3,500' } },
  { data: { source: 'ACC_1001', target: 'MERCHANT_A', amount: '$120' } },
  { data: { source: 'ACC_1002', target: 'MERCHANT_B', amount: '$85' } },

  // --- Connecting suspicious to normal (Interactions) ---
  { data: { source: 'ACC_S1', target: 'MERCHANT_A', amount: '$500' } },
  { data: { source: 'ACC_S2', target: 'MERCHANT_B', amount: '$200' } },
];

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<HackathonResults | null>(null);
  const [graphElements, setGraphElements] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [minRisk, setMinRisk] = useState<number>(0);
  const [showSuspiciousOnly, setShowSuspiciousOnly] = useState<boolean>(false);
  const [selectedPattern, setSelectedPattern] = useState<{pattern: string, accountId?: string, score?: number} | null>(null);
  const [activeTab, setActiveTab] = useState('graph');

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setResults(null);
    setGraphElements([]);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      // Use relative path to leverage Next.js proxy (works for both localhost and tunnel)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {
          // ignore json parse error
        }
        throw new Error(`Server Error (${response.status}): ${errorMsg}`);
      }

      const data = await response.json();

      // Build helper map from account_id -> ring_id for JSON/rings alignment
      const ringByAccount = new Map<string, string>();
      (data.fraud_rings as any[] | undefined)?.forEach((ring: any) => {
        (ring.member_accounts as string[]).forEach((id) => {
          if (!ringByAccount.has(id)) {
            ringByAccount.set(id, ring.ring_id as string);
          }
        });
      });

      const suspicious_accounts: SuspiciousAccount[] = (data.flagged_accounts as any[])
        .map((acc: any) => ({
          account_id: acc.id as string,
          suspicion_score: Number(acc.risk_score) || 0,
          detected_patterns: [String(acc.type || 'unknown')],
          ring_id: ringByAccount.get(acc.id as string) ?? 'NONE',
          community: acc.community,
          pagerank: acc.pagerank,
        }))
        .sort((a, b) => b.suspicion_score - a.suspicion_score);

      const summary: HackathonSummary = {
        total_accounts_analyzed: data.metrics.total_accounts_analyzed ?? data.metrics.total_transactions,
        suspicious_accounts_flagged: data.metrics.suspicious_accounts_flagged ?? data.metrics.suspicious_count,
        fraud_rings_detected: data.metrics.fraud_rings_detected ?? data.fraud_rings.length,
        processing_time_seconds: data.metrics.processing_time_seconds ?? 0.5,
        total_transactions: data.metrics.total_transactions,
        graph_density: data.metrics.graph_density,
        benford_status: data.metrics.benford_status,
      };

      setResults({
        summary,
        suspicious_accounts,
        fraud_rings: data.fraud_rings as FraudRing[],
      });
      setGraphElements(data.elements);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoClick = () => {
    setFile(new File(["demo_content"], "big_data_set.csv", { type: "text/csv" }));
    setIsProcessing(true);
    setError(null);
    setTimeout(() => {
      setResults(ENHANCED_MOCK_RESULTS);
      setGraphElements(ENHANCED_GRAPH_ELEMENTS);
      setIsProcessing(false);
    }, 2000);
  };

  const handleReset = () => {
    setFile(null);
    setResults(null);
    setGraphElements([]);
    setSearchTerm('');
    setMinRisk(0);
    setShowSuspiciousOnly(false);
  };

  const handleDownloadJson = () => {
    if (!results) return;

    // Strict spec JSON for hackathon verification
    const exportPayload = {
      suspicious_accounts: results.suspicious_accounts,
      fraud_rings: results.fraud_rings,
      summary: {
        total_accounts_analyzed: results.summary.total_accounts_analyzed,
        suspicious_accounts_flagged: results.summary.suspicious_accounts_flagged,
        fraud_rings_detected: results.summary.fraud_rings_detected,
        processing_time_seconds: results.summary.processing_time_seconds,
      },
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'analysis_results.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const filteredGraphElements = React.useMemo(() => {
    if (!graphElements.length) return [];
    // Only filter nodes by risk / suspicious, keep edges that connect kept nodes
    const nodes = graphElements.filter((el: any) => !el.data.source);
    const edges = graphElements.filter((el: any) => el.data.source);

    const keptNodeIds = new Set(
      nodes
        .filter((n: any) => {
          const risk = typeof n.data.risk_score === 'number' ? n.data.risk_score : 0;
          const suspiciousOk = showSuspiciousOnly ? !!n.data.suspicious : true;
          return risk >= minRisk && suspiciousOk;
        })
        .map((n: any) => n.data.id),
    );

    const filteredNodes = nodes.filter((n: any) => keptNodeIds.has(n.data.id));
    const filteredEdges = edges.filter(
      (e: any) => keptNodeIds.has(e.data.source) && keptNodeIds.has(e.data.target),
    );

    // If everything got filtered out (e.g., very high threshold), fall back to original graph
    if (!filteredNodes.length) {
      return graphElements;
    }

    return [...filteredNodes, ...filteredEdges];
  }, [graphElements, minRisk, showSuspiciousOnly]);

  return (
    <div className="min-h-screen bg-cyber-mesh text-foreground font-sans relative">
      {/* Noise dot-grid is applied via globals.css ::before */}

      <header className="site-header sticky top-0 z-50 w-full">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">RIFT <span className="text-primary">Forensics</span></h1>
          </div>

          {/* Global Search Bar */}
          {results && (
            <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search User ID or Ring ID (e.g. RING_001)..."
                className="pl-9 bg-muted/40 border-muted-foreground/20 focus:border-primary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <ThemeToggle />
            {results && (
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground mr-4">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Live Analysis
                </span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-foreground">
              Reset
            </Button>
            <Button size="sm" onClick={handleDemoClick} className="font-semibold shadow-sm">
              <PlayCircle className="mr-2 h-4 w-4" /> Live Demo
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 relative">
        {!results ? (
          <div className="max-w-2xl mx-auto mt-20 text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Activity className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                Financial Forensics Engine
              </h2>
              <p className="text-xl text-muted-foreground">
                Detect sophisticated money laundering patterns, smurfing rings, and shell accounts in seconds.
              </p>
            </div>

            <Card className="border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:bg-muted/80 transition-colors">
              <CardContent className="pt-6 pb-8">
                <FileUpload onFileSelect={handleFileUpload} />
                <div className="mt-6 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Or try with sample data</span>
                  <Button variant="outline" size="sm" onClick={handleDemoClick} className="gap-2">
                    <PlayCircle className="h-4 w-4" /> Load Peak Traffic Test (500+ Txns)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-destructive">Analysis Failed</h4>
                  <p className="text-sm text-destructive/80 leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="mt-8 p-4 rounded-lg bg-card border shadow-sm flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Analyzing Graph Network...</p>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-progress-indeterminate origin-left" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Processed</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold">{results.summary.total_transactions ?? results.summary.total_accounts_analyzed}</div>
                  <p className="text-xs text-muted-foreground">
                    {results.summary.total_transactions
                      ? 'Transactions (rows) in CSV'
                      : 'Accounts analyzed'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Suspicious Entities</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-orange-600">{results.summary.suspicious_accounts_flagged}</div>
                  <p className="text-xs text-muted-foreground">High risk accounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Fraud Rings</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-red-600">{results.summary.fraud_rings_detected}</div>
                  <p className="text-xs text-muted-foreground">Circular patterns</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Analysis Time</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold font-mono">{results.summary.processing_time_seconds}s</div>
                  <p className="text-xs text-muted-foreground">End-to-end processing</p>
                </CardContent>
              </Card>
            </div>

            {/* Analysis controls + main layout */}
            <div className="grid grid-cols-1 gap-4">
              {/* Controls row */}
              <Card className="border-muted/60 bg-muted/40">
                <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Analysis Controls
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tune the network to focus on high-risk structures like smurfing hubs and cycle cores.
                    </p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground min-w-[70px]">
                        Min risk: <span className="font-semibold text-foreground">{minRisk}</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={minRisk}
                        onChange={(e) => setMinRisk(Number(e.target.value))}
                        className="w-40 accent-primary"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showSuspiciousOnly}
                        onChange={(e) => setShowSuspiciousOnly(e.target.checked)}
                        className="h-3 w-3 rounded border-input bg-background"
                      />
                      Show suspicious entities only
                    </label>
                    {results?.summary.benford_status && (
                      <span className="inline-flex items-center rounded-full border border-muted-foreground/20 px-2 py-1 text-[10px] font-mono uppercase tracking-wide">
                        Benford: {results.summary.benford_status}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Main Content Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-muted/50">
                  <TabsTrigger value="graph" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Network Graph
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="results" className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Detection Log
                  </TabsTrigger>
                  <TabsTrigger value="export" className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="graph" className="mt-4">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Main Graph View - Takes up 8 columns */}
                    <div className="xl:col-span-8 h-[750px] flex flex-col">
                      <Card id="graph-container" className="flex-1 flex flex-col shadow-md border-muted">
                        <CardHeader className="px-6 py-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Activity className="h-4 w-4 text-primary" />
                              Network Topology
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Interactive visualization of detected money flows
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => (window as any).graphRef?.fit()}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 relative bg-zinc-50/50 dark:bg-zinc-950/50">
                          <GraphView elements={filteredGraphElements} searchTerm={searchTerm} />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sidebar - Pattern Explainer */}
                    <div className="xl:col-span-4 space-y-4">
                      {selectedPattern ? (
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Pattern Details</h3>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPattern(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <PatternExplainer 
                            pattern={selectedPattern.pattern}
                            accountId={selectedPattern.accountId}
                            score={selectedPattern.score}
                          />
                        </>
                      ) : (
                        <Card className="bg-card/50 backdrop-blur border-muted/50">
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Pattern Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground">
                              Click on a suspicious account in the graph or detection log to see detailed pattern explanations.
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="analytics" className="mt-4">
                  <AnalyticsDashboard 
                    summary={results.summary}
                    suspiciousAccounts={results.suspicious_accounts}
                    fraudRings={results.fraud_rings}
                  />
                </TabsContent>

                <TabsContent value="results" className="mt-4">
                  <Card className="shadow-md">
                    <CardHeader className="px-6 py-4 border-b bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-orange-600" />
                          <CardTitle className="text-base">Detection Log</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleDownloadJson} className="h-8 text-xs">
                          <Download className="mr-1 h-3 w-3" /> Export JSON
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        <ResultsTable
                          suspiciousAccounts={results.suspicious_accounts}
                          fraudRings={results.fraud_rings}
                          summary={results.summary as any}
                          searchTerm={searchTerm}
                          onAccountClick={(account) => {
                            setSelectedPattern({
                              pattern: account.detected_patterns[0] || 'unknown',
                              accountId: account.account_id,
                              score: account.suspicion_score
                            });
                            setActiveTab('graph');
                          }}
                        />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="export" className="mt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ExportPanel 
                      results={{
                        summary: results.summary,
                        suspicious_accounts: results.suspicious_accounts,
                        fraud_rings: results.fraud_rings
                      }}
                    />
                    <Card className="bg-card/50 backdrop-blur border-muted/50">
                      <CardHeader>
                        <CardTitle className="text-base">Export Summary</CardTitle>
                        <CardDescription>Quick overview of exportable data</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Suspicious Accounts:</span>
                          <span className="font-semibold">{results.suspicious_accounts.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Fraud Rings:</span>
                          <span className="font-semibold">{results.fraud_rings.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Transactions:</span>
                          <span className="font-semibold">{results.summary.total_transactions || results.summary.total_accounts_analyzed}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Processing Time:</span>
                          <span className="font-semibold">{results.summary.processing_time_seconds}s</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
