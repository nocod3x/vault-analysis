declare namespace Intl {
    interface SegmenterOptions {
        granularity?: 'grapheme' | 'word' | 'sentence';
        localeMatcher?: 'best fit' | 'lookup';
    }

    interface SegmenterSegment {
        segment: string;
        index: number;
        input: string;
        isWordLike?: boolean;
    }

    class Segmenter {
        constructor(locale?: string, options?: SegmenterOptions);
        segment(input: string): IterableIterator<SegmenterSegment>;
    }
}

export interface Metric {
    id: string;
    name: string;
    description: string;
    frontmatterKey: string;
    calculate: (content: string) => number;
    enabled: boolean;
    category: 'structure' | 'syntax' | 'semantics' | 'graph' | 'composite';
}

export interface CompositeMetric extends Omit<Metric, 'calculate'> {
    dependencies: string[]; // metrics ids
    calculateFromMetrics: (metrics: Record<string, number>) => number;
}

export type AnyMetric = Metric | CompositeMetric;

export function isCompositeMetric(metric: AnyMetric): metric is CompositeMetric {
    return 'dependencies' in metric && 'calculateFromMetrics' in metric;
}

export class TextUtils {
    static removeFrontmatter2(content: string): string {
        return content.replace(/^---\n[\s\S]*?\n---\n/, ''); // remove YAML frontmatter wrapped in --- (Unix line endings)
    }

