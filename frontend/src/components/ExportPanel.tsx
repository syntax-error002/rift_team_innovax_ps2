'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileText, FileSpreadsheet, FileImage } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportPanelProps {
  results: {
    summary: any;
    suspicious_accounts: any[];
    fraud_rings: any[];
  };
  onExport?: (format: string) => void;
}

export function ExportPanel({ results, onExport }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportJSON = () => {
    setIsExporting('json');
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(
      JSON.stringify({
        suspicious_accounts: results.suspicious_accounts,
        fraud_rings: results.fraud_rings,
        summary: results.summary,
      }, null, 2)
    );
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `rift-analysis-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setIsExporting(null);
    onExport?.('json');
  };

  const handleExportCSV = () => {
    setIsExporting('csv');
    
    // Export Suspicious Accounts
    const accountsCSV = [
      ['Account ID', 'Suspicion Score', 'Detected Patterns', 'Ring ID'].join(','),
      ...results.suspicious_accounts.map(acc => [
        acc.account_id,
        acc.suspicion_score,
        acc.detected_patterns.join(';'),
        acc.ring_id
      ].join(','))
    ].join('\n');

    // Export Fraud Rings
    const ringsCSV = [
      ['Ring ID', 'Pattern Type', 'Risk Score', 'Member Accounts'].join(','),
      ...results.fraud_rings.map(ring => [
        ring.ring_id,
        ring.pattern_type,
        ring.risk_score,
        ring.member_accounts.join(';')
      ].join(','))
    ].join('\n');

    const combinedCSV = `SUSPICIOUS ACCOUNTS\n${accountsCSV}\n\nFRAUD RINGS\n${ringsCSV}\n\nSUMMARY\n${Object.entries(results.summary).map(([k, v]) => `${k},${v}`).join('\n')}`;

    const blob = new Blob([combinedCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', url);
    downloadAnchorNode.setAttribute('download', `rift-analysis-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    window.URL.revokeObjectURL(url);
    setIsExporting(null);
    onExport?.('csv');
  };

  const handleExportPDF = async () => {
    setIsExporting('pdf');
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Title
      pdf.setFontSize(20);
      pdf.text('RIFT Financial Forensics Report', 20, 20);
      
      // Summary Section
      pdf.setFontSize(14);
      pdf.text('Summary', 20, 35);
      pdf.setFontSize(10);
      let yPos = 45;
      Object.entries(results.summary).forEach(([key, value]) => {
        pdf.text(`${key}: ${value}`, 20, yPos);
        yPos += 7;
      });

      // Suspicious Accounts
      yPos += 5;
      pdf.setFontSize(14);
      pdf.text('Suspicious Accounts', 20, yPos);
      pdf.setFontSize(10);
      yPos += 10;
      results.suspicious_accounts.slice(0, 20).forEach((acc, idx) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`${idx + 1}. ${acc.account_id} - Score: ${acc.suspicion_score}`, 20, yPos);
        yPos += 7;
      });

      // Fraud Rings
      yPos += 5;
      pdf.setFontSize(14);
      pdf.text('Fraud Rings', 20, yPos);
      pdf.setFontSize(10);
      yPos += 10;
      results.fraud_rings.forEach((ring, idx) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`${ring.ring_id}: ${ring.pattern_type} (Risk: ${ring.risk_score})`, 20, yPos);
        yPos += 7;
        pdf.text(`Members: ${ring.member_accounts.join(', ')}`, 25, yPos);
        yPos += 10;
      });

      pdf.save(`rift-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
      setIsExporting(null);
      onExport?.('pdf');
    } catch (error) {
      console.error('PDF export failed:', error);
      setIsExporting(null);
    }
  };

  const handleExportImage = async () => {
    setIsExporting('image');
    try {
      const element = document.getElementById('graph-container') || document.body;
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', imgData);
      downloadAnchorNode.setAttribute('download', `rift-graph-${new Date().toISOString().split('T')[0]}.png`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      setIsExporting(null);
      onExport?.('image');
    } catch (error) {
      console.error('Image export failed:', error);
      setIsExporting(null);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-muted/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Analysis Results
        </CardTitle>
        <CardDescription>Download results in various formats for reporting and analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleExportJSON}
            disabled={!!isExporting}
            className="flex items-center gap-2"
          >
            <FileJson className="h-4 w-4" />
            {isExporting === 'json' ? 'Exporting...' : 'JSON'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!!isExporting}
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isExporting === 'csv' ? 'Exporting...' : 'CSV'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={!!isExporting}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            {isExporting === 'pdf' ? 'Exporting...' : 'PDF'}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportImage}
            disabled={!!isExporting}
            className="flex items-center gap-2"
          >
            <FileImage className="h-4 w-4" />
            {isExporting === 'image' ? 'Exporting...' : 'PNG'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

