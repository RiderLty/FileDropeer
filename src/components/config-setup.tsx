"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, Server } from "lucide-react";

const formSchema = z.object({
  token: z.string().min(1, { message: "API Token is required." }),
  backendUrl: z.string().url({ message: "Please enter a valid URL." }),
});

type Config = z.infer<typeof formSchema>;

interface ConfigSetupProps {
  onConfigured: (config: Config) => void;
}

export function ConfigSetup({ onConfigured }: ConfigSetupProps) {
  const form = useForm<Config>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: "",
      backendUrl: "",
    },
  });

  function onSubmit(values: Config) {
    onConfigured(values);
  }

  return (
    <Card className="w-full shadow-lg border-primary/20 animate-in fade-in-50 zoom-in-95 duration-500">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Initial Setup</CardTitle>
        <CardDescription>
          Provide your API token and backend URL to start uploading files.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Token</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Enter your API token" type="password" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="backendUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Backend URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Server className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="https://your-backend.com/upload" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              Save Configuration
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
