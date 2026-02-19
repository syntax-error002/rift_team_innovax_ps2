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
        // 'cose' is good for small graphs but explodes/freezes on large ones
        // 'concentric' or 'circle' is instant and stable for high density
        const useStableLayout = safeElements.length > 200;

        cyRef.current = cytoscape({
            container: containerRef.current,
            elements: safeElements,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#475569',
                        'label': 'data(id)',
                        'color': '#e2e8f0',
                        'font-size': '11px',
                        'font-weight': 700,
                        'text-valign': 'bottom',
                        'text-margin-y': 6,
                        'text-halign': 'center',
                        'text-background-color': 'rgba(2, 6, 23, 0.7)',
                        'text-background-opacity': 1,
                        'text-background-padding': '3px',
                        'text-background-shape': 'roundrectangle',
                        'width': '50px',
                        'height': '50px',
                        'border-width': 2.5,
                        'border-color': '#64748b',
                        'overlay-padding': '8px',
                        'z-index': 10,
                        // @ts-ignore
                        'shadow-blur': 8,
                        // @ts-ignore
                        'shadow-color': '#0f172a',
                        // @ts-ignore
                        'shadow-opacity': 0.6,
                    }
                },
                // Risk heat-map: green (safe) → amber → red (threat). Sizes auto-scale.
                {
                    selector: 'node[risk_score]',
                    style: {
                        'background-color': 'mapData(risk_score, 0, 100, #22d3ee, #ef4444)',
                        'width': 'mapData(risk_score, 0, 100, 44, 80)',
                        'height': 'mapData(risk_score, 0, 100, 44, 80)',
                    },
                },
                {
                    selector: 'node[?suspicious]',
                    style: {
                        'border-color': '#fb923c',
                        'border-width': 4,
                        // @ts-ignore
                        'shadow-blur': 30,
                        // @ts-ignore
                        'shadow-color': '#fb923c',
                        // @ts-ignore
                        'shadow-opacity': 0.75,
                    }
                },
                {
                    selector: 'node[community >= 0]',
                    style: {
                        'border-width': 3,
                        'border-color': '#38bdf8',
                    },
                },
                {
                    selector: 'node[type="mule"]',
                    style: {
                        'shape': 'diamond',
                        'background-color': '#f97316',
                        'border-color': '#fed7aa',
                        'border-width': 3,
                        'width': '62px',
                        'height': '62px',
                        // @ts-ignore
                        'shadow-blur': 22,
                        // @ts-ignore
                        'shadow-color': '#f97316',
                        // @ts-ignore
                        'shadow-opacity': 0.6,
                    }
                },
                {
                    selector: 'node[type="source"]',
                    style: {
                        'shape': 'star',
                        'background-color': '#d946ef',
                        'width': '88px',
                        'height': '88px',
                        'border-color': '#f0abfc',
                        'border-width': 4,
                        // @ts-ignore
                        'shadow-blur': 40,
                        // @ts-ignore
                        'shadow-color': '#d946ef',
                        // @ts-ignore
                        'shadow-opacity': 0.8,
                    }
                },
                {
                    selector: 'node[type="aggregator"]',
                    style: {
                        'shape': 'hexagon',
                        'background-color': '#facc15',
                        'width': '76px',
                        'height': '76px',
                        'border-color': '#fef08a',
                        'border-width': 3,
                        // @ts-ignore
                        'shadow-blur': 28,
                        // @ts-ignore
                        'shadow-color': '#facc15',
                        // @ts-ignore
                        'shadow-opacity': 0.65,
                    }
                },
                {
                    selector: 'node[type="ring_member"]',
                    style: {
                        'shape': 'ellipse',
                        'background-color': '#f43f5e',
                        'width': '64px',
                        'height': '64px',
                        'border-color': '#fda4af',
                        'border-width': 4,
                        // @ts-ignore
                        'shadow-blur': 32,
                        // @ts-ignore
                        'shadow-color': '#f43f5e',
                        // @ts-ignore
                        'shadow-opacity': 0.75,
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2.5,
                        'line-color': edgeColor,
                        'target-arrow-color': edgeColor,
                        'target-arrow-shape': 'triangle',
                        'curve-style': useStableLayout ? 'haystack' : 'unbundled-bezier', // haystack is simpler/faster
                        'control-point-distances': 20,
                        'control-point-weights': 0.5,
                        'opacity': 0.55,
                        'arrow-scale': 1.1,
                        // @ts-ignore
                        'shadow-blur': 6,
                        // @ts-ignore
                        'shadow-color': edgeColor,
                        // @ts-ignore
                        'shadow-opacity': 0.3,
                        'transition-property': 'control-point-distances, width, line-color, target-arrow-color, arrow-scale, opacity',
                        'transition-duration': 300,
                    }
                },
                {
                    selector: 'edge[?suspicious]', // If edges are marked suspicious
                    style: {
                        'line-color': '#ef4444',
                        'target-arrow-color': '#ef4444',
                        'width': 3,
                        'opacity': 0.9,
                    }
                },
                {
                    selector: 'edge[amount]',
                    style: {
                        'label': 'data(amount)',
                        'font-size': '8px',
                        'text-rotation': 'autorotate',
                        'text-background-color': '#ffffff',
                        'text-background-opacity': 0.8,
                        'text-background-padding': '2px',
                        'color': '#475569',
                    }
                },
                // INTERACTION STATES
                {
                    selector: ':selected',
                    style: {
                        'border-width': 4,
                        'border-color': '#3b82f6', // Blue-500
                        'border-opacity': 1,
                        'background-color': '#2563eb', // Blue-600
                        'text-outline-color': '#1e3a8a',
                    }
                },
                // High-risk pulse class
                {
                    selector: '.high-risk',
                    style: {
                        'border-width': 5,
                        'border-color': '#fb7185', // Rose-400
                        // @ts-ignore
                        'shadow-blur': 28,
                        // @ts-ignore
                        'shadow-color': '#fb7185',
                        // @ts-ignore
                        'shadow-opacity': 0.7,
                        'transition-property': 'border-width, shadow-blur, shadow-opacity',
                        'transition-duration': 400,
                    },
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': '#8b5cf6', // Violet-500
                        'line-color': '#8b5cf6',
                        'target-arrow-color': '#8b5cf6',
                        'transition-property': 'background-color, line-color, target-arrow-color',
                        'transition-duration': 300
                    }
                },
                {
                    selector: '.faded',
                    style: {
                        'opacity': 0.1,
                        'transition-property': 'opacity',
                        'transition-duration': 300
                    }
                },
                // FLEXIBLE HOVER EFFECT FOR EDGES
                {
                    selector: '.edge-hover',
                    style: {
                        'width': 5,
                        'line-color': '#38bdf8', // Light blue highlight
                        'target-arrow-color': '#38bdf8',
                        'arrow-scale': 1.5,
                        'control-point-distances': 60, // Bend significantly
                        'opacity': 1,
                        'z-index': 999,
                        'text-opacity': 1,
                        'font-weight': 'bold',
                        'font-size': '10px'
                    }
                }
            ],
            layout: {
                // Force-directed, organic feel for smaller graphs, circular overview for very dense sets
                name: useStableLayout ? 'concentric' : 'cose',
                animate: !useStableLayout, // Disable animation for large graphs
                animationDuration: 800,
                nodeRepulsion: () => 450000,
                idealEdgeLength: () => 110,
                // @ts-ignore
                gravity: 0.18,
                // @ts-ignore
                numIter: 900,
                padding: 30,
            },
            minZoom: 0.1, // Allow zooming out further
            maxZoom: 5,   // Allow zooming in closer
            wheelSensitivity: 0.5, // More responsive zooming
            pixelRatio: 'auto', // Crisp rendering on high-DPI screens
            textureOnViewport: true, // Smoother panning/zooming
            motionBlur: false, // Clean rendering without blur
        });

        const cy = cyRef.current;

        cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            if (onNodeClick) {
                onNodeClick(node.data());
            }
        });

        cy.on('mouseover', 'node', (evt) => {
            const node = evt.target;
            containerRef.current!.style.cursor = 'pointer';
            setHoveredNode({
                id: node.id(),
                ...node.data()
            });
        });

        cy.on('mouseout', 'node', () => {
            containerRef.current!.style.cursor = 'default';
            setHoveredNode(null);
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
