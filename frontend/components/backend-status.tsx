'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface BackendStatusProps {
    className?: string;
}

export function BackendStatus({ className = '' }: BackendStatusProps) {
    const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const base = apiUrl.replace(/\/api\/v1$/, '');
                const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
                setStatus(res.ok ? 'online' : 'offline');
            } catch {
                setStatus('offline');
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <motion.div
                className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-green-500' :
                    status === 'offline' ? 'bg-red-500' :
                        'bg-yellow-500'
                    }`}
                animate={status === 'online' ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] text-muted-foreground">
                {status === 'online' ? 'Backend connected' :
                    status === 'offline' ? 'Backend offline' :
                        'Checking...'}
            </span>
        </div>
    );
}
