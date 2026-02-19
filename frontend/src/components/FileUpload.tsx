'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils'; // correctly imported

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            setError(null);
            if (acceptedFiles.length > 0) {
                const file = acceptedFiles[0];
                if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                    setError('Please upload a valid CSV file.');
                    return;
                }
                setSelectedFile(file);
                onFileSelect(file);
            }
        },
        [onFileSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
        },
        maxFiles: 1,
    });

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedFile(null);
        setError(null);
    };

    return (
        <Card className="w-full max-w-md mx-auto mt-8 border-dashed border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-0">
                <div
                    {...getRootProps()}
                    className={cn(
                        'flex flex-col items-center justify-center p-10 cursor-pointer transition-colors',
                        isDragActive ? 'bg-primary/5' : 'bg-background'
                    )}
                >
                    <input {...getInputProps()} />
                    {selectedFile ? (
                        <div className="flex items-center gap-4 bg-muted p-4 rounded-lg w-full relative group">
                            <File className="h-8 w-8 text-primary" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {selectedFile.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                                onClick={removeFile}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <UploadCloud className="h-8 w-8 text-primary" />
                            </div>
                            <p className="text-lg font-semibold mb-1">
                                {isDragActive ? 'Drop the CSV here' : 'Upload Transaction CSV'}
                            </p>
                            <p className="text-sm text-muted-foreground text-center mb-4">
                                Drag & drop or click to select
                            </p>
                            <Button variant="secondary" size="sm">
                                Select File
                            </Button>
                        </>
                    )}
                    {error && (
                        <p className="text-sm text-destructive mt-4 font-medium">{error}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
