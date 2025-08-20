"use client";

import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { ConfigSetup } from "@/components/config-setup";
import { FileUploader } from "@/components/file-uploader";
import { Button } from '@/components/ui/button';
import { Settings, Moon, Sun } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from "@/hooks/use-toast";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


type Config = {
  token: string;
  backendUrl: string;
};

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isUrlConfigured, setIsUrlConfigured] = useState(false);
  const [theme, setTheme] = useState('dark');
  const { toast } = useToast();

  useEffect(() => {
    // Set theme at the very beginning
    const storedTheme = localStorage.getItem('theme');
    // If no theme is stored, check system preference
    const initialTheme = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    // The inline script in layout.tsx already handles the initial class, but we keep this for reactivity
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');

    setIsClient(true);
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlBackend = urlParams.get('backendUrl');

    if (urlToken && urlBackend) {
      setConfig({ token: urlToken, backendUrl: urlBackend });
      setIsUrlConfigured(true);
    } else {
      try {
        const storedToken = localStorage.getItem('apiToken');
        const storedUrl = localStorage.getItem('backendUrl');
        if (storedToken && storedUrl) {
          setConfig({ token: storedToken, backendUrl: storedUrl });
        }
      } catch (error) {
        console.error("Failed to read from local storage", error);
      }
    }
  }, []);

  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error("Failed to save theme to local storage", error);
    }
  };

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
    if (isUrlConfigured) {
      toast({
        title: "Configuration Locked",
        description: "Configuration is locked by URL parameters.",
        variant: "destructive",
      });
      return;
    }
    
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
          <div className="flex items-center justify-center mt-2">
            <p className="text-muted-foreground">
              Drag, drop, and upload your files with ease and style.
            </p>
            {config && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground h-6 w-6" onClick={handleResetConfig}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset Configuration</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="flex items-center space-x-2 ml-4">
              <Switch
                id="theme-switch"
                checked={theme === 'dark'}
                onCheckedChange={handleThemeChange}
              >
                {theme === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              </Switch>
            </div>
          </div>
        </header>
        
        {config ? (
          <FileUploader config={config} />
        ) : (
          <ConfigSetup onConfigured={handleConfigured} />
        )}
      </div>
      <Toaster />
    </main>
  );
}
