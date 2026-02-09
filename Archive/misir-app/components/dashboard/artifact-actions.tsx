'use client';

/**
 * Artifact Actions Dropdown
 * 
 * Provides actions for artifact management:
 * - Move to different subspace
 * - Remove from subspace (wrong match)
 * - Delete artifact
 */

import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, ArrowRight, X, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/db/supabase';
import { useSpaceStore } from '@/lib/store';
import type { Subspace } from '@/lib/types';

interface ArtifactActionsProps {
    artifactId: string;
    artifactTitle: string;
    currentSpaceId: string;
    currentSubspaceId: string | null;
    onActionComplete?: () => void;
}

export function ArtifactActions({
    artifactId,
    artifactTitle,
    currentSpaceId,
    currentSubspaceId,
    onActionComplete,
}: ArtifactActionsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const spaces = useSpaceStore((state) => state.spaces);

    // Get subspaces from current space
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    const availableSubspaces = currentSpace?.subspaces?.filter(
        (ss: Subspace) => ss.id !== currentSubspaceId
    ) || [];

    // Get subspaces from other spaces
    const otherSpaces = spaces.filter(s => s.id !== currentSpaceId);

    const handleMoveToSubspace = async (newSubspaceId: string, newSpaceId: string) => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('artifacts')
                .update({
                    subspace_id: newSubspaceId,
                    space_id: newSpaceId,
                })
                .eq('id', artifactId);

            if (error) throw error;

            // Log the correction for analytics
            await logMisclassification(artifactId, currentSubspaceId, newSubspaceId, 'move');

            onActionComplete?.();
        } catch (error) {
            console.error('Failed to move artifact:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveFromSubspace = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('artifacts')
                .update({ subspace_id: null })
                .eq('id', artifactId);

            if (error) throw error;

            // Log the correction
            await logMisclassification(artifactId, currentSubspaceId, null, 'remove');

            onActionComplete?.();
        } catch (error) {
            console.error('Failed to remove artifact from subspace:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete "${artifactTitle}"?`)) return;

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('artifacts')
                .delete()
                .eq('id', artifactId);

            if (error) throw error;

            onActionComplete?.();
        } catch (error) {
            console.error('Failed to delete artifact:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isLoading}
                >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Artifact actions</span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
                {/* Move to subspace in current space */}
                {availableSubspaces.length > 0 && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Move to subspace
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {availableSubspaces.map((ss: Subspace) => (
                                <DropdownMenuItem
                                    key={ss.id}
                                    onClick={() => handleMoveToSubspace(ss.id, currentSpaceId)}
                                >
                                    {ss.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                {/* Move to different space */}
                {otherSpaces.length > 0 && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Move to space
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {otherSpaces.map((space) => (
                                <DropdownMenuSub key={space.id}>
                                    <DropdownMenuSubTrigger>{space.name}</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {space.subspaces?.map((ss: Subspace) => (
                                            <DropdownMenuItem
                                                key={ss.id}
                                                onClick={() => handleMoveToSubspace(ss.id, space.id)}
                                            >
                                                {ss.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />

                {/* Wrong match - remove from subspace */}
                {currentSubspaceId && (
                    <DropdownMenuItem onClick={handleRemoveFromSubspace}>
                        <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" />
                        Doesn't belong here
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Delete */}
                <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Log misclassification for analytics and threshold tuning
 */
async function logMisclassification(
    artifactId: string,
    fromSubspaceId: string | null,
    toSubspaceId: string | null,
    action: 'move' | 'remove'
): Promise<void> {
    try {
        // Get artifact details for logging
        const { data: artifact } = await supabase
            .from('artifacts')
            .select('relevance, title')
            .eq('id', artifactId)
            .single();

        console.log('[Feedback] Misclassification logged:', {
            artifactId,
            title: artifact?.title?.slice(0, 40),
            from: fromSubspaceId,
            to: toSubspaceId,
            action,
            relevance: artifact?.relevance,
        });

        // TODO: Store in corrections table for analytics
        // await supabase.from('artifact_corrections').insert({
        //   artifact_id: artifactId,
        //   from_subspace_id: fromSubspaceId,
        //   to_subspace_id: toSubspaceId,
        //   action,
        //   original_relevance: artifact?.relevance,
        // });

    } catch (error) {
        console.error('[Feedback] Failed to log misclassification:', error);
    }
}

export default ArtifactActions;
