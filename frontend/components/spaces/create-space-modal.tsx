'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useCreateSpace } from '@/lib/api/spaces';
import { useUIStore } from '@/lib/stores/ui';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreateSpaceModal() {
    const { user } = useAuth();
    const { mutate: createSpace, isPending } = useCreateSpace();
    const { createSpaceModalOpen, closeCreateSpaceModal } = useUIStore();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id || !name.trim()) return;

        createSpace(
            {
                userId: user.id,
                data: {
                    user_id: user.id,
                    name: name.trim(),
                    description: description.trim() || undefined,
                },
            },
            {
                onSuccess: () => {
                    setName('');
                    setDescription('');
                    closeCreateSpaceModal();
                },
            }
        );
    };

    return (
        <Dialog open={createSpaceModalOpen} onOpenChange={closeCreateSpaceModal}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create space</DialogTitle>
                    <DialogDescription>
                        AI will generate learning structure with subspaces and markers. Add your learning intention to customize the generated content.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g., Machine Learning, TypeScript"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            Learning intention <span className="text-muted-foreground">(optional, enables AI)</span>
                        </Label>
                        <Input
                            id="description"
                            placeholder="e.g., Learn for research project, Quick overview, Deep understanding"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={closeCreateSpaceModal}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || !name.trim()}>
                            {isPending ? (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2"
                                >
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Creating...
                                </motion.span>
                            ) : (
                                'Create space'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
