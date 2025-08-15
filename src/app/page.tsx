"use client";

import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { ConfigSetup } from "@/components/config-setup";
import { FileUploader } from "@/components/file-uploader";

type Config = {
  token: string;
  backendUrl: string;
};

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const storedToken = localStorage.getItem('apiToken');
      const storedUrl = localStorage.getItem('backendUrl');
      if (storedToken && storedUrl) {
        setConfig({ token: storedToken, backendUrl: storedUrl });
      }
    } catch (error) {
      console.error("Failed to read from local storage", error);
    }
  }, []);

  const handleConfigured = (newConfig: Config) => {
    try {
      localStorage.setItem('apiToken', newConfig.token);
      localStorage.setItem('backendUrl', newConfig.backendUrl);
      setConfig(newConfig);
    } catch (error) {
       console.error("Failed to save to local storage", error);
    }
  };
  
  const handleResetConfig = () => {
    try {
      localStorage.removeItem('apiToken');
      localStorage.removeItem('backendUrl');
      setConfig(null);
    } catch (error) {
      console.error("Failed to clear local storage", error);
    }
  }

  if (!isClient) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background text-foreground">
        <div className="w-full max-w-2xl mx-auto animate-pulse">
            <div className="h-16 bg-muted rounded-lg w-1/2 mx-auto mb-8"></div>
            <div className="h-96 bg-muted rounded-lg w-full"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-background text-foreground transition-colors duration-500">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-primary font-headline">FileDrop Zone</h1>
          <p className="text-muted-foreground mt-2">
            Drag, drop, and upload your files with ease and style.
          </p>
        </header>
        
        {config ? (
          <FileUploader config={config} onResetConfig={handleResetConfig} />
        ) : (
          <ConfigSetup onConfigured={handleConfigured} />
        )}
      </div>
      <Toaster />
    </main>
  );
}
