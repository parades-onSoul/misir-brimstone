'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useCreateSpace } from '@/lib/api/spaces';
import { generateSpace } from '@/lib/services/space-generation';
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
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

export function CreateSpaceModal() {
    const { user } = useAuth();
    const { mutate: createSpace, isPending } = useCreateSpace();
    const { createSpaceModalOpen, closeCreateSpaceModal } = useUIStore();

    const [name, setName] = useState('');
    const [intention, setIntention] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!user?.id || !name.trim()) return;
        
        console.log('=== AI SPACE GENERATION ===');
        console.log('name:', name);
        console.log('intention:', intention);
        console.log('userId:', user.id);
        
        setError(null);

        const run = async () => {
            const trimmedName = name.trim();
            const trimmedIntention = intention.trim();

            try {
                console.log('🤖 Generating space with AI...');
                console.log('- Name:', trimmedName);
                console.log('- Intention:', trimmedIntention);
                console.log('- User ID:', user.id);
                
                const payload = await generateSpace({
                    name: trimmedName,
                    description: undefined,
                    intention: trimmedIntention,
                    userId: user.id,
                });
                
                console.log('✅ AI generation complete!');
                console.log('📊 Generated subspaces:', payload.subspaces?.length || 0);
                console.log('📋 Full payload:', JSON.stringify(payload, null, 2));

                console.log('📤 Sending to backend:', JSON.stringify(payload, null, 2));
                
                createSpace(
                    { data: payload, userId: user.id },
                    {
                        onSuccess: (response) => {
                            console.log('✅ Space created successfully!');
                            console.log('📊 Response:', response);
                            setName('');
                            setIntention('');
                            closeCreateSpaceModal();
                        },
                        onError: (err) => {
                            console.error('❌ Failed to create space:', err);
                            setError(err instanceof Error ? err.message : 'Failed to create space');
                        },
                    }
                );
            } catch (err) {
                console.error('❌ Failed to generate space:', err);
                setError(err instanceof Error ? err.message : 'Failed to generate space');
            }
        };

        run();
    };

    return (
        <Dialog open={createSpaceModalOpen} onOpenChange={closeCreateSpaceModal}>
            <DialogContent className="sm:max-w-135 border-border/40 shadow-2xl">
                <DialogHeader className="pb-6 border-b border-border/40 bg-linear-to-b from-secondary/20 to-transparent -mx-6 px-6 -mt-6 pt-6">
                    <div className="flex items-center gap-3">
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 10, 0]
                            }}
                            transition={{ 
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="flex items-center justify-center size-10 rounded-xl bg-linear-to-br from-primary to-primary/80 shadow-lg"
                        >
                            <Sparkles className="size-5 text-primary-foreground" />
                        </motion.div>
                        <div className="space-y-1">
                            <DialogTitle className="text-xl font-semibold tracking-tight">Create AI-Generated Space</DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="text-sm text-muted-foreground/80 mt-3 leading-relaxed">
                        AI will analyze your learning goal and build a structured knowledge space with topic areas and semantic markers.
                    </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    <div className="space-y-3">
                        <Label htmlFor="name" className="text-sm font-medium text-foreground">
                            Space Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="e.g., Machine Learning, TypeScript Mastery, Coffee Science"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                            required
                            className="h-11 px-4 bg-muted/30 border-border text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                        />
                        <p className="text-xs text-muted-foreground/70 leading-relaxed">
                            Choose a clear topic or domain you want to explore
                        </p>
                    </div>
                    
                    <div className="space-y-3">
                        <Label htmlFor="intention" className="text-sm font-medium text-foreground">
                            Learning Intention <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="intention"
                            placeholder="e.g., Build production systems, Master fundamentals, Research project"
                            value={intention}
                            onChange={(e) => setIntention(e.target.value)}
                            required
                            className="h-11 px-4 bg-muted/30 border-border text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-colors"
                        />
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-2 leading-relaxed">
                            <Sparkles className="h-3 w-3 text-primary shrink-0" />
                            <span>Be specific — AI tailors the structure to your goal</span>
                        </p>
                    </div>
                    
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20"
                            >
                                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <p className="text-sm text-destructive">{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    
                    <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={closeCreateSpaceModal}
                            className="h-9 text-[#8A8F98] hover:text-[#EEEEF0] hover:bg-white/5"
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isPending || !name.trim() || !intention.trim()}
                            className="h-9 min-w-35 bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white text-[13px] font-medium transition-colors"
                        >
                            {isPending ? (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2"
                                >
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating...
                                </motion.span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    Generate Space
                                </span>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
