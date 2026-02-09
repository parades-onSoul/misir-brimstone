'use client';

import { useState } from 'react';
import { useUIStore, useSpaceStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';

export function CreateSpaceModal() {
  const { createSpaceModalOpen, setCreateSpaceModalOpen } = useUIStore();
  const { addSpace } = useSpaceStore();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [intention, setIntention] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = name.trim().length > 0 && intention.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isFormValid) return;

    setLoading(true);
    setGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, intention }),
      });

      if (response.ok) {
        const data = await response.json();
        addSpace(data.space);
        setName('');
        setIntention('');
        setGenerating(false);
        setCreateSpaceModalOpen(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create space');
        setGenerating(false);
      }
    } catch (_err) {
      setError('Network error. Please try again.');
      setGenerating(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      setCreateSpaceModalOpen(open);
      if (!open) {
        setName('');
        setIntention('');
        setError('');
        setGenerating(false);
      }
    }
  };

  // Generating state - show progress modal
  if (generating) {
    return (
      <Dialog open={createSpaceModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm [&>button]:hidden">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
            <div className="text-center space-y-1">
              <h3 className="font-semibold">Generating your space</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing your intention and creating personalized subtopics...
              </p>
              <p className="text-xs text-muted-foreground/70 pt-2">
                This may take a few minutes for best accuracy
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={createSpaceModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            New Space
          </DialogTitle>
          <DialogDescription>
            A space organizes your learning around a topic
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Topic Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Topic <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Machine Learning, Psychology, etc."
              autoFocus
            />
          </div>

          {/* Intention Field */}
          <div className="space-y-2">
            <Label htmlFor="intention" className="text-sm font-medium">
              Intention <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="intention"
              value={intention}
              onChange={(e) => setIntention(e.target.value.slice(0, 280))}
              placeholder="What's your goal? e.g., Build a recommendation system, Prepare for interview, Write a book chapter..."
              className="min-h-[120px] resize-none"
              rows={5}
              maxLength={280}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Your intention shapes which subtopics are generated.</span>
              <span className={intention.length > 250 ? 'text-destructive' : ''}>{intention.length}/280</span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={loading || !isFormValid}
            >
              Create Space
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
