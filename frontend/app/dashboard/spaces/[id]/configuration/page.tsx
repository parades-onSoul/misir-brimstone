'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Settings,
    Tag,
    Layers,
    Trash2,
    Plus,
    ChevronRight,
    AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useDeleteSpace } from '@/lib/api/spaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function SpaceConfigurationPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const spaceId = parseInt(params.id as string);

    const { data: space, isLoading } = useSpace(spaceId, user?.id);
    const { mutate: deleteSpace, isPending: isDeleting } = useDeleteSpace();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // Mock subspaces and markers for display
    const mockSubspaces = [
        { id: 1, name: 'Core Concepts', artifact_count: 12, confidence: 0.85 },
        { id: 2, name: 'Practical Applications', artifact_count: 8, confidence: 0.62 },
        { id: 3, name: 'Research Papers', artifact_count: 5, confidence: 0.45 },
    ];

    const mockMarkers = [
        { id: 1, label: 'neural-networks', weight: 1.0 },
        { id: 2, label: 'transformer-architecture', weight: 0.8 },
        { id: 3, label: 'optimization', weight: 0.6 },
        { id: 4, label: 'gradient-descent', weight: 0.5 },
    ];

    const handleDelete = () => {
        if (!user) return;
        deleteSpace(spaceId,
            {
                onSuccess: () => router.push('/dashboard'),
                onError: () => setShowDeleteDialog(false),
            }
        );
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!space) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <h2 className="text-2xl font-semibold">Space not found</h2>
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                    Back to dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/dashboard/spaces/${spaceId}`)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        {space.name} — Configuration
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Manage subspaces, markers, and space settings
                    </p>
                </div>
            </div>

            {/* Subspaces */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    Subspaces
                                </CardTitle>
                                <CardDescription>
                                    Semantic clusters auto-generated from your artifacts
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {mockSubspaces.length > 0 ? (
                            <div className="space-y-2">
                                {mockSubspaces.map((sub, i) => (
                                    <motion.div
                                        key={sub.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-3 hover:bg-muted/20 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                                                {sub.name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium">{sub.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {sub.artifact_count} artifacts · {Math.round(sub.confidence * 100)}% confidence
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                No subspaces yet. They&apos;ll be auto-created as you capture more content.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Markers */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-primary" />
                                    Markers
                                </CardTitle>
                                <CardDescription>
                                    Semantic tags for artifact classification
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm">
                                <Plus className="mr-1 h-3 w-3" />
                                Add marker
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {mockMarkers.map((marker, i) => (
                                <motion.div
                                    key={marker.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Badge
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                                    >
                                        {marker.label}
                                        <span className="ml-1.5 text-muted-foreground/60">
                                            {marker.weight.toFixed(1)}
                                        </span>
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Space Settings */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Settings className="h-4 w-4 text-primary" />
                            Space Settings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="space-name">Space name</Label>
                            <Input
                                id="space-name"
                                defaultValue={space.name}
                                className="max-w-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="space-desc">Description</Label>
                            <Input
                                id="space-desc"
                                defaultValue={space.description || ''}
                                placeholder="What's this space about?"
                                className="max-w-sm"
                            />
                        </div>
                        <Button size="sm" disabled>
                            Save changes
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>

            <Separator />

            {/* Danger Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <Card className="border-destructive/20">
                    <CardHeader>
                        <CardTitle className="text-base text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>
                            Irreversible actions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            <Trash2 className="mr-2 h-3 w-3" />
                            Delete this space
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete &quot;{space.name}&quot;?
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete this space and all its artifacts, subspaces, and signals.
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete space'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
