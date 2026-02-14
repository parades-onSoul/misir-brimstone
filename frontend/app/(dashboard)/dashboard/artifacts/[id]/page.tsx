'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    ExternalLink,
    Calendar,
    Tag,
    FileText,
    Edit,
    Trash2,
    Save,
    X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useUpdateArtifact, useDeleteArtifact } from '@/lib/api/capture';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { EngagementLevel } from '@/types/api';

const engagementColors: Record<EngagementLevel, string> = {
    latent: 'bg-neutral-500/20 text-neutral-400',
    discovered: 'bg-blue-500/20 text-blue-400',
    engaged: 'bg-green-500/20 text-green-400',
    saturated: 'bg-purple-500/20 text-purple-400',
};

// Mock artifact fetching - in real app, create useArtifact() hook
function useArtifact(id: string) {
    // This would be a real API call in production
    return {
        data: {
            id,
            title: 'Sample Artifact',
            content: 'This is sample content. In production, this would fetch from the backend.',
            source_url: 'https://example.com',
            source_type: 'web' as const,
            engagement_level: 'discovered' as EngagementLevel,
            timestamp: new Date().toISOString(),
            tags: ['sample', 'test', 'demo'],
        },
        isLoading: false,
    };
}

export default function ArtifactDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { user } = useAuth();
    const { data: artifact, isLoading } = useArtifact(params.id);
    const updateMutation = useUpdateArtifact();
    const deleteMutation = useDeleteArtifact();

    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [editedTags, setEditedTags] = useState('');

    const handleEdit = () => {
        if (artifact) {
            setEditedTitle(artifact.title || '');
            setEditedContent(artifact.content || '');
            setEditedTags(artifact.tags?.join(', ') || '');
            setIsEditing(true);
        }
    };

    const handleSave = async () => {
        if (!artifact || !user) return;

        try {
            await updateMutation.mutateAsync({
                artifactId: parseInt(artifact.id),
                data: {
                    title: editedTitle,
                    content: editedContent,
                },
            });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update artifact:', error);
        }
    };

    const handleDelete = async () => {
        if (!artifact || !user || !confirm('Are you sure you want to delete this artifact?')) return;

        try {
            await deleteMutation.mutateAsync({
                artifactId: parseInt(artifact.id),
            });
            router.push('/dashboard/artifacts');
        } catch (error) {
            console.error('Failed to delete artifact:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-[200px]" />
                <Skeleton className="h-[400px] rounded-lg" />
            </div>
        );
    }

    if (!artifact) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Artifact not found</h3>
                <Link href="/dashboard/artifacts">
                    <Button className="mt-4" variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Artifacts
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/artifacts">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>

                <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <>
                            <Button variant="outline" size="sm" onClick={handleEdit}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(false)}
                            >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Save
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                    <CardHeader>
                        {!isEditing ? (
                            <CardTitle className="text-2xl">
                                {artifact.title || 'Untitled Artifact'}
                            </CardTitle>
                        ) : (
                            <Input
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                placeholder="Artifact title..."
                                className="text-2xl font-semibold"
                            />
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Metadata */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <Badge className={engagementColors[artifact.engagement_level]}>
                                {artifact.engagement_level}
                            </Badge>

                            {artifact.source_url && (
                                <a
                                    href={artifact.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    {new URL(artifact.source_url).hostname}
                                </a>
                            )}

                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                {new Date(artifact.timestamp).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </span>

                            <Badge variant="outline" className="text-sm">
                                {artifact.source_type}
                            </Badge>
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Content
                            </h3>
                            {!isEditing ? (
                                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                        {artifact.content || 'No content available'}
                                    </p>
                                </div>
                            ) : (
                                <textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    placeholder="Artifact content..."
                                    className="w-full min-h-[200px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
                                />
                            )}
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <Tag className="h-4 w-4" />
                                Tags
                            </h3>
                            {!isEditing ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {artifact.tags && artifact.tags.length > 0 ? (
                                        artifact.tags.map((tag) => (
                                            <Badge key={tag} variant="secondary">
                                                {tag}
                                            </Badge>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No tags</p>
                                    )}
                                </div>
                            ) : (
                                <Input
                                    value={editedTags}
                                    onChange={(e) => setEditedTags(e.target.value)}
                                    placeholder="tag1, tag2, tag3..."
                                />
                            )}
                        </div>

                        {/* Source URL */}
                        {artifact.source_url && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium">Source URL</h3>
                                <a
                                    href={artifact.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline break-all"
                                >
                                    {artifact.source_url}
                                </a>
                            </div>
                        )}

                        {/* Timestamp */}
                        <div className="pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                                Captured on{' '}
                                {new Date(artifact.timestamp).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