    static getParagraphs(content: string): string[] {
        const withoutFrontmatter = this.removeFrontmatter(content);
        return withoutFrontmatter
            .split(/\n\s*\n/) // split text into paragraphs by blank lines (allowing spaces between)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }

    static removeFrontmatter(content: string): string {
return content.replace(/^---\r?\n[\s\S]*?\n---\r?\n/m, ''); // remove YAML frontmatter wrapped in --- (supports Windows and Unix line endings)
    }

    //problem is bigger than I expected 
    // # head \n\n text \n\n text
    // text \n\n text \n\n text
    // # head \n\n text \n\n #head \n\n text 
    // \n & \r\n
    static getParagraphsTest(content: string): string[] {
        const withoutFrontmatter = this.removeFrontmatter(content); 
        return withoutFrontmatter
            .replace(/\r\n/g, '\n') // normalize Windows line endings to Unix
            .replace(/\r/g, '\n') // normalize old Mac line endings to Unix
            .replace(/^(\s*#{1,6}\s+.*)\n{2,}/gm, '$1\n') // prevent headers from creating extra paragraph breaks
            .replace(/^\s*#{1,6}\s+/gm, '') // remove header markers (#, ##, etc.)
            .replace(/^[-*_]{3,}\s*$/gm, '') // remove horizontal rules
            .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines to max two
            .replace(/([^\n])\n(```)/g, '$1\n\n$2') // ensure blank line before code blocks
            .replace(/(```[^`]*```)\n([^\n])/g, '$1\n\n$2') // ensure blank line after code blocks
            .split(/\n\n+/) // split text into paragraphs by double line breaks
            .map(p => p.trim()) // trim whitespace around each paragraph
            .filter(p => p.length > 0); // remove empty paragraphs
    }

    static cleanMarkdown2(text: string): string {
        return text
            .replace(/!\[.*?\]\(.*?\)/g, '') // delete img
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // replace links with text
            .replace(/[#*_~`]/g, '') // delete markdown symbols
            .trim();
    }

    static cleanMarkdown(text: string): string {
        return text
            .replace(/```[\s\S]*?```/g, '') // remove fenced code blocks (``` ... ```)
            .replace(/`[^`]+`/g, '') // remove inline code (`code`)
            .replace(/<!--[\s\S]*?-->/g, '') // remove HTML comments
            .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // replace images with alt text
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // replace inline links with text only
            .replace(/\[([^\]]+)\]\[[^\]]+\]/g, '$1') // replace reference links with text only
            .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, display) => display || link) // handle wiki links [[link|text]]
            .replace(/^#{1,6}\s+/gm, '') // remove header markers (#, ##, etc.)
            .replace(/^>\s+/gm, '') // remove blockquote markers (>)
            .replace(/^[-*_]{3,}\s*$/gm, '') // remove horizontal rules (---, ***, ___)
            .replace(/(\*\*|__)(.*?)\1/g, '$2') // remove bold formatting
            .replace(/(\*|_)(.*?)\1/g, '$2') // remove italic formatting
            .replace(/~~(.*?)~~/g, '$1') // remove strikethrough formatting
            .replace(/==(.*?)==/g, '$1') // remove highlight formatting
            .replace(/^[\s]*[-*+]\s+/gm, '') // remove unordered list markers
            .replace(/^[\s]*\d+\.\s+/gm, '') // remove ordered list markers
            .replace(/^[\s]*[-*+]\s+\[(x| )\]\s+/gmi, '') // remove task list checkboxes
            .replace(/\[\^[^\]]+\]/g, '') // remove footnote references
            .replace(/\s+/g, ' ') // collapse multiple spaces
            .trim(); // trim leading and trailing whitespace
    }

    static countWords2(text: string, locale: string = 'en'): number {
        if (!text) {
            return 0;
        }
        const plain = this.cleanMarkdown(text);

        const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
        const words = [...segmenter.segment(plain)].filter(w => w.isWordLike);
        return words.length;
    }

    static countWords(text: string, locale: string = 'en'): number {
        if (!text?.trim()) {
            return 0;
        }
        
        const plain = this.cleanMarkdown(text);
        
        try {
            const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
            const words = [...segmenter.segment(plain)].filter(w => w.isWordLike);
            
            return words.length;
        } catch (error) {
            console.warn(`Invalid locale "${locale}", falling back to "en"`, error);
            return this.countWords(text, 'en');
        }
    }

    static getSentences2(text: string, locale: string = 'en'): string[] {
        if (!text) {
            return [];
        }

        const segmenter = new Intl.Segmenter(locale, { 
            granularity: 'sentence' 
        });
        const segmentsIterator = segmenter.segment(text);
        const sentences = Array.from(segmentsIterator).map(item => item.segment);
        return sentences.filter(s => s.trim().length > 0);
    }
    static getSentences(text: string, locale: string = 'en', cleanMd: boolean = true): string[] {
        if (!text?.trim()) {
            return [];
        }
        
        let processedText = cleanMd ? this.cleanMarkdown(text) : text;
        processedText = processedText
            .replace(/([.!?])[.!?]+/g, '$1') // Multiple punctuation -> single
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        
        try {
            const segmenter = new Intl.Segmenter(locale, { 
                granularity: 'sentence' 
            });
            
            return Array.from(segmenter.segment(processedText))
                .map(item => item.segment.trim())
                .filter(s => s.length > 0);
        } catch (error) {
            console.warn(`Invalid locale "${locale}", falling back to "en"`, error);
            return this.getSentences(text, 'en', cleanMd);
        }
    }

    static countLongWords2(text: string): number {
        const cleanText = this.cleanMarkdown(text);
        const words = cleanText.split(/\s+/); // split by whitespace
        return words.filter(w => w.length > 6).length;
    }

    static countLongWords(text: string, minLength: number = 6, locale: string = 'en'): number {
        if (!text?.trim() || minLength < 1) {
            return 0;
        }
        
        const cleanText = this.cleanMarkdown(text);
        
        try {
            const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
            return [...segmenter.segment(cleanText)]
                .filter(w => w.isWordLike && w.segment.length > minLength)
                .length;
        } catch (error) {
            console.warn(`Invalid locale "${locale}", falling back to simple split`, error);
            return cleanText.split(/\s+/) // split by whitespace
                .filter(w => w.length > minLength && /\w/.test(w))
                .length;
        }
    }

    static getTags2(content: string): string[] {
        const regex = /#([a-zA-Zа-яА-ЯёЁ0-9_\-\/]+)/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1] ?? "");
        }
        return matches;
    }

    static getTags(content: string, unique: boolean = true): string[] {
        if (!content?.trim()) {
            return [];
        }
        
        const regex = /#([\p{L}\p{N}_\-\/]+)/gu; // match hashtags with Unicode letters, numbers, _, -, /
        const matches: string[] = [];
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1] ?? "");
        }
        
        return unique ? [...new Set(matches)] : matches;
    }

    static getInternalLinks(content: string): string[] {
        const regex = /\[\[([^\]]+)\]\]/g; // match wiki-style [[text]] links
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1] ?? "");
        }
        return matches;
    }

    static getExternalLinks(content: string): string[] {
        const links: string[] = [];
        
        const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g; // match markdown links [text](http://...)
        let match;
        while ((match = markdownRegex.exec(content)) !== null) {
            links.push(match[2] ?? "");
        }
        
        const urlRegex = /(?<!\]\()https?:\/\/[^\s\)]+/g; // match URLs not part of markdown links
        while ((match = urlRegex.exec(content)) !== null) {
            links.push(match[0]);
        }
        
        return links;
    }

    static countQuestions(text: string): number {
        return (text.replace(/([.!?])[.!?]+/g, '$1').match(/\?/g) || []).length; // Multiple punctuation -> single + match ?
    }

    static countExclamations(text: string): number {
        return (text.replace(/([.!?])[.!?]+/g, '$1').match(/!/g) || []).length; // Multiple punctuation -> single + match !
    }
}

export class MetricsRegistry {
    private metrics: Map<string, AnyMetric> = new Map();
    private qualityScoreConfig: any = null; 
    private pluginSettings: any = null;

    constructor() {
        this.registerAllMetrics();
    }

    updateQualityScoreConfig(config: any): void {
        this.qualityScoreConfig = config;
    }

    setPluginSettings(settings: any): void {
        this.pluginSettings = settings;
    }

    private getEnabledMetricsForQuality(): string[] {
        if (!this.pluginSettings) {
            return [];
        }

        const availableMetrics = [
            'avg_paragraph_length',
            'lix',
            'question_coefficient',
            'exclamation_coefficient',
            'internal_link_density',
            'external_link_density'
        ];
        
        return this.pluginSettings.enabledMetrics.filter((id: string) => 
            availableMetrics.includes(id)
        );
    }

    register(metric: AnyMetric): void {
        this.metrics.set(metric.id, metric);
    }

    get(id: string): AnyMetric | undefined {
        return this.metrics.get(id);
    }

    getAll(): AnyMetric[] {
        return Array.from(this.metrics.values());
    }

    getEnabled(): AnyMetric[] {
        return this.getAll().filter(m => m.enabled);
    }

    getByCategory(category: string): AnyMetric[] {
        return this.getAll().filter(m => m.category === category);
    }

    setEnabled(id: string, enabled: boolean): void {
        const metric = this.metrics.get(id);
        if (metric) {
            metric.enabled = enabled;
        }
    }

    calculateAll(content: string, enabledMetrics: AnyMetric[]): Record<string, number> {
        const results: Record<string, number> = {};
        
        const baseMetrics = enabledMetrics.filter(m => !isCompositeMetric(m)) as Metric[];
        const compositeMetrics = enabledMetrics.filter(m => isCompositeMetric(m)) as CompositeMetric[];
        
        for (const metric of baseMetrics) {
            try {
                results[metric.frontmatterKey] = metric.calculate(content);
            } catch (error) {
                console.error(`Error calculating metric ${metric.id}:`, error);
                results[metric.frontmatterKey] = 0;
            }
        }
        
        for (const metric of compositeMetrics) {
            try {
                const dependencyValues: Record<string, number> = {};
                for (const depId of metric.dependencies) {
                    const depMetric = this.metrics.get(depId);
                    if (depMetric && !isCompositeMetric(depMetric)) {
                        if (results[depMetric.frontmatterKey] !== undefined) {
                            dependencyValues[depId] = results[depMetric.frontmatterKey] ?? 0;
                        } else {
                            dependencyValues[depId] = depMetric.calculate(content);
                        }
                    }
                }
                
                results[metric.frontmatterKey] = metric.calculateFromMetrics(dependencyValues);
            } catch (error) {
                console.error(`Error calculating composite metric ${metric.id}:`, error);
                results[metric.frontmatterKey] = 0;
            }
        }
        
        return results;
    }

        getEnabledMetricsForQualityUI(): string[] {
        return this.getEnabledMetricsForQuality();
    }

    private registerAllMetrics(): void {
        
        // ============================================
        // 1. Structure
        // ============================================

        this.register({
            id: 'avg_paragraph_length',
            name: 'Average Paragraph Length',
            description: 'Average number of words per paragraph',
            frontmatterKey: 'avg_paragraph_length',
            category: 'structure',
            enabled: true,
            calculate: (content: string): number => {
                const paragraphs = TextUtils.getParagraphs(content);
                
                if (paragraphs.length === 0) return 0;

                let totalWords = 0;
                for (const paragraph of paragraphs) {
                    totalWords += TextUtils.countWords(paragraph);
                }

                const avgLength = totalWords / paragraphs.length;
                return Math.round(avgLength * 100) / 100;
            }
        });

        // ============================================
        // 2. Syntax
        // ============================================

        this.register({
            id: 'lix',
            name: 'LIX (Readability Index)',
            description: 'LIX = (words/sentences) + (long_words*100/words). <30=very easy, 30-40=easy, 40-50=medium, 50-60=hard, >60=very hard',
            frontmatterKey: 'lix',
            category: 'syntax',
            enabled: true,
            calculate: (content: string): number => {
                const currentLocale = window.moment.locale();
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter, currentLocale);
                const totalWords = TextUtils.countWords(withoutFrontmatter);
                const longWords = TextUtils.countLongWords(withoutFrontmatter);

                if (sentences.length === 0 || totalWords === 0) return 0;

                const lix = (totalWords / sentences.length) + (longWords * 100 / totalWords);
                return Math.round(lix * 100) / 100;
            }
        });

        // ============================================
        // 3. Semantics
        // ============================================

        this.register({
            id: 'question_coefficient',
            name: 'Question Coefficient',
            description: 'Percentage of sentences that are questions',
            frontmatterKey: 'question_coefficient',
            category: 'semantics',
            enabled: true,
            calculate: (content: string): number => {
                const currentLocale = window.moment.locale();
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter, currentLocale);
                const questions = TextUtils.countQuestions(withoutFrontmatter);

                if (sentences.length === 0) return 0;

                const coefficient = (questions / sentences.length) * 100;
                return Math.round(coefficient * 100) / 100;
            }
        });

        this.register({
            id: 'exclamation_coefficient',
            name: 'Exclamation Coefficient',
            description: 'Percentage of sentences that are exclamations',
            frontmatterKey: 'exclamation_coefficient',
            category: 'semantics',
            enabled: true,
            calculate: (content: string): number => {
                const currentLocale = window.moment.locale();
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter, currentLocale);
                const exclamations = TextUtils.countExclamations(withoutFrontmatter);

                if (sentences.length === 0) return 0;

                const coefficient = (exclamations / sentences.length) * 100;
                return Math.round(coefficient * 100) / 100;
            }
        });

        // ============================================
        // 4. Graph
        // ============================================

        this.register({
            id: 'internal_link_density',
            name: 'Internal Link Density',
            description: 'Internal links per 100 words',
            frontmatterKey: 'internal_link_density',
            category: 'graph',
            enabled: true,
            calculate: (content: string): number => {
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const internalLinks = TextUtils.getInternalLinks(content);
                const totalWords = TextUtils.countWords(withoutFrontmatter);

                if (totalWords === 0) return 0;

                const density = (internalLinks.length / totalWords) * 100;
                return Math.round(density * 100) / 100;
            }
        });

        this.register({
            id: 'external_link_density',
            name: 'External Link Density',
            description: 'External links per 100 words',
            frontmatterKey: 'external_link_density',
            category: 'graph',
            enabled: true,
            calculate: (content: string): number => {
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const externalLinks = TextUtils.getExternalLinks(content);
                const totalWords = TextUtils.countWords(withoutFrontmatter);

                if (totalWords === 0) return 0;

                const density = (externalLinks.length / totalWords) * 100;
                return Math.round(density * 100) / 100;
            }
        });

        // ============================================
        // 5. Composite Metrics
        // ============================================

        this.register({
            id: 'custom_quality_score',
            name: 'Custom Quality Score',
            description: 'Composite quality score based on enabled metrics (0-100 scale). Configure in settings.',
            frontmatterKey: 'custom_quality_score',
            category: 'composite',
            enabled: false,
            dependencies: [
                'avg_paragraph_length',
                'lix',
                'question_coefficient',
                'exclamation_coefficient',
                'internal_link_density',
                'external_link_density'
            ],
            calculateFromMetrics: (metrics: Record<string, number>): number => {
                if (!this.qualityScoreConfig) {
                    console.error('Quality Score config not loaded');
                    return 0;
                }

                const { weights, ranges } = this.qualityScoreConfig;
                const enabledMetrics = this.getEnabledMetricsForQuality();

                if (enabledMetrics.length === 0) {
                    console.warn('No enabled metrics for Quality Score calculation');
                    return 0;
                }

                const normalize = (value: number, range: any): number => {
                    const { min, optimal_min, optimal_max, max } = range;

                    if (value >= optimal_min && value <= optimal_max) {
                        return 1.0;
                    }

                    if (value < optimal_min) {
                        if (value <= min) return 0;
                        return (value - min) / (optimal_min - min);
                    }

                    if (value > optimal_max) {
                        if (value >= max) return 0;
                        return 1 - ((value - optimal_max) / (max - optimal_max));
                    }

                    return 0;
                };

                const scores: Record<string, number> = {};
                let totalWeight = 0;

                for (const metricId of enabledMetrics) {
                    const value = metrics[metricId];
                    
                    if (value === undefined || value === null) {
                        continue;
                    }

                    const range = ranges[metricId];
                    const weight = weights[metricId];

                    if (range && weight !== undefined) {
                        const normalizedScore = normalize(value, range);
                        scores[metricId] = normalizedScore;
                        totalWeight += weight;
                    }
                }

                if (totalWeight === 0) {
                    console.warn('No valid metrics for Quality Score calculation');
                    return 0;
                }

                let weightedSum = 0;
                for (const metricId of enabledMetrics) {
                    if (scores[metricId] !== undefined) {
                        const score = scores[metricId];
                        const weight = weights[metricId];
                        const contribution = score * weight;
                        weightedSum += contribution;
                    }
                }
                const normalizedScore = weightedSum / totalWeight;
                const finalScore = Math.round(normalizedScore * 100 * 100) / 100;
                
                return finalScore;
            }
        } as CompositeMetric);
    }
}