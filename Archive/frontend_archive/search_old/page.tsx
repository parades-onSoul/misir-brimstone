'use client';

import { useState, useMemo } from 'react';
import { Search, ExternalLink, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSearch } from '@/hooks/useSearch';
import { useSpaces } from '@/lib/api/spaces';
import { getSpaceColor } from '@/lib/colors';
import { getReadingDepth } from '@/lib/formatters';
import type { SearchResultItem, SpaceResponse } from '@/types/api';

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const { user } = useAuth();
    const { data: search, isLoading } = useSearch({ 
        query, 
        userId: user?.id || '',
        enabled: !!user && query.length > 0 
    });
    const { data: spacesData } = useSpaces(user?.id || '');

    // Map space IDs to space names
    const spaceMap = useMemo(() => {
        if (!spacesData) return new Map();
        return new Map(spacesData.spaces.map((s: SpaceResponse) => [s.id, s.name]));
    }, [spacesData]);

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-[#EEEEF0]">Search</h1>
                    <p className="text-[14px] text-[#8A8F98] mt-1">
                        Search across all your saved items with semantic understanding
                    </p>
                </div>

                {/* Search Input */}
                <div className="max-w-3xl mx-auto mb-8">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#5F646D]" />
                        <Input
                            type="text"
                            placeholder="Search your knowledge base..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-12 pr-4 h-14 text-[15px] bg-[#141517] border-white/5"
                        />
                    </div>
                </div>

                {/* Results Container */}
                <div className="max-w-3xl mx-auto">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Sparkles className="h-6 w-6 animate-pulse text-[#5F646D]" />
                        </div>
                    )}

                    {/* No Results */}
                    {!isLoading && query && search && search.count === 0 && (
                        <div className="text-center py-12">
                            <p className="text-[#8A8F98]">No results found for &quot;{query}&quot;</p>
                        </div>
                    )}

                    {/* Results */}
                    {!isLoading && search && search.count > 0 && (
                        <div className="space-y-4">
                            {/* Results Count */}
                            <p className="text-sm text-[#8A8F98]">
                                {search.count} {search.count === 1 ? 'result' : 'results'} found
                            </p>

                            {/* Result Cards */}
                            {search.results.map((result) => (
                                <SearchResultCard 
                                    key={result.signal_id} 
                                    result={result}
                                    spaceName={spaceMap.get(result.space_id) || 'Unknown Space'}
                                />
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!query && (
                        <div className="text-center py-12">
                            <Search className="h-12 w-12 mx-auto mb-4 text-[#5F646D]" />
                            <p className="text-[#8A8F98]">
                                Enter a search query to find items across all your spaces
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface SearchResultCardProps {
    result: SearchResultItem;
    spaceName: string;
}

function SearchResultCard({ result, spaceName }: SearchResultCardProps) {
    const spaceColorObj = getSpaceColor(result.space_id);
    const spaceColor = spaceColorObj.hex;
    const readingDepth = getReadingDepth(result.engagement_level);

    // Format reading time
    const readingTime = useMemo(() => {
        const totalSeconds = Math.floor(result.dwell_time_ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }, [result.dwell_time_ms]);

    // Relevance dots (5 dots, filled based on similarity 0-1)
    const relevanceDots = useMemo(() => {
        const filled = Math.round(result.similarity * 5);
        return (
            <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                    <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                            i < filled ? 'bg-[#5E6AD2]' : 'bg-white/20'
                        }`}
                    />
                ))}
            </div>
        );
    }, [result.similarity]);

    return (
        <Card className="p-4 bg-[#141517] border-white/5 hover:border-white/10 transition-colors">
            {/* Header with Relevance */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                    <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-[#EEEEF0] hover:text-[#5E6AD2] transition-colors flex items-center gap-2 group"
                    >
                        <span className="truncate">{result.title || 'Untitled'}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                    </a>
                    <p className="text-xs text-[#5F646D] mt-0.5 truncate">
                        {new URL(result.url).hostname}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                    {relevanceDots}
                    <span className="text-xs text-[#5F646D]">
                        {Math.round(result.similarity * 100)}%
                    </span>
                </div>
            </div>

            {/* Snippet */}
            {result.content_preview && (
                <p className="text-sm text-[#8A8F98] mb-3 line-clamp-2">
                    {result.content_preview}
                </p>
            )}

            {/* Metadata Badges */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Space Badge */}
                <Badge 
                    variant="outline" 
                    className="text-xs border-white/10 bg-[#1A1C1F]"
                    style={{ 
                        borderColor: `${spaceColor}40`,
                        color: spaceColor,
                        backgroundColor: `${spaceColor}10`
                    }}
                >
                    {spaceName}
                </Badge>

                {/* Engagement Level Badge */}
                <Badge variant="secondary" className="text-xs bg-[#1A1C1F] text-[#8A8F98] border-white/10">
                    {readingDepth}
                </Badge>

                {/* Reading Time */}
                <span className="text-xs text-[#5F646D]">
                    {readingTime}
                </span>
            </div>
        </Card>
    );
}
