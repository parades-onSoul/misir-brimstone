'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { useSearch } from '@/lib/api/search';
import { useSearchStore } from '@/lib/stores/search';
import { useUserStore } from '@/lib/stores/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import Link from 'next/link';
import type { SpaceResponse, SearchResultItem } from '@/types/api';

export default function ArtifactsPage() {
    const { user } = useAuth();
    const { data: spaces } = useSpaces(user?.id);
    const { query, filters, setQuery, setFilters, clearAll } = useSearchStore();
    const { activeSpaceId } = useUserStore();
    
    const [searchInput, setSearchInput] = useState(query);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(
        activeSpaceId?.toString() || undefined
    );
    const [limit, setLimit] = useState(50);
    
    const { data: results, isLoading, error } = useSearch(
        query,
        {
            space_id: selectedSpaceId ? parseInt(selectedSpaceId) : undefined,
            limit,
            threshold: 0.3,
        },
        !!query
    );

    const handleSearch = () => {
        setQuery(searchInput);
        setFilters({
            space_id: selectedSpaceId ? parseInt(selectedSpaceId) : undefined,
            limit,
            threshold: filters.threshold || 0.3,
        });
    };

    const handleClear = () => {
        setSearchInput('');
        setSelectedSpaceId(undefined);
        clearAll();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Artifacts</h1>
                    <p className="text-muted-foreground">
                        Search and manage your captured knowledge
                    </p>
                </div>
                <Link href="/dashboard/search">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Capture New
                    </Button>
                </Link>
            </div>

            {/* Search & Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Search Artifacts
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Search by content, title, or URL..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={!searchInput.trim()}>
                            <Search className="mr-2 h-4 w-4" />
                            Search
                        </Button>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <div className="w-50">
                            <select
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={selectedSpaceId || ''}
                                onChange={(e) => setSelectedSpaceId(e.target.value || undefined)}
                            >
                                <option value="">All Spaces</option>
                                {spaces?.spaces.map((space: SpaceResponse) => (
                                    <option key={space.id} value={space.id}>
                                        {space.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="w-30">
                            <select
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                            >
                                <option value={25}>25 results</option>
                                <option value={50}>50 results</option>
                                <option value={100}>100 results</option>
                            </select>
                        </div>

                        {query && (
                            <Button variant="outline" onClick={handleClear}>
                                Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {isLoading && (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                    ))}
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>
                        Error loading artifacts: {error.message}
                    </AlertDescription>
                </Alert>
            )}

            {!query && !isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16"
                >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Search className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">Enter a search query</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Search for artifacts by content, title, URL, or tags
                    </p>
                </motion.div>
            )}

            {query && !isLoading && results && results.results.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16"
                >
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No results found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Try adjusting your search query or filters
                    </p>
                </motion.div>
            )}

            {results && results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Found {results.length} artifact{results.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Space</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Signal</TableHead>
                                    <TableHead className="text-right">Match</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.results.map((result: SearchResultItem) => (
                                    <TableRow
                                        key={result.artifact_id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => window.location.href = `/dashboard/artifacts/${result.artifact_id}`}
                                    >
                                        <TableCell>
                                            <div className="space-y-1 max-w-md">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-medium line-clamp-1">
                                                        {result.title || 'Untitled Artifact'}
                                                    </span>
                                                </div>
                                                {result.content_preview && (
                                                    <p className="text-sm text-muted-foreground line-clamp-2 ml-6">
                                                        {result.content_preview}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                Space {result.space_id}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {result.url && (
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-1 text-sm text-primary hover:underline max-w-50"
                                                >
                                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">
                                                        {new URL(result.url).hostname}
                                                    </span>
                                                </a>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            Signal #{result.signal_id}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className="text-xs">
                                                {(result.similarity * 100).toFixed(0)}%
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}
        </div>
    );
}
