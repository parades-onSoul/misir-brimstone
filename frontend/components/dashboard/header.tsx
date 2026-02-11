'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface BreadcrumbItem {
    label: string;
    href?: string;
    active?: boolean;
}

interface DashboardHeaderProps {
    icon?: LucideIcon;
    breadcrumbs: BreadcrumbItem[];
    children?: React.ReactNode; // Right side actions
    extraNav?: React.ReactNode; // Content after breadcrumbs (like selectors)
    className?: string;
}

export function DashboardHeader({ 
    icon: Icon, 
    breadcrumbs, 
    children, 
    extraNav,
    className 
}: DashboardHeaderProps) {
    return (
        <header className={cn(
            "h-12 flex items-center justify-between px-6 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10",
            className
        )}>
            <nav className="flex items-center gap-2 text-[13px]">
                {Icon && (
                    <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
                )}
                
                {breadcrumbs.map((item, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <span className="text-muted-foreground/60">/</span>
                        )}
                        {item.href ? (
                            <Link 
                                href={item.href}
                                className={cn(
                                    "hover:text-foreground transition-colors",
                                    item.active ? "text-foreground font-medium" : "text-muted-foreground"
                                )}
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className={cn(
                                item.active ? "text-foreground font-medium" : "text-muted-foreground"
                            )}>
                                {item.label}
                            </span>
                        )}
                    </React.Fragment>
                ))}

                {extraNav && (
                    <div className="ml-4">
                        {extraNav}
                    </div>
                )}
            </nav>

            <div className="flex items-center gap-2">
                {children}
            </div>
        </header>
    );
}
