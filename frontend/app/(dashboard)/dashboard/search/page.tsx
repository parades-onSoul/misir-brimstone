'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, ExternalLink, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSearch } from '@/lib/api/search';
import { useSpaces } from '@/lib/api/spaces';
import { Input } from '@/components/ui/input';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function SearchPage() {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [spaceFilter, setSpaceFilter] = useState<string>('all');

    const { data: spaces } = useSpaces(user?.id);
    const { data: results, isLoading } = useSearch(debouncedQuery, {
        space_id: spaceFilter === 'all' ? undefined : parseInt(spaceFilter),
        limit: 20,
        threshold: 0.7,
    });

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
            >
                <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
                <p className="text-base text-muted-foreground">
                    Semantic search across your saved items
                </p>
            </motion.div>

            {/* Search Input */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4"
            >
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        type="search"
                        placeholder="Search your knowledge by meaning or keywords..."
                        className="pl-11 h-12 text-[15px] border-border/60 shadow-sm focus:shadow-md transition-shadow"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        autoComplete="off"
                        aria-autocomplete="none"
                        spellCheck={false}
                    />
                </div>
                <Select value={spaceFilter} onValueChange={setSpaceFilter}>
                    <SelectTrigger className="w-52 h-12 border-border/60 shadow-sm">
                        <SelectValue placeholder="All spaces" />
                    </SelectTrigger>
                    <SelectContent className="border-border/60">
                        <SelectItem value="all">All spaces</SelectItem>
                        {spaces?.spaces.map((space) => (
                            <SelectItem key={space.id} value={String(space.id)}>
                                {space.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </motion.div>

            {/* Results */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
            >
                {!debouncedQuery ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="flex flex-col items-center justify-center py-20 text-center"
                    >
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.05, 1],
                                rotate: [0, 5, 0]
                            }}
                            transition={{ 
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary/20 to-primary/5 text-primary shadow-lg"
                        >
                            <Sparkles className="h-8 w-8" />
                        </motion.div>
                        <h3 className="mt-6 text-xl font-semibold tracking-tight">Semantic search</h3>
                        <p className="mt-2 max-w-md text-base text-muted-foreground leading-relaxed">
                            Search by meaning, not just keywords. Try asking a question or describing what you&apos;re looking for.
                        </p>
                    </motion.div>
                ) : isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className="border-border/40">
                                    <CardHeader className="space-y-3">
                                        <div className="space-y-2">
                                            <Skeleton className="h-5 w-3/4 bg-muted/50" />
                                            <Skeleton className="h-4 w-1/2 bg-muted/30" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Skeleton className="h-3 w-full bg-muted/30" />
                                            <Skeleton className="h-3 w-5/6 bg-muted/30" />
                                        </div>
                                    </CardHeader>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                ) : results && results.results.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {results.count} results for &quot;{results.query}&quot;
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {results.dimension_used}d embeddings
                            </p>
                        </div>
                        <div className="space-y-4">
                            {results.results.map((result, index) => (
                                <motion.div
                                    key={result.artifact_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05, duration: 0.3 }}
                                >
                                    <Card className="group cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-card/80 hover:shadow-md border-border/40">
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <CardTitle className="text-base">
                                                            {result.title || result.url}
                                                        </CardTitle>
                                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                                            {Math.round(result.similarity * 100)}%
                                                        </span>
                                                    </div>
                                                    <CardDescription className="flex items-center gap-2 text-sm">
                                                        <a
                                                            href={result.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 hover:text-foreground"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {new URL(result.url).hostname}
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </CardDescription>
                                                    {result.content_preview && (
                                                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                                            {result.content_preview}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16"
                    >
                        <SearchIcon className="h-8 w-8 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">No results found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Try rephrasing your search or using different keywords
                        </p>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
