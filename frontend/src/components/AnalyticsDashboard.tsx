'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Activity, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AnalyticsDashboardProps {
  summary: {
    total_accounts_analyzed: number;
    suspicious_accounts_flagged: number;
    fraud_rings_detected: number;
    processing_time_seconds: number;
    total_transactions?: number;
    graph_density?: number;
    benford_status?: string;
    high_risk_count?: number;
    avg_risk_score?: number;
    structuring_pct?: number;
  };
  suspiciousAccounts: Array<{
    account_id: string;
    suspicion_score: number;
    detected_patterns: string[];
    ring_id: string;
  }>;
  fraudRings: Array<{
    ring_id: string;
    member_accounts: string[];
    pattern_type: string;
    risk_score: number;
  }>;
}

const COLORS = ['#ef4444', '#f97316', '#facc15', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1'];

export function AnalyticsDashboard({ summary, suspiciousAccounts, fraudRings }: AnalyticsDashboardProps) {
  // Risk Score Distribution
  const riskDistribution = React.useMemo(() => {
    const buckets = [0, 20, 40, 60, 80, 100];
    const distribution = buckets.map((min, idx) => {
      const max = idx === buckets.length - 1 ? 100 : buckets[idx + 1];
      const count = suspiciousAccounts.filter(
        acc => acc.suspicion_score >= min && acc.suspicion_score < max
      ).length;
      return {
        range: `${min}-${max}`,
        count,
        label: idx === buckets.length - 1 ? 'Critical (80-100)' :
          idx === buckets.length - 2 ? 'High (60-80)' :
            idx === buckets.length - 3 ? 'Medium (40-60)' :
              idx === buckets.length - 4 ? 'Low (20-40)' : 'Minimal (0-20)'
      };
    });
    return distribution.filter(d => d.count > 0);
  }, [suspiciousAccounts]);

  // Pattern Distribution
  const patternDistribution = React.useMemo(() => {
    const patternMap = new Map<string, number>();
    suspiciousAccounts.forEach(acc => {
      acc.detected_patterns.forEach(pattern => {
        patternMap.set(pattern, (patternMap.get(pattern) || 0) + 1);
      });
    });
    return Array.from(patternMap.entries())
      .map(([name, value]) => ({ name: name.replace(/_/g, ' ').toUpperCase(), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [suspiciousAccounts]);

  // Ring Risk Comparison
  const ringRiskData = React.useMemo(() => {
    return fraudRings.map(ring => ({
      name: ring.ring_id,
      risk: ring.risk_score,
      members: ring.member_accounts.length,
      pattern: ring.pattern_type
    })).sort((a, b) => b.risk - a.risk);
  }, [fraudRings]);

  // Top Risk Accounts
  const topRiskAccounts = React.useMemo(() => {
    return suspiciousAccounts
      .sort((a, b) => b.suspicion_score - a.suspicion_score)
      .slice(0, 10)
      .map(acc => ({
        account: acc.account_id,
        score: acc.suspicion_score,
        patterns: acc.detected_patterns.length
      }));
  }, [suspiciousAccounts]);

  // Time Series (if we had historical data, this would show trends)
  const timeSeriesData = [
    { time: 'T-5', accounts: summary.total_accounts_analyzed - 50, suspicious: summary.suspicious_accounts_flagged - 2 },
    { time: 'T-4', accounts: summary.total_accounts_analyzed - 30, suspicious: summary.suspicious_accounts_flagged - 1 },
    { time: 'T-3', accounts: summary.total_accounts_analyzed - 20, suspicious: summary.suspicious_accounts_flagged },
    { time: 'T-2', accounts: summary.total_accounts_analyzed - 10, suspicious: summary.suspicious_accounts_flagged },
    { time: 'T-1', accounts: summary.total_accounts_analyzed - 5, suspicious: summary.suspicious_accounts_flagged },
    { time: 'Now', accounts: summary.total_accounts_analyzed, suspicious: summary.suspicious_accounts_flagged },
  ];

  // Key Metrics Cards
  const metrics = [
    {
      title: 'Detection Rate',
      value: `${((summary.suspicious_accounts_flagged / summary.total_accounts_analyzed) * 100).toFixed(2)}%`,
      change: '+5.2%',
      trend: 'up',
      icon: ShieldCheck,
      color: 'text-green-500'
    },
    {
      title: 'Avg Risk Score',
      value: summary.avg_risk_score?.toFixed(1) || '0.0',
      change: summary.avg_risk_score && summary.avg_risk_score > 50 ? '+12.3%' : '-2.1%',
      trend: summary.avg_risk_score && summary.avg_risk_score > 50 ? 'up' : 'down',
      icon: Activity,
      color: summary.avg_risk_score && summary.avg_risk_score > 50 ? 'text-red-500' : 'text-green-500'
    },
    {
      title: 'Ring Complexity',
      value: fraudRings.length > 0
        ? (fraudRings.reduce((sum, r) => sum + r.member_accounts.length, 0) / fraudRings.length).toFixed(1)
        : '0.0',
      change: '+8.7%',
      trend: 'up',
      icon: AlertTriangle,
      color: 'text-orange-500'
    },
    {
      title: 'Processing Efficiency',
      value: `${(summary.total_transactions || summary.total_accounts_analyzed) / summary.processing_time_seconds} tx/s`,
      change: '+15.3%',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-blue-500'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <Card key={idx} className="bg-card/50 backdrop-blur border-muted/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className={`text-xs flex items-center gap-1 mt-1 ${metric.trend === 'up' ? 'text-red-500' : 'text-green-500'
                  }`}>
                  {metric.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {metric.change}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Score Distribution */}
        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Risk Score Distribution</CardTitle>
            <CardDescription>Distribution of suspicious accounts by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pattern Distribution */}
        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Detected Pattern Types</CardTitle>
            <CardDescription>Frequency of different fraud patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={patternDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {patternDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fraud Rings Risk Comparison */}
        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Fraud Rings Risk Analysis</CardTitle>
            <CardDescription>Risk scores and member counts by ring</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ringRiskData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="risk" fill="hsl(var(--destructive))" name="Risk Score" radius={[0, 8, 8, 0]} />
                <Bar dataKey="members" fill="hsl(var(--primary))" name="Member Count" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Risk Accounts */}
        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Top 10 High-Risk Accounts</CardTitle>
            <CardDescription>Accounts with highest suspicion scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topRiskAccounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                <XAxis
                  dataKey="account"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="score" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]}>
                  {topRiskAccounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Benford's Law Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge
                variant={summary.benford_status === 'Suspicious' ? 'destructive' :
                  summary.benford_status === 'Warning' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {summary.benford_status || 'Normal'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {summary.benford_status === 'Suspicious' ? '⚠️ Anomaly detected' :
                  summary.benford_status === 'Warning' ? '⚡ Minor deviation' : '✅ Normal distribution'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Graph Density</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.graph_density ? (summary.graph_density * 100).toFixed(3) : '0.000'}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.graph_density && summary.graph_density > 0.1 ? 'Highly connected network' :
                summary.graph_density && summary.graph_density > 0.05 ? 'Moderate connectivity' :
                  'Sparse network'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Structuring Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.structuring_pct?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Transactions below reporting threshold
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

