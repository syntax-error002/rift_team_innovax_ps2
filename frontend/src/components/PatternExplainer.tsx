'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, TrendingUp, Network, RotateCcw, Users } from 'lucide-react';

interface PatternExplainerProps {
  pattern: string;
  accountId?: string;
  score?: number;
}

const PATTERN_DESCRIPTIONS: Record<string, {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  examples: string[];
}> = {
  'circular_flow': {
    title: 'Circular Flow Pattern',
    description: 'Money flows in a loop through multiple accounts to obscure the origin. This is a classic money laundering technique where funds cycle through accounts to break the audit trail.',
    icon: RotateCcw,
    color: 'text-red-500',
    examples: [
      'Account A → Account B → Account C → Account A',
      'Creates artificial transaction history',
      'Makes source of funds difficult to trace'
    ]
  },
  'fan_in_aggregator': {
    title: 'Fan-In Aggregation (Smurfing)',
    description: 'Multiple small deposits from different sources are aggregated into a single account. This pattern is used to avoid transaction reporting thresholds.',
    icon: TrendingUp,
    color: 'text-orange-500',
    examples: [
      '10+ accounts send small amounts to one aggregator',
      'Transactions typically under reporting threshold',
      'Rapid aggregation within 72-hour window'
    ]
  },
  'fan_out_source': {
    title: 'Fan-Out Dispersion',
    description: 'One account disperses funds to many recipients. This is often used to distribute laundered money across multiple accounts.',
    icon: Network,
    color: 'text-yellow-500',
    examples: [
      'Single source sends to 10+ different accounts',
      'Rapid dispersion to avoid detection',
      'Often combined with structuring patterns'
    ]
  },
  'shell_account': {
    title: 'Shell Account (Layering)',
    description: 'Intermediate accounts with minimal transaction activity used to layer money through the system. These accounts act as pass-through nodes.',
    icon: Users,
    color: 'text-purple-500',
    examples: [
      'Low degree accounts (1-3 transactions)',
      'High volume pass-through behavior',
      'Retains less than 10% of funds'
    ]
  },
  'mule': {
    title: 'Money Mule Account',
    description: 'Accounts used to transfer illicit funds, typically showing high in/out flow with minimal net balance retention.',
    icon: AlertTriangle,
    color: 'text-pink-500',
    examples: [
      'High transaction volume',
      'Low net balance (<15% of flow)',
      'Rapid movement of funds'
    ]
  },
  'ring_member': {
    title: 'Fraud Ring Member',
    description: 'Account identified as part of a coordinated fraud ring, typically involved in circular flows or structured transactions.',
    icon: Network,
    color: 'text-red-600',
    examples: [
      'Member of detected cycle',
      'Coordinated transaction patterns',
      'High risk score from multiple factors'
    ]
  },
  'aggregator': {
    title: 'Aggregator Node',
    description: 'Account that collects funds from multiple sources, often part of smurfing operations.',
    icon: TrendingUp,
    color: 'text-orange-600',
    examples: [
      'Receives from many small sources',
      'Consolidates funds',
      'May disperse to final destination'
    ]
  },
  'source': {
    title: 'Source/Kingpin Node',
    description: 'High-influence account identified through PageRank analysis, likely the originator of fraudulent activity.',
    icon: AlertTriangle,
    color: 'text-red-700',
    examples: [
      'High PageRank score',
      'Central to network structure',
      'May be orchestrating operations'
    ]
  }
};

export function PatternExplainer({ pattern, accountId, score }: PatternExplainerProps) {
  const patternInfo = PATTERN_DESCRIPTIONS[pattern] || {
    title: pattern.replace(/_/g, ' ').toUpperCase(),
    description: 'Pattern detected in transaction network analysis.',
    icon: Info,
    color: 'text-blue-500',
    examples: []
  };

  const Icon = patternInfo.icon;

  return (
    <Card className="bg-card/50 backdrop-blur border-muted/50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className={`h-4 w-4 ${patternInfo.color}`} />
          Pattern Explanation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Badge variant="outline" className="mb-2">{patternInfo.title}</Badge>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {patternInfo.description}
          </p>
        </div>

        {accountId && (
          <div className="pt-2 border-t border-muted">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Account:</span>
              <span className="font-mono font-medium">{accountId}</span>
            </div>
            {score !== undefined && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">Risk Score:</span>
                <span className={`font-bold ${score > 80 ? 'text-red-500' : score > 60 ? 'text-orange-500' : 'text-yellow-500'}`}>
                  {score.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {patternInfo.examples.length > 0 && (
          <div className="pt-2 border-t border-muted">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Key Characteristics:</p>
            <ul className="space-y-1">
              {patternInfo.examples.map((example, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

