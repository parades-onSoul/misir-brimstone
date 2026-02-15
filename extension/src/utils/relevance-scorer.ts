import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import type { Marker } from '@/types';

const nlp = winkNLP(model);
const its = nlp.its;

export interface RelevanceScore {
    confidence: number;
    matchedMarkers: string[];
    reason?: string;
}

/**
 * Calculate semantic relevance of a page based on weighted markers.
 * Uses stemming for robust matching.
 * 
 * Score calculation:
 * - Sums weights of all fully matched markers (all stems present)
 * - Converts sum to 0-1 confidence using saturation function: 1 - exp(-k * sum)
 * - Single core marker (w=1.0) -> ~0.63 confidence (Relevant)
 * - Single related marker (w=0.5) -> ~0.39 confidence (Not Relevant)
 */
export function calculateRelevance(
    text: string,
    title: string,
    url: string,
    markers: Marker[]
): RelevanceScore {
    // Combine title and text (give title double weight by repeating)
    const fullText = `${title} ${title} ${text}`;

    const doc = nlp.readDoc(fullText);

    // Set of stemmed tokens from document for O(1) lookup
    // @ts-ignore
    const docTokens = new Set(doc.tokens().out(its.stem));

    let matchedWeight = 0;
    const matchedLabels: string[] = [];

    for (const marker of markers) {
        const markerWeight = marker.weight || 1.0;

        // Tokenize and stem the marker label
        const markerDoc = nlp.readDoc(marker.label);
        // @ts-ignore
        const markerStems = markerDoc.tokens().out(its.stem);

        if (markerStems.length === 0) continue;

        // Strict phrase matching logic (bag-of-words style for now)
        // Check if ALL stems from marker are present in the document
        let allStemsPresent = true;
        for (const stem of markerStems) {
            if (!docTokens.has(stem)) {
                allStemsPresent = false;
                break;
            }
        }

        if (allStemsPresent) {
            matchedWeight += markerWeight;
            matchedLabels.push(marker.label);
        }
    }

    // Saturation function: 1 - e^(-weight)
    // weight 0.5 -> 0.39
    // weight 1.0 -> 0.63
    // weight 2.0 -> 0.86
    const confidence = 1 - Math.exp(-matchedWeight);

    return {
        confidence: Number(confidence.toFixed(2)),
        matchedMarkers: matchedLabels
    };
}
