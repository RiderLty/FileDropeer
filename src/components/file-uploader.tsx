
"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  config: {
    token: string;
    backendUrl: string;
  };
}

type UploadStatus = 
  | 'pending' 
  | 'connecting'
  | 'authenticating'
  | 'sending_metadata'
  | 'uploading' 
  | 'success' 
  | 'error';

interface UploadableFile {
    id: string;
    file: File;
    progress: number;
    status: UploadStatus;
    error?: string | null;
    ws?: WebSocket;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_CONCURRENT_UPLOADS = 8;

async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export function FileUploader({ config }: FileUploaderProps) {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const setFileState = useCallback((id: string, update: Partial<UploadableFile> | ((currentState: UploadableFile) => Partial<UploadableFile>)) => {
      setFiles(prev => prev.map(f => {
          if (f.id === id) {
              const changes = typeof update === 'function' ? update(f) : update;
              return { ...f, ...changes };
          }
          return f;
      }));
  }, []);

  const handleUpload = useCallback(async (uploadableFile: UploadableFile) => {
    const { id, file } = uploadableFile;
    setFileState(id, { status: 'connecting', progress: 0, error: null });

    let ws: WebSocket;
    try {
        ws = new WebSocket(config.backendUrl);
    } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setFileState(id, { status: 'error', error: "Invalid URL" });
        return;
    }

    setFileState(id, { ws });

    let offset = 0;
    const fileReader = new FileReader();

    const readNextChunk = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = (e) => {
        if (e.target?.result && ws.readyState === WebSocket.OPEN) {
            ws.send(e.target.result as ArrayBuffer);
            offset += (e.target.result as ArrayBuffer).byteLength;
            
            const progress = Math.round((offset / file.size) * 100);
            setFileState(id, { progress });

            if (offset < file.size) {
                readNextChunk();
            }
        }
    };

    fileReader.onerror = () => {
         setFileState(id, { status: 'error', error: "File read error" });
         ws.close();
    };

    ws.onopen = () => {
      console.log(`WebSocket for ${file.name} opened.`);
      // The server will send a challenge, see onmessage.
    };
    
    ws.onmessage = async (event) => {
        const message = event.data as string;
        console.log(`Received: ${message}`);

        if (message.startsWith("challenge:")) {
            setFileState(id, { status: 'authenticating' });
            const challenge = message.substring("challenge:".length);
            const response = await sha256(`${challenge}:${config.token}`);
            ws.send(`auth:${response}`);
        } else if (message === "auth_ok") {
            setFileState(id, { status: 'sending_metadata' });
            // 1. Send header first
            const fileNameBytes = new TextEncoder().encode(file.name);
            const header = new ArrayBuffer(4 + fileNameBytes.length + 8);
            const view = new DataView(header);
            view.setInt32(0, fileNameBytes.length, false); // big-endian
            new Uint8Array(header, 4, fileNameBytes.length).set(fileNameBytes);
            view.setBigInt64(4 + fileNameBytes.length, BigInt(file.size), false);
            ws.send(header);
        } else if (message === "header_ok") {
            setFileState(id, { status: 'uploading' });
            readNextChunk(); // Start sending file content
        } else if (message.startsWith("upload_ok:")) {
            setFileState(id, { status: 'success', progress: 100 });
            ws.close();
        } else if (message.startsWith("auth_error:")) {
            setFileState(id, { status: 'error', error: "Authentication failed" });
            ws.close();
        } else if (message.startsWith("header_error:")) {
            setFileState(id, { status: 'error', error: "Invalid header" });
            ws.close();
        } else if (message.startsWith("upload_error:")) {
            setFileState(id, { status: 'error', error: "Upload failed" });
            ws.close();
        } else if (message.startsWith("error:")) {
            setFileState(id, { status: 'error', error: "Server error" });
            ws.close();
        }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      setFileState(id, { status: 'error', error: "Connection failed" });
    };

    ws.onclose = (event) => {
      console.log(`WebSocket for ${file.name} closed. Code: ${event.code}`);
      setFileState(id, (currentState) => {
          if (currentState.status !== 'success' && currentState.status !== 'error') {
              return { status: 'error', error: 'Connection lost' };
          }
          return {};
      });
    };

  }, [config.backendUrl, config.token, setFileState]);
  
