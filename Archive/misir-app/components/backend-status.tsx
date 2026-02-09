'use client';

/**
 * BackendStatus Component
 * 
 * Shows connection status to the FastAPI backend.
 */

import { useBackendStatus } from '@/lib/hooks/use-backend';
import { cn } from '@/lib/utils';

interface BackendStatusProps {
    className?: string;
    showUrl?: boolean;
}

export function BackendStatus({ className, showUrl = false }: BackendStatusProps) {
    const { isConnected, isLoading, backendUrl, error } = useBackendStatus();

    if (isLoading) {
        return (
            <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                <span>Checking backend...</span>
            </div>
        );
    }

    return (
        <div 
            className={cn('flex items-center gap-2 text-sm', className)}
            title={error || backendUrl}
        >
            <div 
                className={cn(
                    'h-2 w-2 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                )} 
            />
            <span className={isConnected ? 'text-muted-foreground' : 'text-red-500'}>
                {isConnected ? 'Backend connected' : 'Backend offline'}
            </span>
            {showUrl && (
                <span className="text-xs text-muted-foreground">
                    ({backendUrl})
                </span>
            )}
        </div>
    );
}
