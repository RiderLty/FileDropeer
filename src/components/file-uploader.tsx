"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { suggestFilename } from "@/ai/flows/suggest-filename";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, File as FileIcon, Sparkles, X, RotateCcw, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileUploaderProps {
  config: {
    token: string;
    backendUrl: string;
  };
  onResetConfig: () => void;
}

export function FileUploader({ config, onResetConfig }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'selected' | 'suggesting' | 'uploading' | 'success' | 'error'>('idle');
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
  
  const getFilenamesFromStorage = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const storedFilenames = localStorage.getItem('filedropzone_filenames');
      return storedFilenames ? JSON.parse(storedFilenames) : [];
    } catch {
      return [];
    }
  };

  const addFilenameToStorage = (newFilename: string) => {
    if (typeof window === 'undefined') return;
    try {
      const existingFilenames = getFilenamesFromStorage();
      const updatedFilenames = [...new Set([...existingFilenames, newFilename])];
      localStorage.setItem('filedropzone_filenames', JSON.stringify(updatedFilenames));
    } catch (e) {
      console.error("Failed to update filenames in local storage", e);
    }
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (selectedFile) {
      handleReset();
      setFile(selectedFile);
      setStatus('suggesting');
      setFilename(selectedFile.name);

      try {
        const existingFilenames = getFilenamesFromStorage().join(', ');
        const suggestion = await suggestFilename({
          fileType: selectedFile.type || 'unknown',
          existingFilenames: existingFilenames,
        });

        if (suggestion.suggestedFilename) {
          setFilename(suggestion.suggestedFilename);
        }
      } catch (e) {
        console.error("AI suggestion failed:", e);
        toast({
          variant: "destructive",
          title: "Suggestion Error",
          description: "Could not get an AI-powered filename suggestion.",
        });
      } finally {
        setStatus('selected');
      }
    }
  }, [handleReset, toast]);

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
        addFilenameToStorage(filename);
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground z-10" onClick={onResetConfig}>
              <Settings className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset Configuration</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
              <p className="text-xs text-muted-foreground">Your files, your cloud, your way.</p>
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
                    <Sparkles className="w-4 h-4 mr-2 text-primary" />
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

            {status === 'suggesting' && (
                <div className="flex items-center text-sm text-muted-foreground">
                    <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                    Getting AI suggestion...
                </div>
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
