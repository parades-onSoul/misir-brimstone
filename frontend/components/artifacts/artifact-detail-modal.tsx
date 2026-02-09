'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Clock, Globe, BookOpen, Eye } from 'lucide-react';
import type { Artifact } from '@/types/api';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ArtifactDetailModalProps {
    artifact: Artifact | null;
    open: boolean;
    onClose: () => void;
}

const engagementColors: Record<string, string> = {
    ambient: 'bg-gray-500/10 text-gray-400',
    engaged: 'bg-blue-500/10 text-blue-400',
    committed: 'bg-amber-500/10 text-amber-400',
};

export function ArtifactDetailModal({
    artifact,
    open,
    onClose,
}: ArtifactDetailModalProps) {
    if (!artifact) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                            <DialogTitle className="text-lg leading-tight">
                                {artifact.title || artifact.url}
                            </DialogTitle>
                            <DialogDescription className="flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5" />
                                {artifact.domain}
                            </DialogDescription>
                        </div>
                        <Badge className={engagementColors[artifact.engagement_level] || engagementColors.ambient}>
                            {artifact.engagement_level}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Stats Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-3 gap-4"
                    >
                        <div className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Dwell Time
                            </div>
                            <div className="mt-1 text-lg font-medium">
                                {Math.round((artifact.dwell_time_ms || 0) / 1000)}s
                            </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" />
                                Reading Depth
                            </div>
                            <div className="mt-1 text-lg font-medium">
                                {Math.round((artifact.reading_depth || 0) * 100)}%
                            </div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <BookOpen className="h-3.5 w-3.5" />
                                Word Count
                            </div>
                            <div className="mt-1 text-lg font-medium">
                                {artifact.word_count?.toLocaleString() || 0}
                            </div>
                        </div>
                    </motion.div>

                    {/* Content Preview */}
                    {artifact.extracted_text && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-lg border border-border bg-muted/30 p-4"
                        >
                            <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                                Content Preview
                            </h4>
                            <p className="line-clamp-6 text-sm leading-relaxed">
                                {artifact.extracted_text}
                            </p>
                        </motion.div>
                    )}

                    {/* Metadata */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-between text-sm text-muted-foreground"
                    >
                        <span>
                            Captured {new Date(artifact.created_at).toLocaleDateString()}
                        </span>
                        {artifact.subspace_id && (
                            <Badge variant="outline">Subspace #{artifact.subspace_id}</Badge>
                        )}
                    </motion.div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose}>
                            Close
                        </Button>
                        <Button asChild>
                            <a
                                href={artifact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Page
                            </a>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
