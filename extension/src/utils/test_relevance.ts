import { calculateRelevance } from './relevance-scorer';
import type { Marker } from '../types';

// Mock Markers
const markers: Marker[] = [
    { id: 1, space_id: 1, user_id: 'u1', label: 'quantum computing', weight: 1.0, created_at: '' },
    { id: 2, space_id: 1, user_id: 'u1', label: 'qubit', weight: 0.9, created_at: '' },
    { id: 3, space_id: 1, user_id: 'u1', label: 'entanglement', weight: 0.8, created_at: '' },
    { id: 4, space_id: 1, user_id: 'u1', label: 'superposition', weight: 0.8, created_at: '' },
    { id: 5, space_id: 1, user_id: 'u1', label: 'linear algebra', weight: 0.5, created_at: '' },
];

const scenarios = [
    {
        name: 'Relevant Page (Quantum Basics)',
        title: 'Introduction to Quantum Computing',
        content: 'Quantum computing uses qubits and superposition to solve problems. Entanglement is key.',
        expected: 'High',
    },
    {
        name: 'Semi-Relevant Page (Math)',
        title: 'Linear Algebra for Physics',
        content: 'Linear algebra is useful for many fields including physics.',
        expected: 'Medium',
    },
    {
        name: 'Irrelevant Page (Cooking)',
        title: 'How to bake a cake',
        content: 'Cooking requires flour, sugar, and eggs. Mix them well.',
        expected: 'Low',
    },
    {
        name: 'Spam Page (SEO)',
        title: 'Buy Quantum Computers Cheap',
        content: 'Best prices. Click here. No real content.',
        expected: 'Low',
    },
];

console.log('--- Relevance Scorer Verification ---');
console.log(`Markers: ${markers.map(m => `${m.label}(${m.weight})`).join(', ')}`);

for (const scenario of scenarios) {
    console.log(`\nTesting: ${scenario.name}`);
    const score = calculateRelevance(scenario.content, scenario.title, 'http://test.com', markers);
    console.log(`Title: ${scenario.title}`);
    console.log(`Score: ${score.confidence}`);
    console.log(`Matched: ${score.matchedMarkers.join(', ')}`);

    // validation
    if (scenario.expected === 'High' && score.confidence < 0.5) console.error('FAIL: Expected High');
    if (scenario.expected === 'Low' && score.confidence > 0.4) console.error('FAIL: Expected Low');
}
