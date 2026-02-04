"use client"

import * as React from "react"
import { 
  Puzzle, 
  Plus,
  ArrowRight,
  Globe,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  className?: string
  hasSpaces: boolean
  onCreateSpace?: () => void
}

export function EmptyState({ className, hasSpaces, onCreateSpace }: EmptyStateProps) {
  if (!hasSpaces) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-16 px-6",
        className
      )}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-bg-tertiary) mb-4">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-(--color-text-primary) mb-1">
          Create your first space
        </h3>
        <p className="text-muted-foreground text-center max-w-sm mb-6">
          Spaces organize your artifacts by topic. Create one to start capturing knowledge.
        </p>
        <Button 
          onClick={onCreateSpace}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Space
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6",
      className
    )}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-bg-tertiary) mb-4">
        <Globe className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-(--color-text-primary) mb-1">
        Start browsing to capture artifacts
      </h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Install the browser extension and browse the web. Relevant content will be automatically captured to your spaces.
      </p>
      
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <ExtensionCard />
        <HowItWorksCard />
      </div>
    </div>
  )
}

function ExtensionCard() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-(--color-border-primary) bg-card hover:bg-(--color-bg-tertiary) transition-colors group cursor-pointer">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-(--focus-color)/10">
        <Puzzle className="h-4 w-4 text-(--focus-color)" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-(--color-text-primary)">
          Get the Extension
        </span>
        <p className="text-[0.75rem] text-(--color-text-quaternary)">
          Chrome · Firefox · Safari
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-(--color-text-quaternary) group-hover:text-muted-foreground transition-colors" />
    </div>
  )
}

function HowItWorksCard() {
  return (
    <div className="p-3 rounded-lg border border-(--color-border-primary) bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-(--color-text-quaternary)" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          How it works
        </span>
      </div>
      <div className="space-y-2">
        <Step number={1} text="Browse the web normally" />
        <Step number={2} text="AI detects relevant content" />
        <Step number={3} text="Artifacts flow into your spaces" />
      </div>
    </div>
  )
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--color-bg-tertiary) text-[0.75rem] font-medium text-(--color-text-quaternary)">
        {number}
      </span>
      <span className="text-muted-foreground">
        {text}
      </span>
    </div>
  )
}
