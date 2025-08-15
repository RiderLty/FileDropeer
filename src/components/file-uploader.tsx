"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, File as FileIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  config: {
    token: string;
    backendUrl: string;
  };
}

export function FileUploader({ config }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'selected' | 'uploading' | 'success' | 'error'>('idle');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleReset = useCallback(() => {
    setFile(null);
    setIsDragging(false);
    setUploadProgress(0);
    setStatus('idle');
    setFilename('');
    setError(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }, []);
  
  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile) {
      handleReset();
      setFile(selectedFile);
      setFilename(selectedFile.name);
      setStatus('selected');
    }
  }, [handleReset]);
  
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (status !== 'idle') return;

      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              handleFileSelect(blob);
              break; 
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [status, handleFileSelect]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (status !== 'uploading') setIsDragging(true);
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
    if (status !== 'uploading' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file || !filename) return;

    setStatus('uploading');
    setUploadProgress(0);
    setError(null);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const newFile = new File([file], filename, { type: file.type });
    formData.append('file', newFile);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(`Upload failed. Server responded with: ${xhr.status} ${xhr.statusText}`);
      }
    });

    xhr.addEventListener('error', () => {
      setStatus('error');
      setError('A network error occurred. Please check your connection and try again.');
    });

    xhr.open('POST', config.backendUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${config.token}`);
    xhr.send(formData);
  };

  return (
    <Card className="w-full shadow-lg relative overflow-hidden border-border animate-in fade-in-50 zoom-in-95 duration-500">
      <CardContent className="p-6">
        {status === 'idle' && (
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300",
              isDragging ? "border-primary bg-secondary" : "border-border hover:border-primary/50 hover:bg-muted"
            )}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <UploadCloud className={cn("w-12 h-12 mb-4 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
              <p className="mb-2 text-lg font-semibold">
                <span className="text-primary">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">You can also paste an image from your clipboard. Your files, your cloud, your way.</p>
            </div>
            <input ref={fileInputRef} type="file" onChange={onFileChange} className="hidden" />
          </div>
        )}

        {status !== 'idle' && file && (
          <div className="space-y-4 animate-in fade-in-0 duration-300">
            <div className="flex items-center p-4 border rounded-lg bg-muted/30">
              <FileIcon className="h-10 w-10 text-primary mr-4 flex-shrink-0" />
              <div className="flex-grow overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleReset} className="ml-4 flex-shrink-0" disabled={status === 'uploading'}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
                <label htmlFor="filename" className="text-sm font-medium flex items-center">
                    Filename
                </label>
                <Input 
                    id="filename"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={status === 'uploading' || status === 'success'}
                    className="font-mono"
                />
            </div>

            {status === 'selected' && (
                <Button onClick={handleUpload} className="w-full">
                    Upload File
                </Button>
            )}
            
            {status === 'uploading' && (
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">{uploadProgress}%</p>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {status === 'success' && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Upload Complete!</AlertTitle>
                <AlertDescription>Your file has been successfully uploaded.</AlertDescription>
                <Button onClick={handleReset} variant="outline" className="w-full mt-4">Upload Another File</Button>
              </Alert>
            )}

            {status === 'error' && error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Upload Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button onClick={handleReset} variant="outline" className="w-full mt-4">Try Again</Button>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
