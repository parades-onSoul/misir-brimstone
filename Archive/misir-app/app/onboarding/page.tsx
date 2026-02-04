'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * Onboarding Page - The "Seed" Protocol
 * 
 * First-time users seed their identity with 3 topics they're obsessed with.
 * This immediately populates the blob visualization with their spaces.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [topics, setTopics] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // Check if user already completed onboarding
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        
        if (data.onboardedAt) {
          // Already onboarded - redirect to dashboard
          router.replace('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }
      setChecking(false);
    }
    
    checkOnboardingStatus();
  }, [router]);

  const updateTopic = (index: number, value: string) => {
    const newTopics = [...topics];
    newTopics[index] = value;
    setTopics(newTopics);
  };

  const filledTopics = topics.filter(t => t.trim().length > 0);
  const canSubmit = filledTopics.length >= 1; // At least 1, encourage 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit) {
      setError('Enter at least one topic to get started.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: filledTopics }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create spaces');
      }

      // Success - redirect to dashboard
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking
  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show full-screen loading while generating spaces
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Animated spinner */}
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Setting up your spaces</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Generating subspaces for each topic. This usually takes 10-20 seconds.
            </p>
          </div>
          
          {/* Show topics being created */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {filledTopics.map((topic, i) => (
              <span 
                key={i}
                className="px-3 py-1 bg-muted rounded-full text-sm animate-pulse"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Header */}
            <div className="flex flex-col gap-4 text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                What are you obsessed with?
              </h1>
              <FieldDescription className="text-base">
                Name 3 topics you&apos;re currently exploring. These become your first spaces.
              </FieldDescription>
            </div>

            {/* Topic Inputs */}
            <div className="space-y-4">
              {[0, 1, 2].map((index) => (
                <Field key={index}>
                  <FieldLabel htmlFor={`topic-${index}`} className="sr-only">
                    Topic {index + 1}
                  </FieldLabel>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                      topics[index].trim() 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </span>
                    <Input
                      id={`topic-${index}`}
                      type="text"
                      placeholder={getPlaceholder(index)}
                      value={topics[index]}
                      onChange={(e) => updateTopic(index, e.target.value)}
                      className="flex-1"
                      autoFocus={index === 0}
                    />
                  </div>
                </Field>
              ))}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 py-4">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    topics[index].trim() 
                      ? "bg-primary" 
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Submit button */}
            <Field>
              <Button 
                type="submit" 
                disabled={!canSubmit}
                className="w-full"
                size="lg"
              >
                Start exploring
              </Button>
            </Field>

            {/* Helper text */}
            <FieldDescription className="text-center text-xs">
              Don&apos;t worry — you can always add more spaces later.
            </FieldDescription>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}

function getPlaceholder(index: number): string {
  const placeholders = [
    'e.g., Machine Learning',
    'e.g., Philosophy',
    'e.g., Cooking',
  ];
  return placeholders[index] || 'Enter a topic...';
}
