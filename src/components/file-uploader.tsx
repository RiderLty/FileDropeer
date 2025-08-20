"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

interface FileUploaderProps {
  config: {
    token: string;
    backendUrl: string;
  };
}

interface UploadableFile {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error' | 'connecting';
    error?: string | null;
    controller?: AbortController;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

export function FileUploader({ config }: FileUploaderProps) {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const handleUpload = useCallback(async (uploadableFile: UploadableFile) => {
    const { id, file } = uploadableFile;
    const controller = new AbortController();
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'connecting', progress: 0, controller } : f));

    let ws: WebSocket;
    try {
        ws = new WebSocket(config.backendUrl);
    } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: "Invalid WebSocket URL." } : f));
        return;
    }

    ws.onopen = async () => {
      // Send auth token as the first message
      ws.send(`Bearer ${config.token}`);

      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading' } : f));
      
      try {
        // 1. Send header first
        const fileNameBytes = new TextEncoder().encode(file.name);
        const header = new ArrayBuffer(4 + fileNameBytes.length + 8);
        const view = new DataView(header);
        view.setInt32(0, fileNameBytes.length, false); // big-endian
        new Uint8Array(header, 4, fileNameBytes.length).set(fileNameBytes);
        view.setBigInt64(4 + fileNameBytes.length, BigInt(file.size), false);
        ws.send(header);

        // 2. Send file content in chunks
        let offset = 0;
        const fileReader = new FileReader();

        fileReader.onload = (e) => {
            if (e.target?.result && ws.readyState === WebSocket.OPEN) {
                ws.send(e.target.result as ArrayBuffer);
                offset += (e.target.result as ArrayBuffer).byteLength;
                
                const progress = Math.round((offset / file.size) * 100);
                setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));

                if (offset < file.size) {
                    readNextChunk();
                }
            }
        };

        fileReader.onerror = () => {
             setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: "File read error" } : f));
             ws.close();
        };

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            fileReader.readAsArrayBuffer(slice);
        };
        
        readNextChunk();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown upload error occurred.';
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: errorMessage } : f));
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
    
    ws.onmessage = (event) => {
        if (event.data.startsWith("Error: Authentication failed")) {
             setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: "Authentication failed. Check your token." } : f));
        } else {
            console.log("Message from server: ", event.data);
            setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'success', progress: 100 } : f));
        }
        ws.close();
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: "Connection to server failed." } : f));
    };

    ws.onclose = () => {
      console.log(`WebSocket for ${file.name} closed.`);
      // Check if it's still uploading - if so, it was an unexpected closure.
      setFiles(prev => prev.map(f => {
        if (f.id === id && f.status === 'uploading') {
          return { ...f, status: 'error', error: 'Connection lost unexpectedly.' };
        }
        return f;
      }));
    };
    
    controller.signal.addEventListener('abort', () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: 'Upload cancelled' } : f));
    });

  }, [config.backendUrl, config.token, toast]);

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (selectedFiles && selectedFiles.length > 0) {
        const newUploads: UploadableFile[] = Array.from(selectedFiles).map(file => ({
            id: generateId(),
            file,
            progress: 0,
            status: 'pending'
        }));

        setFiles(prev => [...prev, ...newUploads]);
        newUploads.forEach(handleUpload);
    }
  }, [handleUpload]);
  
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (items) {
        const fileItems = Array.from(items).filter(item => item.kind === 'file');
        if(fileItems.length > 0) {
            const files = fileItems.map(item => item.getAsFile()).filter(Boolean) as File[];
            const fileList = new DataTransfer();
            files.forEach(file => fileList.items.add(file));
            handleFileSelect(fileList.files);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handleFileSelect]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
        e.dataTransfer.clearData();
    }
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const cancelUpload = (id: string) => {
      setFiles(prev => {
        const fileToCancel = prev.find(f => f.id === id);
        if (fileToCancel?.controller) {
          fileToCancel.controller.abort();
        }
        // The abort listener will update the file's state
        return prev;
      });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success' && f.status !== 'error'));
  }

  const uploadingFiles = files.filter(f => f.status === 'uploading' || f.status === 'pending' || f.status === 'connecting');
  const finishedFiles = files.filter(f => f.status === 'success' || f.status === 'error');

  return (
    <Card className="w-full shadow-lg relative overflow-hidden border-border animate-in fade-in-50 zoom-in-95 duration-500">
      <CardContent className="p-6 space-y-4">
        <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300",
              isDragging ? "border-primary bg-secondary" : "border-border hover:border-primary/50 hover:bg-muted"
            )}
        >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <UploadCloud className={cn("w-10 h-10 mb-3 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
              <p className="mb-2 text-md font-semibold">
                <span className="text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">You can also paste images from your clipboard.</p>
            </div>
            <input ref={fileInputRef} type="file" onChange={onFileChange} className="hidden" multiple />
        </div>
        
        {files.length > 0 && (
            <div className="space-y-4">
                {uploadingFiles.length > 0 && (
                     <div className="space-y-2">
                        <h3 className="text-lg font-medium">Uploading...</h3>
                        {uploadingFiles.map(upload => (
                            <FileProgress key={upload.id} file={upload} onRemove={() => cancelUpload(upload.id)} />
                        ))}
                    </div>
                )}

                {finishedFiles.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                             <h3 className="text-lg font-medium">Completed</h3>
                             <Button variant="ghost" size="sm" onClick={clearCompleted}>
                                 <Trash2 className="mr-2 h-4 w-4" />
                                 Clear All
                             </Button>
                        </div>
                        <ScrollArea className="h-40 w-full pr-4">
                            <div className="space-y-2">
                                {finishedFiles.map(upload => (
                                    <FileProgress key={upload.id} file={upload} onRemove={removeFile} onRetry={() => handleUpload(upload)} />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        )}

      </CardContent>
    </Card>
  );
}


function FileProgress({ file, onRemove, onRetry }: { file: UploadableFile, onRemove: (id: string) => void, onRetry?: () => void }) {
    const { id, status, progress, error } = file;
    const { name, size } = file.file;
    const isProcessing = status === 'uploading' || status === 'pending' || status === 'connecting';
    const isError = status === 'error';
    const isSuccess = status === 'success';

    const getStatusText = () => {
        switch (status) {
            case 'connecting': return 'Connecting...';
            case 'pending': return 'Waiting to upload...';
            case 'uploading': return `Uploading... ${progress}%`;
            case 'success': return 'Upload complete.';
            case 'error': return error || 'Unknown error';
            default: return '';
        }
    }

    return (
        <div className="flex items-center p-3 border rounded-lg bg-muted/30 space-x-4">
            {isSuccess && <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />}
            {isError && <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />}
            {!isSuccess && !isError && <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />}
            
            <div className="flex-grow overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
                <div className='flex items-center space-x-2'>
                    <p className="text-xs text-muted-foreground">{(size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className={cn("text-xs mt-1 truncate", 
                        isSuccess && 'text-green-600', 
                        isError && 'text-destructive'
                    )} title={error || ''}>
                        {getStatusText()}
                    </p>
                </div>
                
                {isProcessing && (
                    <Progress value={progress} className="h-1 mt-1" />
                )}
            </div>

            <div className="flex-shrink-0">
                {isError && onRetry && (
                    <Button variant="ghost" size="icon" onClick={() => onRetry()} className="h-8 w-8">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onRemove(id)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
