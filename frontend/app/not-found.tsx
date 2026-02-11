import { Compass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <div className="flex max-w-md flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Compass className="h-8 w-8 text-primary" />
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight">404</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    This page doesn&apos;t exist — looks like you&apos;ve drifted off course.
                </p>
                <Button asChild className="mt-6">
                    <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
}
