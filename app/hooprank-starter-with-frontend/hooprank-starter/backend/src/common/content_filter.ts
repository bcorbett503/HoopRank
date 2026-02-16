/**
 * Content filter for Guideline 1.2 compliance.
 * Checks user-generated text for offensive/objectionable content.
 */

// Curated list of slurs, hate speech, and highly offensive terms.
// Kept intentionally short but covering the most critical cases.
const BLOCKED_WORDS: string[] = [
    // Racial slurs
    'nigger', 'nigga', 'chink', 'spic', 'kike', 'wetback', 'beaner', 'gook',
    'coon', 'darkie', 'jigaboo', 'raghead', 'towelhead', 'zipperhead',
    // Homophobic slurs
    'faggot', 'fag', 'dyke', 'tranny',
    // Sexist/violent
    'cunt', 'whore', 'slut', 'bitch',
    // Threats / violence
    'kill yourself', 'kys',
];

// Build regex patterns: whole-word matching (case-insensitive)
const BLOCKED_PATTERNS: RegExp[] = BLOCKED_WORDS.map(
    (word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
);

export interface ContentFilterResult {
    clean: boolean;
    /** Original text with offensive words replaced by asterisks */
    filtered: string;
    /** List of matched offensive terms */
    matches: string[];
}

/**
 * Check text against the blocked word list.
 * Returns whether the text is clean, the filtered version, and any matches.
 */
export function filterContent(text: string): ContentFilterResult {
    if (!text) {
        return { clean: true, filtered: '', matches: [] };
    }

    const matches: string[] = [];
    let filtered = text;

    for (const pattern of BLOCKED_PATTERNS) {
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            matches.push(match[0]);
        }
        // Replace in filtered text
        pattern.lastIndex = 0;
        filtered = filtered.replace(pattern, (m) => '*'.repeat(m.length));
    }

    return {
        clean: matches.length === 0,
        filtered,
        matches: [...new Set(matches)], // deduplicate
    };
}
