'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface BackendStatusProps {
    className?: string;
    showButton?: boolean;
}

export function BackendStatus({ className = '', showButton = false }: BackendStatusProps) {
    const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

    const checkHealth = useCallback(async () => {
        // Don't set 'checking' state synchronously to avoid Effect warning
        // and to prevent flashing state during periodic background checks
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const base = apiUrl.replace(/\/api\/v1$/, '');
            const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
            setStatus(res.ok ? 'online' : 'offline');
        } catch {
            setStatus('offline');
        }
    }, []);

    useEffect(() => {
        // Wrap in requestAnimationFrame to avoid "setState in effect" warning
        // even though checkHealth is async.
        requestAnimationFrame(() => checkHealth());
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <motion.div
                className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-green-500' :
                    status === 'offline' ? 'bg-red-500' :
                        'bg-yellow-500'
                    }`}
                animate={status === 'online' ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] text-muted-foreground" aria-live="polite">
                {status === 'online' ? 'Backend connected' :
                    status === 'offline' ? 'Backend offline' :
                        'Checking...'}
            </span>
            {showButton && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={checkHealth}
                    disabled={status === 'checking'}
                >
                    {status === 'checking' ? 'Checking...' : 'Check backend'}
                </Button>
            )}
        </div>
    );
}
