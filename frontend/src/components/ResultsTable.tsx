import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface SuspiciousAccount {
    account_id: string;
    suspicion_score: number;
    detected_patterns: string[];
    ring_id: string;
    community?: number;
    pagerank?: number;
}

interface FraudRing {
    ring_id: string;
    member_accounts: string[];
    pattern_type: string;
    risk_score: number;
}

interface Summary {
    total_accounts: number;
    suspicious_count: number;
    rings_count: number;
    processing_time: number;
    benford_status?: string;
}

interface ResultsTableProps {
    suspiciousAccounts: SuspiciousAccount[];
    fraudRings: FraudRing[];
    summary: Summary;
    searchTerm?: string;
    onAccountClick?: (account: SuspiciousAccount) => void;
}

export function ResultsTable({ suspiciousAccounts, fraudRings, searchTerm = '', onAccountClick }: ResultsTableProps) {
    const term = searchTerm.toUpperCase();

    // Filter Rings
    const filteredRings = fraudRings.filter(ring =>
        ring.ring_id.toUpperCase().includes(term) ||
        ring.member_accounts.some(m => m.toUpperCase().includes(term))
    );

    // Filter Accounts
    const filteredAccounts = suspiciousAccounts.filter(acc =>
        acc.account_id.toUpperCase().includes(term) ||
        (acc.ring_id && acc.ring_id.toUpperCase().includes(term)) ||
        (acc.detected_patterns && acc.detected_patterns.some(p => p.toUpperCase().includes(term)))
    );
    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {/* Fraud Rings Table */}
                <div className="rounded-md border bg-card">
                    <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <h3 className="font-semibold text-sm">Fraud Rings</h3>
                        </div>
                        <Badge variant="outline" className="text-xs">{filteredRings.length} Matches</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/10">
                                <tr className="border-b">
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Ring ID</th>
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Pattern</th>
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Members</th>
                                    <th className="text-right font-medium py-2 px-4 text-muted-foreground">Risk</th>
                                    <th className="text-right font-medium py-2 px-4 text-muted-foreground">Size</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRings.map((ring) => (
                                    <tr key={ring.ring_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="py-2 px-4 font-mono font-medium">{ring.ring_id}</td>
                                        <td className="py-2 px-4 capitalize">{ring.pattern_type.replace('_', ' ')}</td>
                                        <td className="py-2 px-4 max-w-[180px] text-xs text-muted-foreground truncate" title={ring.member_accounts.join(', ')}>
                                            {ring.member_accounts.join(', ')}
                                        </td>
                                        <td className="py-2 px-4 text-right">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${ring.risk_score > 90
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                                }`}>
                                                {ring.risk_score}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-right">{ring.member_accounts.length}</td>
                                    </tr>
                                ))}
                                {fraudRings.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-muted-foreground">No fraud rings detected.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Suspicious Accounts Table */}
                <div className="rounded-md border bg-card">
                    <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <h3 className="font-semibold text-sm">High Risk Accounts</h3>
                        </div>
                        <Badge variant="outline" className="text-xs">{filteredAccounts.length} Matches</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/10">
                                <tr className="border-b">
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Account ID</th>
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Score</th>
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Community</th>
                                    <th className="text-left font-medium py-2 px-4 text-muted-foreground">Patterns</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccounts.slice(0, 15).map((account) => (
                                    <tr 
                                        key={account.account_id} 
                                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => onAccountClick?.(account)}
                                    >
                                        <td className="py-2 px-4 font-mono font-medium text-foreground">{account.account_id}</td>
                                        <td className="py-2 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-1.5 w-1.5 rounded-full ${account.suspicion_score > 80 ? 'bg-red-500' : 'bg-orange-500'}`} />
                                                {account.suspicion_score}
                                            </div>
                                        </td>
                                        <td className="py-2 px-4">
                                            {account.community !== undefined ? `Comp #${account.community}` : '-'}
                                        </td>
                                        <td className="py-2 px-4 text-muted-foreground max-w-[150px] truncate" title={account.detected_patterns.join(', ')}>
                                            {account.detected_patterns.join(', ')}
                                        </td>
                                    </tr>
                                ))}
                                {suspiciousAccounts.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-muted-foreground">No suspicious accounts found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
