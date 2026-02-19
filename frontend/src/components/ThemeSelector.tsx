'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme, THEMES, AppTheme } from '@/components/ThemeProvider';

export function ThemeSelector() {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const current = THEMES.find(t => t.id === theme) ?? THEMES[0];

    // Accent color preview dots per theme
    const accentDot: Record<AppTheme, string> = {
        cyber: 'bg-cyan-400',
        ocean: 'bg-teal-400',
        crimson: 'bg-red-500',
        matrix: 'bg-green-400',
        light: 'bg-blue-500',
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm font-medium hover:bg-accent/30 transition-colors focus:outline-none"
                aria-label="Select theme"
            >
                <Palette className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">{current.emoji} {current.label}</span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in">
                    <div className="px-3 py-2 border-b border-border/40">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Color Theme
                        </p>
                    </div>
                    <ul className="p-1.5 space-y-0.5">
                        {THEMES.map(t => (
                            <li key={t.id}>
                                <button
                                    onClick={() => { setTheme(t.id); setOpen(false); }}
                                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
                    ${theme === t.id
                                            ? 'bg-primary/15 text-foreground'
                                            : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    {/* Color dot preview */}
                                    <span className={`flex-shrink-0 h-3 w-3 rounded-full ${accentDot[t.id]} ring-2 ring-offset-1 ring-offset-card ring-transparent ${theme === t.id ? 'ring-primary/50' : ''}`} />
                                    <div className="flex-1 text-left">
                                        <p className="font-medium text-xs leading-tight">{t.emoji} {t.label}</p>
                                        <p className="text-[10px] text-muted-foreground">{t.description}</p>
                                    </div>
                                    {theme === t.id && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
