import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-misir-border bg-misir-surface text-misir-text',
        success: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/20 text-amber-400',
        destructive: 'border-red-500/30 bg-red-500/20 text-red-400',
        outline: 'text-misir-text',
        latent: 'border-blue-500/30 bg-blue-500/20 text-blue-400',
        discovered: 'border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
        engaged: 'border-amber-500/30 bg-amber-500/20 text-amber-400',
        saturated: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
