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
    }, [elements, onNodeClick, theme]);

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
        <div className="relative w-full h-full">
            <Card className="w-full h-[600px] border-none shadow-none bg-zinc-50 dark:bg-zinc-950 overflow-hidden relative">
                <div ref={containerRef} className="w-full h-full" />

                {/* Performance Warning / Filtering Badge */}
                {statInfo && (
                    <div className="absolute top-4 left-4 z-10 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-amber-500/10 backdrop-blur border border-amber-500/20 text-amber-500 px-3 py-2 rounded-lg text-xs font-mono shadow-lg flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <div>
                                <div className="font-bold">HIGH DENSITY MODE</div>
                                <div className="opacity-80">Showing {statInfo.visible} / {statInfo.total} nodes (Threat Core)</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Tooltip/Legend */}
                <div className="absolute top-4 right-4 bg-background/90 backdrop-blur border p-3 rounded-lg shadow-sm text-xs space-y-2 pointer-events-none z-10">
                    <div className="font-semibold mb-1">Graph Legend</div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400 border border-slate-600"></span>
                        <span>Normal Account</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-900"></span>
                        <span>Suspicious / Mule</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 border border-orange-700 rotate-45"></div>
                        <data value="Aggregator / Shell" />
                        <span>Aggregator / Shell</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-600 border border-amber-900 clip-hexagon"></div>
                        <span>Structuring Sink</span>
                    </div>
                </div>

                {/* Hover Info Card */}
                {hoveredNode && (
                    <div className="absolute bottom-4 left-4 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="w-64 shadow-xl border-primary/20 bg-background/95 backdrop-blur">
                            <div className="p-3 border-b bg-muted/50">
                                <div className="font-bold flex justify-between items-center text-sm">
                                    {hoveredNode.id}
                                    {hoveredNode.suspicious && <Badge variant="destructive" className="text-[10px] h-5">SUSPICIOUS</Badge>}
                                </div>
                            </div>
                            <div className="p-3 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="font-medium capitalize">{hoveredNode.type || 'standard'}</span>
                                </div>
                                {typeof hoveredNode.risk_score === 'number' && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Risk score:</span>
                                        <span className={`font-bold ${hoveredNode.risk_score > 80 ? 'text-red-500' : 'text-orange-500'}`}>
                                            {hoveredNode.risk_score.toFixed(1)}
                                        </span>
                                    </div>
                                )}
                                {typeof hoveredNode.pagerank === 'number' && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">PageRank:</span>
                                        <span className="font-mono">{hoveredNode.pagerank.toFixed(3)}</span>
                                    </div>
                                )}
                                {typeof hoveredNode.community === 'number' && hoveredNode.community >= 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Community:</span>
                                        <span className="font-mono">#{hoveredNode.community}</span>
                                    </div>
                                )}
                                {Array.isArray(hoveredNode.rings) && hoveredNode.rings.length > 0 && (
                                    <div className="flex justify-between gap-2">
                                        <span className="text-muted-foreground">Rings:</span>
                                        <span className="font-mono truncate" title={hoveredNode.rings.join(', ')}>
                                            {hoveredNode.rings.join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}
            </Card>
        </div>
    );
}
