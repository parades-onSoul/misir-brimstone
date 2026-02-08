'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useCreateSpace } from '@/lib/api/spaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';



export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { mutateAsync: createSpace } = useCreateSpace();

    const [step, setStep] = useState(0);
    const [topics, setTopics] = useState(['', '', '']);
    const [isSeeding, setIsSeeding] = useState(false);
    const [seededCount, setSeededCount] = useState(0);

    const handleTopicChange = (index: number, value: string) => {
        const newTopics = [...topics];
        newTopics[index] = value;
        setTopics(newTopics);
    };

    const validTopics = topics.filter((t) => t.trim().length > 0);

    const handleSeed = async () => {
        if (!user?.id || validTopics.length === 0) return;

        setIsSeeding(true);
        setSeededCount(0);

        for (const topic of validTopics) {
            try {
                await createSpace({
                    user_id: user.id,
                    name: topic.trim(),
                    description: `Tracking learnings about ${topic.trim()}`,
                    // No intention = manual mode (no AI generation for onboarding)
                });
                setSeededCount((prev) => prev + 1);
            } catch (err) {
                console.error(`Failed to create space for "${topic}":`, err);
            }
        }

        // Short delay for the animation to play
        setTimeout(() => {
            router.push('/dashboard');
        }, 800);
    };

    const handleSkip = () => {
        router.push('/dashboard');
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-b from-background to-background/80">
            <AnimatePresence mode="wait">
                {step === 0 && (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="flex max-w-lg flex-col items-center text-center"
                    >
                        <motion.div
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"
                        >
                            <Compass className="h-10 w-10 text-primary" />
                        </motion.div>
                        <h1 className="mt-8 text-3xl font-bold tracking-tight">
                            Welcome to Misir
                        </h1>
                        <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
                            A personal orientation system that tracks your relationship with information.
                            Every article, video, and note becomes a point in your knowledge space.
                        </p>
                        <div className="mt-8 grid gap-4 text-left w-full max-w-sm">
                            {[
                                'Captures what you read passively',
                                'Tracks engagement depth automatically',
                                'Reveals knowledge patterns over time',
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.15 }}
                                    className="flex items-center gap-3 text-sm"
                                >
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                                        <Check className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    {feature}
                                </motion.div>
                            ))}
                        </div>
                        <div className="mt-8 flex gap-3">
                            <Button variant="ghost" onClick={handleSkip}>
                                Skip setup
                            </Button>
                            <Button onClick={() => setStep(1)} size="lg">
                                Get started
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {step === 1 && (
                    <motion.div
                        key="seed"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                        className="w-full max-w-md"
                    >
                        <Card>
                            <CardHeader className="text-center">
                                <motion.div
                                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                                    animate={isSeeding ? { rotate: 360 } : {}}
                                    transition={isSeeding ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                                >
                                    <Sparkles className="h-6 w-6 text-primary" />
                                </motion.div>
                                <CardTitle className="mt-4 text-xl">Seed your spaces</CardTitle>
                                <CardDescription>
                                    What are you curious about right now? We&apos;ll create spaces for each topic.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {topics.map((topic, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <Input
                                            placeholder={
                                                i === 0
                                                    ? 'e.g., Machine Learning'
                                                    : i === 1
                                                        ? 'e.g., Systems Design'
                                                        : 'e.g., Philosophy of Mind'
                                            }
                                            value={topic}
                                            onChange={(e) => handleTopicChange(i, e.target.value)}
                                            disabled={isSeeding}
                                            className="transition-all"
                                        />
                                        {isSeeding && i < seededCount && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="mt-1 flex items-center gap-1 text-xs text-primary"
                                            >
                                                <Check className="h-3 w-3" />
                                                Space created
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ))}

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkip}
                                        disabled={isSeeding}
                                        className="flex-1"
                                    >
                                        Skip
                                    </Button>
                                    <Button
                                        onClick={handleSeed}
                                        disabled={isSeeding || validTopics.length === 0}
                                        className="flex-1"
                                    >
                                        {isSeeding ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Seeding {seededCount}/{validTopics.length}
                                            </>
                                        ) : (
                                            <>
                                                Create {validTopics.length > 0 ? validTopics.length : ''} space{validTopics.length !== 1 ? 's' : ''}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
