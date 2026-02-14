'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Settings,
    Tag,
    Layers,
    Trash2,
    ChevronRight,
    AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpace, useDeleteSpace, useSubspaces, useUpdateSpace } from '@/lib/api/spaces';
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
    const rawId = params.id as string;
    const spaceId = Number.isFinite(Number(rawId)) ? Number(rawId) : undefined;

    const { data: space, isLoading } = useSpace(spaceId as number, user?.id);
    const { data: subspaces, isLoading: subspacesLoading } = useSubspaces(spaceId, user?.id);
    const { mutate: deleteSpace, isPending: isDeleting } = useDeleteSpace();
    const { mutate: updateSpace, isPending: isUpdating } = useUpdateSpace();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [draft, setDraft] = useState<{ spaceId: number | null; name: string; description: string }>({
        spaceId: null,
        name: '',
        description: '',
    });
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const markers = useMemo(() => {
        if (!subspaces?.length) return [];
        const counts = new Map<string, number>();
        for (const subspace of subspaces) {
            for (const marker of subspace.markers || []) {
                const normalized = marker.trim();
                if (!normalized) continue;
                counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
            }
        }
        return [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }, [subspaces]);

    const activeName = space && draft.spaceId === space.id ? draft.name : (space?.name ?? '');
    const activeDescription =
        space && draft.spaceId === space.id ? draft.description : (space?.description ?? '');
    const hasChanges =
        !!space &&
        (activeName.trim() !== space.name || activeDescription.trim() !== (space.description ?? ''));

    const handleDelete = () => {
        if (!user || !spaceId) return;
        deleteSpace(
            { spaceId, userId: user.id },
            {
                onSuccess: () => router.push('/dashboard'),
                onError: () => setShowDeleteDialog(false),
            }
        );
    };

    const handleSave = () => {
        if (!user || !spaceId || !space || !hasChanges) return;
        setSaveMessage(null);
        updateSpace(
            {
                spaceId,
                userId: user.id,
                data: {
                    name: activeName.trim(),
                    description: activeDescription.trim() || null,
                },
            },
            {
                onSuccess: () => setSaveMessage('Saved.'),
                onError: (error) => {
                    const message = error instanceof Error ? error.message : 'Failed to save changes';
                    setSaveMessage(message);
                },
            }
        );
    };

    if (!spaceId) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <h2 className="text-2xl font-semibold">Invalid space</h2>
                <Button className="mt-4" onClick={() => router.push('/dashboard')}>
                    Back to dashboard
                </Button>
            </div>
        );
    }

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
                        {space.name} - Configuration
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Manage topics, markers, and space settings
                    </p>
                </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Layers className="h-4 w-4 text-primary" />
                            Topics
                        </CardTitle>
                        <CardDescription>
                            Semantic clusters auto-generated from your captured artifacts
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {subspacesLoading ? (
                            <div className="space-y-2">
                                {[...Array(3)].map((_, idx) => (
                                    <Skeleton key={idx} className="h-14 w-full" />
                                ))}
                            </div>
                        ) : subspaces && subspaces.length > 0 ? (
                            <div className="space-y-2">
                                {subspaces.map((sub, i) => (
                                    <motion.div
                                        key={sub.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-3 hover:bg-muted/20 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                                                {sub.name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium">{sub.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {sub.artifact_count} artifacts · {Math.round((sub.confidence ?? 0) * 100)}% confidence
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-70" />
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                No topics yet. They will be auto-created as you capture more content.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            Markers
                        </CardTitle>
                        <CardDescription>
                            Marker labels currently associated with this space
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {markers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {markers.map((marker, i) => (
                                    <motion.div
                                        key={marker.label}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.04 }}
                                    >
                                        <Badge variant="outline" className="px-3 py-1.5 text-xs">
                                            {marker.label}
                                            <span className="ml-1.5 text-muted-foreground/70">
                                                {marker.count} topic{marker.count > 1 ? 's' : ''}
                                            </span>
                                        </Badge>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                No markers yet for this space.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

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
                                value={activeName}
                                onChange={(event) => {
                                    setSaveMessage(null);
                                    setDraft({
                                        spaceId: space.id,
                                        name: event.target.value,
                                        description: activeDescription,
                                    });
                                }}
                                className="max-w-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="space-desc">Description</Label>
                            <Input
                                id="space-desc"
                                value={activeDescription}
                                onChange={(event) => {
                                    setSaveMessage(null);
                                    setDraft({
                                        spaceId: space.id,
                                        name: activeName,
                                        description: event.target.value,
                                    });
                                }}
                                placeholder="What is this space about?"
                                className="max-w-sm"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save changes'}
                            </Button>
                            {saveMessage && (
                                <p className="text-xs text-muted-foreground">{saveMessage}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <Separator />

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
                        <CardDescription>Irreversible actions</CardDescription>
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

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Delete &quot;{space.name}&quot;?
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete this space and all its artifacts, topics, and signals.
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
