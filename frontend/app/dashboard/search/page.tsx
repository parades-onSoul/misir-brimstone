'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSearch } from '@/lib/api/search';
import { useSpaces } from '@/lib/api/spaces';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
                <p className="text-muted-foreground">
                    Semantic search across your artifacts
                </p>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search your knowledge..."
                        className="pl-9"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <Select value={spaceFilter} onValueChange={setSpaceFilter}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="All spaces" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All spaces</SelectItem>
                        {spaces?.spaces.map((space) => (
                            <SelectItem key={space.id} value={String(space.id)}>
                                {space.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Results */}
            <div className="space-y-4">
                {!debouncedQuery ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-16 text-center"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Sparkles className="h-7 w-7" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium">Semantic search</h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Search by meaning, not just keywords. Try asking a question or describing what you're looking for.
                        </p>
                    </motion.div>
                ) : isLoading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-32 w-full" />
                        ))}
                    </div>
                ) : results && results.results.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {results.count} results for "{results.query}"
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {results.dimension_used}d embeddings
                            </p>
                        </div>
                        <div className="space-y-3">
                            {results.results.map((result, index) => (
                                <motion.div
                                    key={result.artifact_id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card className="group cursor-pointer transition-colors hover:border-primary/50 hover:bg-card/80">
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
            </div>
        </div>
    );
}
