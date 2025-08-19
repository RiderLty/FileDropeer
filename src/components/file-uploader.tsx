"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function FileUploader({ config }: FileUploaderProps) {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback((uploadableFile: UploadableFile) => {
    const { id, file } = uploadableFile;

    const setFileStatus = (status: UploadableFile['status'], error?: string | null, progress?: number) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status, error: error ?? f.error, progress: progress ?? f.progress } : f));
    }

    setFileStatus('uploading', null, 0);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setFileStatus('uploading', null, percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setFileStatus('success', null, 100);
      } else {
        setFileStatus('error', `Upload failed. Server responded with: ${xhr.status} ${xhr.statusText}`);
      }
    });

    xhr.addEventListener('error', () => {
      setFileStatus('error', 'A network error occurred. Please check your connection.');
    });

    xhr.open('POST', config.backendUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  }, [config]);

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

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success' && f.status !== 'error'));
  }

  const uploadingFiles = files.filter(f => f.status === 'uploading' || f.status === 'pending');
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
                            <FileProgress key={upload.id} file={upload} onRemove={removeFile} />
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
    const isUploading = status === 'uploading' || status === 'pending';
    const isError = status === 'error';
    const isSuccess = status === 'success';

    return (
        <div className="flex items-center p-3 border rounded-lg bg-muted/30 space-x-4">
            {isSuccess && <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />}
            {isError && <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />}
            {!isSuccess && !isError && <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />}
            
            <div className="flex-grow overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
                <p className="text-xs text-muted-foreground">{(size / 1024 / 1024).toFixed(2)} MB</p>
                
                {isUploading && status !== 'pending' && (
                    <div className="flex items-center gap-2 mt-1">
                        <Progress value={progress} className="w-full h-2" />
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                    </div>
                )}
                {status === 'pending' && <p className="text-xs text-muted-foreground mt-1">Waiting to upload...</p>}
                {isError && (
                    <p className="text-xs text-destructive mt-1 truncate" title={error || 'Unknown error'}>{error || 'Unknown error'}</p>
                )}
            </div>

            <div className="flex-shrink-0">
                {isError && onRetry && (
                    <Button variant="ghost" size="icon" onClick={onRetry} className="h-8 w-8">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onRemove(id)} className="h-8 w-8" disabled={isUploading && status !== 'pending'}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
