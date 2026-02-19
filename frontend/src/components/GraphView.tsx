'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/ThemeProvider';

/** Read a CSS custom property value from :root */
function getCSSVar(name: string): string {
    if (typeof window === 'undefined') return '#38bdf8';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#38bdf8';
}

interface GraphViewProps {
    elements: cytoscape.ElementDefinition[];
    onNodeClick?: (nodeData: any) => void;
    searchTerm?: string;
}

export function GraphView({ elements, onNodeClick, searchTerm }: GraphViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<cytoscape.Core | null>(null);
    const [hoveredNode, setHoveredNode] = useState<any>(null);
    const [statInfo, setStatInfo] = useState<{ visible: number, total: number, hidden: number } | null>(null);
    const { theme } = useTheme(); // re-render graph when theme changes

    useEffect(() => {
        if (!containerRef.current) return;

        // Read edge/accent color from active CSS theme
        const edgeColor = getCSSVar('--edge-glow');
        // --- SMART FILTERING FOR LARGE DATASETS ---
        // If dataset is > 2000 elements, we filter to prevent browser crash ("collapse")
        // Priority: Suspicious Nodes > Aggregators > Mules > High Value Edges
        let elementsToRender = elements;
        const totalElements = elements.length;
        const HARD_CAP = 600; // Increased cap for high-performance mode
        const THRESHOLD = 2000;

        // Filter if > THRESHOLD (2000) OR if total > HARD_CAP
        if (totalElements > THRESHOLD || totalElements > HARD_CAP) {
            let filteredNodes = elements.filter(el => {
                // Keep suspicious, high risk, or specific types
                return el.data.suspicious || el.data.risk_score > 60 || el.data.type === 'source' || el.data.type === 'mule';
            });

            // If still too many, slice by highest risk
            if (filteredNodes.length > HARD_CAP) {
                // Sort by risk descending
                filteredNodes.sort((a, b) => (b.data.risk_score || 0) - (a.data.risk_score || 0));
                filteredNodes = filteredNodes.slice(0, HARD_CAP);
            }

            // FALLBACK: If no suspicious nodes found, show the most connected nodes (Hubs)
            if (filteredNodes.length === 0) {
                // ... (existing hub logic, effectively unused if we have results, but good backup) ...
                // Keeping existing logic but ensuring we respect cap at the end
                const degreeMap = new Map<string, number>();
                elements.forEach(el => {
                    const src = el.data.source as string | undefined;
                    const tgt = el.data.target as string | undefined;
                    if (src) degreeMap.set(src, (degreeMap.get(src) || 0) + 1);
                    if (tgt) degreeMap.set(tgt, (degreeMap.get(tgt) || 0) + 1);
                });

                const sortedNodes = elements
                    .filter(el => !el.data.source && typeof el.data.id === 'string')
                    .sort((a, b) => {
                        const aId = a.data.id as string;
                        const bId = b.data.id as string;
                        return (degreeMap.get(bId) || 0) - (degreeMap.get(aId) || 0);
                    });

                filteredNodes = sortedNodes.slice(0, 50); // Just top 50 hubs if nothing else
            }

            const includedNodeIds = new Set(filteredNodes.map(n => n.data.id));

            // Get edges ONLY between included nodes
            const relevantEdges = elements.filter(el => {
                if (!el.data.source) return false;
                return includedNodeIds.has(el.data.source) && includedNodeIds.has(el.data.target);
            });

            elementsToRender = [...filteredNodes, ...relevantEdges];

            setStatInfo({
                visible: elementsToRender.length,
                total: totalElements,
                hidden: totalElements - elementsToRender.length
            });
        } else {
            setStatInfo(null);
        }

        // --- FINAL SAFETY CHECK ---
        // Ensure we don't pass dangling edges to Cytoscape (causes crash)
        const validNodeIds = new Set<string>();
        elementsToRender.forEach(el => {
            if (!el.data.source && el.data.id) {
                validNodeIds.add(el.data.id);
            }
        });

        const safeElements = elementsToRender.filter(el => {
            if (el.data.source && el.data.target) {
                // It's an edge
                return validNodeIds.has(el.data.source) && validNodeIds.has(el.data.target);
            }
            return true; // It's a node
        });

        // Dynamic Layout Selection
        // USER REQUEST: Always use force-directed layout ("free form")
        // 'cose' provides the organic, physics-based simulation

        cyRef.current = cytoscape({
            container: containerRef.current,
            elements: safeElements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#475569',
                        'label': 'data(id)',
                        'color': '#cbd5e1', // Slate-300 for better contrast text
                        'font-size': '10px',
                        'font-weight': 600,
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'width': '40px',
                        'height': '40px',
                        'border-width': 2,
                        'border-color': '#64748b',
                        'overlay-padding': '6px',
                        'z-index': 10,
                        // @ts-ignore
                        'shadow-blur': 0, // Performance optimization
                    }
                },
                // Risk heat-map: green (safe) → amber → red (threat). Sizes auto-scale.
                {
                    selector: 'node[risk_score]',
                    style: {
                        'background-color': 'mapData(risk_score, 0, 100, #22d3ee, #ef4444)',
                        'width': 'mapData(risk_score, 0, 100, 30, 60)',
                        'height': 'mapData(risk_score, 0, 100, 30, 60)',
                    },
                },
                {
                    selector: 'node[?suspicious]',
                    style: {
                        'border-color': '#fb923c',
                        'border-width': 3,
                    }
                },
                {
                    selector: 'node[community >= 0]',
                    style: {
                        'border-width': 2,
                        'border-color': '#38bdf8',
                    },
                },
                {
                    selector: 'node[type="mule"]',
                    style: {
                        'shape': 'diamond',
                        'background-color': '#f97316',
                        'border-color': '#fed7aa',
                        'border-width': 2,
                        'width': '45px',
                        'height': '45px',
                    }
                },
                {
                    selector: 'node[type="source"]',
                    style: {
                        'shape': 'star',
                        'background-color': '#d946ef',
                        'width': '60px',
                        'height': '60px',
                        'border-color': '#f0abfc',
                        'border-width': 3,
                    }
                },
                {
                    selector: 'node[type="aggregator"]',
                    style: {
                        'shape': 'hexagon',
                        'background-color': '#facc15',
                        'width': '50px',
                        'height': '50px',
                        'border-color': '#fef08a',
                        'border-width': 2,
                    }
                },
                {
                    selector: 'node[type="ring_member"]',
                    style: {
                        'shape': 'ellipse',
                        'background-color': '#f43f5e',
                        'width': '45px',
                        'height': '45px',
                        'border-color': '#fda4af',
                        'border-width': 3,
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1.5,
                        'line-color': edgeColor,
                        'target-arrow-color': edgeColor,
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier', // Cleaner curves
                        'opacity': 0.4,
                        'arrow-scale': 1.0,
                    }
                },
                {
                    selector: 'edge[?suspicious]', // If edges are marked suspicious
                    style: {
                        'line-color': '#ef4444',
                        'target-arrow-color': '#ef4444',
                        'width': 2,
                        'opacity': 0.8,
                    }
                },
                {
                    selector: 'edge[amount]',
                    style: {
                        'label': 'data(amount)',
                        'font-size': '8px',
                        'text-rotation': 'autorotate',
                        'text-background-color': '#020617', // Dark background for text
                        'text-background-opacity': 0.7,
                        'text-background-padding': '2px',
                        'color': '#cbd5e1',
                    }
                },
                // INTERACTION STATES
                {
                    selector: ':selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#3b82f6', // Blue-500
                        'border-opacity': 1,
                        'background-color': '#2563eb', // Blue-600
                    }
                },
                // High-risk pulse class
                {
                    selector: '.high-risk',
                    style: {
                        'border-width': 4,
                        'border-color': '#fb7185', // Rose-400
                    },
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': '#8b5cf6', // Violet-500
                        'line-color': '#8b5cf6',
                        'target-arrow-color': '#8b5cf6',
                        'z-index': 9999, // Ensure on top
                        'opacity': 1, // Full opacity
                    }
                },
                {
                    selector: '.faded',
                    style: {
                        'opacity': 0.05, // Extreme fade for focus effect
                        'z-index': 0,
                    }
                },
                // FLEXIBLE HOVER EFFECT FOR EDGES
                {
                    selector: '.edge-hover',
                    style: {
                        'width': 3,
                        'line-color': '#38bdf8', // Light blue highlight
                        'target-arrow-color': '#38bdf8',
                        'arrow-scale': 1.2,
                        'opacity': 1,
                        'z-index': 999,
                    }
                }
            ],
            layout: {
                // FORCE DIRECTED ALWAYS
                name: 'cose',
                animate: true,
                animationDuration: 1000,
                nodeRepulsion: () => 400000, // Reduced repulsion (was 1M) to allow clustering
                idealEdgeLength: () => 100,   // Standard edge length (was 150)
                // @ts-ignore
                gravity: 0.25,                 // Increased gravity (was 0.1) to pull graph together
                // @ts-ignore
                numIter: 1000,
                // @ts-ignore
                refresh: 20,
                fit: true,
                padding: 30,
                componentSpacing: 40,
                nodeOverlap: 20,
                // @ts-ignore
                packComponents: true, // Pack unconnected components tightly
            },
            minZoom: 0.2,
            maxZoom: 3,
            wheelSensitivity: 0.3,
            pixelRatio: 'auto',
            textureOnViewport: false,
            motionBlur: false,
        });

        const cy = cyRef.current;

        cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            if (onNodeClick) {
                onNodeClick(node.data());
            }
        });

        // HOVER "THREAD" EFFECT
        cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            containerRef.current!.style.cursor = 'pointer';
            setHoveredNode({
                id: node.id(),
                ...node.data()
            });

            // Highlight thread: Node + Neighbors + Connected Edges
            cy.batch(() => {
                cy.elements().addClass('faded'); // Fade everything first
                const neighborhood = node.neighborhood().add(node); // Node + direct connections
                neighborhood.removeClass('faded').addClass('highlighted'); // Highlight thread
            });
        });

        cy.on('mouseout', 'node', () => {
            containerRef.current!.style.cursor = 'default';
            setHoveredNode(null);

            // Reset styles
            cy.batch(() => {
                cy.elements().removeClass('faded highlighted');
            });
        });

        // EDGE HOVER EFFECTS
        cy.on('mouseover', 'edge', (evt) => {
            const edge = evt.target;
            containerRef.current!.style.cursor = 'pointer';
            edge.addClass('edge-hover');
        });

        cy.on('mouseout', 'edge', (evt) => {
            const edge = evt.target;
            containerRef.current!.style.cursor = 'default';
            edge.removeClass('edge-hover');
        });

        // Expose reference for external controls if needed (already used in page.tsx)
        (window as any).graphRef = cy;

        // Mark ultra high-risk nodes with a persistent halo
        cy.batch(() => {
            cy.nodes().forEach((n) => {
                const risk = n.data('risk_score') as number | undefined;
                if (typeof risk === 'number' && risk >= 80) {
                    n.addClass('high-risk');
                }
            });
        });

        return () => {
            if (cyRef.current) {
                cyRef.current.destroy();
            }
        };
    }, [safeElements, onNodeClick]);

    // --- SEARCH EFFECT ---
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy || !searchTerm) {
            cy?.elements().removeClass('highlighted faded');
            return;
        }

        const term = searchTerm.toUpperCase();
        cy.batch(() => {
            cy.elements().removeClass('highlighted faded');

            const matches = cy.nodes().filter((node) => {
                const data = node.data();
                const idMatch = data.id.toUpperCase().includes(term);
                // @ts-ignore
                const ringMatch = data.rings && data.rings.some((r: string) => r.toUpperCase().includes(term));
                return idMatch || ringMatch;
            });

            if (matches.length > 0) {
                matches.addClass('highlighted');
                // Neighborhood highlight
                matches.neighborhood().addClass('highlighted');

                cy.elements().not(matches).not(matches.neighborhood()).addClass('faded');

                // Zoom to fit results
                cy.animate({
                    fit: {
                        eles: matches,
                        padding: 50
                    },
                    duration: 500
                });
            }
        });
    }, [searchTerm]);

    return (
        <div className={`relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700/50 ${className}`}>
            <div
                ref={containerRef}
                className="w-full h-full bg-scifi-grid" // Use the new animated grid
            />

            {/* Legend / Overlay Controls */}
            <div className="absolute bottom-4 right-4 pointer-events-none z-10">
                <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-lg border border-slate-800 text-xs text-slate-400 pointer-events-auto">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"></div>
                        <span>Safe Account</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                        <span>Mule Account</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                        <span>Fraud Ring</span>
                    </div>
                </div>
            </div>

            {hoveredNode && (
                <div className="absolute top-4 left-4 z-50 pointer-events-none">
                    <Card className="w-64 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 text-slate-100 shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader className="p-4 pb-2 border-b border-white/5">
                            <CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                {hoveredNode.id}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-3 text-xs space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Risk Score</span>
                                <span className={`font-bold px-2 py-0.5 rounded ${hoveredNode.risk_score > 75 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' :
                                        hoveredNode.risk_score > 40 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                                    }`}>
                                    {typeof hoveredNode.risk_score === 'number' ? hoveredNode.risk_score.toFixed(1) : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Type</span>
                                <Badge variant="outline" className="text-[10px] capitalize border-slate-700 bg-slate-800/50 text-slate-300">
                                    {hoveredNode.type || 'Unknown'}
                                </Badge>
                            </div>
                            {hoveredNode.flag && (
                                <div className="flex justify-between items-center bg-rose-950/30 p-2 rounded border border-rose-900/50">
                                    <span className="text-rose-400 font-semibold">Flagged</span>
                                    <span className="font-mono text-rose-300">{hoveredNode.flag}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