    useEffect(() => {
        const activeUploads = files.filter(f => ['connecting', 'authenticating', 'sending_metadata', 'uploading'].includes(f.status)).length;
        const pendingFiles = files.filter(f => f.status === 'pending');

        if (activeUploads < MAX_CONCURRENT_UPLOADS && pendingFiles.length > 0) {
            const filesToStart = pendingFiles.slice(0, MAX_CONCURRENT_UPLOADS - activeUploads);
            filesToStart.forEach(file => handleUpload(file));
        }
    }, [files, handleUpload]);


  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (selectedFiles && selectedFiles.length > 0) {
        const newUploads: UploadableFile[] = Array.from(selectedFiles).map(file => ({
            id: generateId(),
            file,
            progress: 0,
            status: 'pending'
        }));

        setFiles(prev => [...prev, ...newUploads]);
    }
  }, []);
  
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
        if (fileToCancel?.ws) {
          fileToCancel.ws.close();
        }
        return prev.filter(f => f.id !== id);
      });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }
  
  const clearAll = () => {
    // We only want to keep pending and uploading files
    const filesToKeep = files.filter(f => f.status === 'pending' || f.status === 'uploading' || f.status === 'connecting' || f.status === 'authenticating' || f.status === 'sending_metadata');
    setFiles(filesToKeep);
  }

  const uploadingFiles = files.filter(f => ['pending', 'connecting', 'authenticating', 'sending_metadata', 'uploading'].includes(f.status));
  const errorFiles = files.filter(f => f.status === 'error');
  const successFiles = files.filter(f => f.status === 'success');

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
                            <FileProgress key={upload.id} file={upload} onCancel={() => cancelUpload(upload.id)} />
                        ))}
                    </div>
                )}
                
                {errorFiles.length > 0 && (
                     <div className="space-y-2">
                        <h3 className="text-lg font-medium text-destructive">Error</h3>
                        {errorFiles.map(upload => (
                             <FileProgress key={upload.id} file={upload} onRemove={removeFile} onRetry={() => handleUpload({ ...upload, status: 'pending' })} />
                        ))}
                    </div>
                )}

                {successFiles.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                             <h3 className="text-lg font-medium text-green-600">Completed</h3>
                             {(errorFiles.length > 0 || successFiles.length > 0) && (
                                <Button variant="ghost" size="sm" onClick={clearAll}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </Button>
                             )}
                        </div>
                        <div className="space-y-2">
                            {successFiles.map(upload => (
                                <FileProgress key={upload.id} file={upload} onRemove={removeFile} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

      </CardContent>
    </Card>
  );
}


function FileProgress({ file, onCancel, onRemove, onRetry }: { 
    file: UploadableFile, 
    onCancel?: (id: string) => void, 
    onRemove?: (id: string) => void, 
    onRetry?: () => void 
}) {
    const { id, status, progress, error } = file;
    const { name, size } = file.file;
    const isProcessing = ['pending', 'connecting', 'authenticating', 'sending_metadata', 'uploading'].includes(status);
    const isError = status === 'error';
    const isSuccess = status === 'success';

    const getStatusText = () => {
        switch (status) {
            case 'connecting': return 'Connecting...';
            case 'authenticating': return 'Authenticating...';
            case 'sending_metadata': return 'Sending metadata...';
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
            {isProcessing && <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />}
            
            <div className="flex-grow overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
                <div className='flex items-center space-x-2'>
                    <p className="text-xs text-muted-foreground">{(size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className={cn("text-xs mt-1 truncate", 
                        isSuccess && 'text-green-600', 
                        isError && 'text-destructive',
                        isProcessing && 'text-muted-foreground'
                    )} title={error || ''}>
                        {getStatusText()}
                    </p>
                </div>
                
                {status === 'uploading' && (
                    <Progress value={progress} className="h-1 mt-1" />
                )}
            </div>

            <div className="flex-shrink-0">
                {isProcessing && onCancel && (
                     <Button variant="ghost" size="icon" onClick={() => onCancel(id)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
                {isError && onRetry && (
                    <Button variant="ghost" size="icon" onClick={() => onRetry()} className="h-8 w-8">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
                 {isError && onRemove && (
                    <Button variant="ghost" size="icon" onClick={() => onRemove(id)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
                {isSuccess && onRemove && (
                     <Button variant="ghost" size="icon" onClick={() => onRemove(id)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}

    
