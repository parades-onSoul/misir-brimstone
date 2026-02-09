'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex max-w-md flex-col items-center text-center"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold">Something went wrong</h1>
                <p className="mt-2 text-muted-foreground">
                    An unexpected error occurred. This has been logged and we&apos;ll look into it.
                </p>
                {error.message && (
                    <code className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {error.message}
                    </code>
                )}
                <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
                        <Home className="mr-2 h-4 w-4" />
                        Dashboard
                    </Button>
                    <Button onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
