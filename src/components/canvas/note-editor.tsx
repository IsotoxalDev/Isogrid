"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Cloud, Check, Loader2, Settings, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { BoardSettings } from '@/lib/types';
// Removed unused debounce hook import as we used setTimeout


interface NoteEditorProps {
    initialContent: string;
    initialTitle?: string;
    onSave: (content: string, title: string) => void;
    onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ initialContent, initialTitle = 'Untitled Note', onSave, onClose }) => {
    const [title, setTitle] = useState(initialTitle);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // Settings with localStorage
    const [settings, setSettings] = useState<BoardSettings>(() => {
        // Try to load from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('noteEditorSettings');
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved settings:', e);
                }
            }
        }
        // Default settings
        return {
            showGrid: true,
            gridStyle: 'dots',
            gridOpacity: 0.15,
            accentColor: '223 57% 63%',
            defaultOpacity: 1,
            defaultBackgroundBlur: 0,
            vignetteIntensity: 0
        };
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Ref to track if we need to save title
    const titleRef = useRef(initialTitle);

    // Initialize Quill
    useEffect(() => {
        if (containerRef.current && !quillRef.current) {
            // Create toolbar container
            // We will mount toolbar in the DOM separate from editor? 
            // Quill allows specifying a container for toolbar.

            quillRef.current = new Quill(containerRef.current, {
                theme: 'snow',
                modules: {
                    toolbar: '#toolbar-container',
                },
                placeholder: 'Start typing...',
            });

            // Set initial content
            if (initialContent) {
                quillRef.current.clipboard.dangerouslyPasteHTML(initialContent);
            }

            // Track changes
            quillRef.current.on('text-change', () => {
                setSaveStatus('unsaved');
                triggerAutoSave();
            });
        }
    }, []);

    const triggerAutoSave = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setSaveStatus('saving');

        saveTimeoutRef.current = setTimeout(() => {
            if (quillRef.current) {
                const content = quillRef.current.root.innerHTML;
                onSave(content, titleRef.current);
                setSaveStatus('saved');
            }
        }, 1000);
    }, [onSave]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        titleRef.current = newTitle;
        setSaveStatus('unsaved');
        triggerAutoSave();
    };

    const handleBack = () => {
        // Force save before close if needed, but autosave should catch it. 
        // We will do one last save to be sure.
        if (quillRef.current) {
            onSave(quillRef.current.root.innerHTML, titleRef.current);
        }
        onClose();
    };

    const gridBackgroundImage = settings.gridStyle === 'dots'
        ? `radial-gradient(hsl(var(--muted-foreground) / ${settings.gridOpacity}) 1px, transparent 0)`
        : `linear-gradient(hsl(var(--muted-foreground) / ${settings.gridOpacity}) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground) / ${settings.gridOpacity}) 1px, transparent 1px)`;

    const handleSettingsChange = (newSettings: Partial<BoardSettings>) => {
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('noteEditorSettings', JSON.stringify(updatedSettings));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-transparent animate-in fade-in duration-200">
            {/* Dark Background */}
            <div className="fixed inset-0 bg-[#151515] -z-10" />

            {/* Navbar */}
            <div className="absolute top-0 left-0 right-0 h-16 flex items-center px-4 justify-between z-20 bg-transparent pointer-events-none">
                <div className="flex items-center gap-4 flex-1 pointer-events-auto">
                    <Button variant="ghost" size="icon" onClick={handleBack} className="text-gray-400 hover:text-white hover:bg-white/10">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Input
                        value={title}
                        onChange={handleTitleChange}
                        className="border-0 p-0 h-auto text-lg font-medium focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-white/10 rounded px-2 -ml-2 w-[300px] bg-transparent text-gray-100 placeholder:text-gray-600"
                        placeholder="Untitled Note"
                    />
                </div>
                {/* Settings Popover */}
                <div className="pointer-events-auto">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-white hover:bg-white/10"
                            >
                                <Settings className="w-5 h-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 z-[100]">
                            <div className="grid gap-4">
                                <h4 className="font-medium leading-none">Grid Settings</h4>

                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Show Grid</label>
                                    <button
                                        onClick={() => handleSettingsChange({ showGrid: !settings.showGrid })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.showGrid ? 'bg-primary' : 'bg-input'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${settings.showGrid ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className={!settings.showGrid ? 'opacity-50 pointer-events-none' : ''}>
                                    <div className="grid gap-2">
                                        <label className="text-sm font-medium">Style</label>
                                        <div className="flex space-x-4">
                                            <button
                                                onClick={() => handleSettingsChange({ gridStyle: 'dots' })}
                                                className={`flex items-center space-x-2 ${settings.gridStyle === 'dots' ? 'text-primary' : 'text-muted-foreground'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 ${settings.gridStyle === 'dots' ? 'border-primary bg-primary' : 'border-input'}`}>
                                                    {settings.gridStyle === 'dots' && <div className="w-2 h-2 rounded-full bg-primary-foreground m-auto mt-0.5" />}
                                                </div>
                                                <span className="text-sm">Dots</span>
                                            </button>
                                            <button
                                                onClick={() => handleSettingsChange({ gridStyle: 'lines' })}
                                                className={`flex items-center space-x-2 ${settings.gridStyle === 'lines' ? 'text-primary' : 'text-muted-foreground'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 ${settings.gridStyle === 'lines' ? 'border-primary bg-primary' : 'border-input'}`}>
                                                    {settings.gridStyle === 'lines' && <div className="w-2 h-2 rounded-full bg-primary-foreground m-auto mt-0.5" />}
                                                </div>
                                                <span className="text-sm">Lines</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-2 mt-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium">Grid Opacity</label>
                                            <span className="text-xs text-muted-foreground">{Math.round((settings.gridOpacity || 0.15) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={settings.gridOpacity || 0.15}
                                            onChange={(e) => handleSettingsChange({ gridOpacity: parseFloat(e.target.value) })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-2">
                                    <h4 className="font-medium leading-none text-sm">Data</h4>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="w-full text-xs"
                                            size="sm"
                                            onClick={() => {
                                                // Placeholder for import functionality
                                                console.log('Import clicked');
                                            }}
                                        >
                                            Import from JSON
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full text-xs"
                                            size="sm"
                                            onClick={() => {
                                                // Placeholder for export functionality
                                                console.log('Export clicked');
                                            }}
                                        >
                                            Export to JSON
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <Button
                                    variant="ghost"
                                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                        // Sign out functionality
                                        if (typeof window !== 'undefined') {
                                            window.location.href = '/login';
                                        }
                                    }}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Floating Toolbar Area */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none">
                <div id="toolbar-container" className="pointer-events-auto bg-[#151515]/90 backdrop-blur-md border border-[#333] rounded-md p-2 shadow-2xl flex items-center gap-1">
                    {/* Quill inserts toolbar items here */}
                    <span className="ql-formats">
                        <select className="ql-header"></select>
                        <select className="ql-font"></select>
                    </span>
                    <div className="w-px h-8 bg-[#333] mx-2" />
                    <span className="ql-formats">
                        <button className="ql-bold"></button>
                        <button className="ql-italic"></button>
                        <button className="ql-underline"></button>
                        <button className="ql-strike"></button>
                    </span>
                    <div className="w-px h-8 bg-[#333] mx-2" />
                    <span className="ql-formats">
                        <button className="ql-list" value="ordered"></button>
                        <button className="ql-list" value="bullet"></button>
                    </span>
                    <div className="w-px h-8 bg-[#333] mx-2" />
                    <span className="ql-formats">
                        <button className="ql-link"></button>
                        <button className="ql-image"></button>
                    </span>
                    <div className="w-px h-8 bg-[#333] mx-2" />
                    <span className="ql-formats">
                        <button className="ql-clean"></button>
                    </span>
                </div>
            </div>

            {/* Editor Content Area (Dark background, Page centered) */}
            <div
                className="flex-1 overflow-y-auto w-full flex justify-center p-8 pt-24 cursor-text relative"
                style={{
                    backgroundColor: '#151515',
                    backgroundImage: settings.showGrid ? gridBackgroundImage : 'none',
                    backgroundSize: '40px 40px',
                    backgroundPosition: '0 0'
                }}
                onClick={() => quillRef.current?.focus()}
            >
                <div
                    className="bg-[#2a2a2a] shadow-lg min-h-[1100px] h-fit w-[816px] mx-auto p-12 relative text-gray-100 rounded-sm" // A4 Dimensions approx
                    onClick={(e) => e.stopPropagation()} // Don't focus if clicking margins
                >
                    <div ref={containerRef} className="font-serif" />
                </div>
            </div>

            <style jsx global>{`
        .ql-toolbar {
          border: none !important;
          font-family: inherit !important;
          padding: 0 !important;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ql-formats {
           display: flex !important;
           align-items: center;
           margin-right: 0 !important;
        }
        
        /* Ensure buttons have size and visibility */
        .ql-toolbar button {
            width: 36px !important;
            height: 36px !important;
            display: flex !important;
            align-items: center;
            justify-content: center;
            padding: 0 !important;
            float: none !important;
            margin: 0 2px !important;
        }
        .ql-toolbar button svg {
            width: 20px !important;
            height: 20px !important;
        }

        .ql-container.ql-snow {
          border: none !important;
          font-size: 16px; 
          font-family: 'Times New Roman', serif;
          height: auto !important;
          position: relative !important;
        }
        
        .ql-container {
            height: auto !important;
        }
        
        .ql-editor {
            padding: 0 !important;
            min-height: 1000px !important;
            height: auto !important;
            overflow-y: hidden !important;
            padding-bottom: 100px !important; 
        }
        .ql-editor p {
            margin-bottom: 1em;
            line-height: 1.6;
        }
        .ql-editor h1, .ql-editor h2, .ql-editor h3 {
             margin-top: 1.5em;
             margin-bottom: 0.5em;
             font-weight: 600;
        }

        /* Dark Mode Quill Toolbar Overrides */
        .ql-snow .ql-stroke { stroke: #a3a3a3 !important; }
        .ql-snow .ql-fill   { fill: #a3a3a3 !important; }
        .ql-snow .ql-picker { color: #a3a3a3 !important; }
        .ql-snow .ql-picker { color: #a3a3a3 !important; }
        .ql-snow .ql-picker-options { 
            background-color: #2a2a2a !important; 
            color: #e5e5e5 !important; 
            border-color: #404040 !important;
            top: auto !important;
            bottom: 100% !important;
            margin-bottom: 10px; /* Slight gap */
            max-height: 200px;
            overflow-y: auto;
        }
        .ql-snow .ql-picker-item:hover { color: hsl(var(--accent)) !important; }
        .ql-snow .ql-picker-item.ql-selected { color: hsl(var(--accent)) !important; font-weight: bold; }
        .ql-snow .ql-picker.ql-expanded .ql-picker-label { color: hsl(var(--accent)) !important; }
        .ql-snow .ql-picker-label:hover { color: hsl(var(--accent)) !important; }
        .ql-snow .ql-picker-label.ql-active { color: hsl(var(--accent)) !important; }
        
        /* Hover states for toolbar buttons */
        .ql-toolbar button:hover {
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        .ql-toolbar button:hover .ql-stroke { stroke: #fff !important; }
        .ql-toolbar button:hover .ql-fill { fill: #fff !important; }

        /* Active state using Accent Color */
        .ql-toolbar button.ql-active {
            background-color: hsl(var(--accent)) !important;
            border-radius: 4px;
        }
        .ql-toolbar button.ql-active .ql-stroke { stroke: hsl(var(--accent-foreground)) !important; }
        .ql-toolbar button.ql-active .ql-fill { fill: hsl(var(--accent-foreground)) !important; }
      `}</style>
        </div>
    );
};

export default NoteEditor;
