'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';
import { useCreateSpace } from '@/lib/api/spaces';
import { useMarkOnboarded } from '@/lib/api/profile';
import { useAuth } from '@/hooks/use-auth';

interface OnboardingModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ONBOARDING_KEY = 'misir_onboarded';

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
    const router = useRouter();
    const { user } = useAuth();
    const createSpace = useCreateSpace();
    const markOnboarded = useMarkOnboarded();
    
    const [name, setName] = useState('');
    const [intention, setIntention] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('Please tell us what you want to research');
            return;
        }

        if (!user?.id) {
            setError('Authentication required');
            return;
        }

        try {
            const result = await createSpace.mutateAsync({
                data: {
                    name: name.trim(),
                    intention: intention.trim() || undefined,
                },
                userId: user.id,
            });

            // Mark onboarding as complete in localStorage AND backend
            localStorage.setItem(ONBOARDING_KEY, 'true');
            
            // Mark onboarded in backend (don't wait for it)
            markOnboarded.mutateAsync({ userId: user.id }).catch(err => {
                console.warn('Failed to mark onboarded in backend:', err);
            });

            // Close modal and redirect to new space
            onOpenChange(false);
            router.push(`/spaces/${result.id}`);
        } catch (err) {
            console.error('Failed to create space:', err);
            setError('Failed to create space. Please try again.');
        }
    };

    const handleSkip = () => {
        // Mark onboarding as complete even if skipped
        localStorage.setItem(ONBOARDING_KEY, 'true');
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-125">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="size-6 text-[#5E6AD2]" />
                        <DialogTitle className="text-xl">Welcome to Misir!</DialogTitle>
                    </div>
                    <DialogDescription className="text-[15px] text-[#8A8F98]">
                        Let&apos;s create your first space. A space is where you&apos;ll gather and organize research on a specific topic.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="research-topic" className="text-[14px] font-medium text-[#EEEEF0]">
                            What do you want to research?
                        </Label>
                        <Input
                            id="research-topic"
                            placeholder="e.g., Machine Learning, Climate Change, Web3..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="text-[14px]"
                            autoFocus
                            disabled={createSpace.isPending}
                        />
                        <p className="text-[12px] text-[#5F646D]">
                            This will be your space name
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="goal" className="text-[14px] font-medium text-[#EEEEF0]">
                            What&apos;s your goal? <span className="text-[#5F646D] font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="goal"
                            placeholder="e.g., Learn the fundamentals, Build a project, Write a paper..."
                            value={intention}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIntention(e.target.value)}
                            className="text-[14px] min-h-20 resize-none"
                            disabled={createSpace.isPending}
                        />
                        <p className="text-[12px] text-[#5F646D]">
                            Helps Misir understand your research direction
                        </p>
                    </div>

                    {error && (
                        <div className="text-[13px] text-red-500 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            type="submit"
                            disabled={createSpace.isPending || !name.trim()}
                            className="flex-1 bg-[#5E6AD2] hover:bg-[#4E5AC2] text-white"
                        >
                            {createSpace.isPending ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Space'
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleSkip}
                            disabled={createSpace.isPending}
                            className="text-[#8A8F98] hover:text-[#EEEEF0]"
                        >
                            Skip for now
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
