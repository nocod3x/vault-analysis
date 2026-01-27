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
    static removeFrontmatter(content: string): string {
        return content.replace(/^---\n[\s\S]*?\n---\n/, '');
    }

    static getParagraphs(content: string): string[] {
        const withoutFrontmatter = this.removeFrontmatter(content);
        return withoutFrontmatter
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }

    static cleanMarkdown(text: string): string {
        return text
            .replace(/!\[.*?\]\(.*?\)/g, '') // delete img
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // replace links with text
            .replace(/[#*_~`]/g, '') // delete markdown symbols
            .trim();
    }

    static countWords(text: string): number {
        const cleanText = this.cleanMarkdown(text);
        const words = cleanText.split(/\s+/).filter(w => w.length > 0);
        return words.length;
    }

    static getSentences(text: string): string[] {
        //delete 
        let processedText = text
            // english
            .replace(/\betc\./gi, 'ETC_ABR')
            .replace(/\be\.g\./gi, 'EG_ABR')
            .replace(/\bi\.e\./gi, 'IE_ABR')
            .replace(/\bvs\./gi, 'VS_ABR')
            .replace(/\bMr\./g, 'MR_ABR')
            .replace(/\bMrs\./g, 'MRS_ABR')
            .replace(/\bMs\./g, 'MS_ABR')
            .replace(/\bDr\./g, 'DR_ABR')
            .replace(/\bProf\./g, 'PROF_ABR');

        const sentences = processedText
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // return to original
        return sentences.map(s => s
            //english
            .replace(/ETC_ABR/g, 'etc.')
            .replace(/EG_ABR/g, 'e.g.')
            .replace(/IE_ABR/g, 'i.e.')
            .replace(/VS_ABR/g, 'vs.')
            .replace(/MR_ABR/g, 'Mr.')
            .replace(/MRS_ABR/g, 'Mrs.')
            .replace(/MS_ABR/g, 'Ms.')
            .replace(/DR_ABR/g, 'Dr.')
            .replace(/PROF_ABR/g, 'Prof.')
        );
    }

    static getInternalLinks(content: string): string[] {
        const regex = /\[\[([^\]]+)\]\]/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1] ?? "");
        }
        return matches;
    }

    static getExternalLinks(content: string): string[] {
        const links: string[] = [];
        
        const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
        let match;
        while ((match = markdownRegex.exec(content)) !== null) {
            links.push(match[2] ?? "");
        }
        
        const urlRegex = /(?<!\]\()https?:\/\/[^\s\)]+/g;
        while ((match = urlRegex.exec(content)) !== null) {
            links.push(match[0]);
        }
        
        return links;
    }

    static getTags(content: string): string[] {
        const regex = /#([a-zA-Zа-яА-ЯёЁ0-9_\-\/]+)/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1] ?? "");
        }
        return matches;
    }

    static countQuestions(text: string): number {
        return (text.match(/\?/g) || []).length;
    }

    static countExclamations(text: string): number {
        return (text.match(/!/g) || []).length;
    }

    static countLongWords(text: string): number {
        const cleanText = this.cleanMarkdown(text);
        const words = cleanText.split(/\s+/);
        return words.filter(w => w.length > 6).length;
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
            description: 'LIX = (words/sentences) + (long_words*100/words). <30=easy, 30-40=medium, 40-50=hard, >50=very hard',
            frontmatterKey: 'lix',
            category: 'syntax',
            enabled: true,
            calculate: (content: string): number => {
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter);
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
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter);
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
                const withoutFrontmatter = TextUtils.removeFrontmatter(content);
                const sentences = TextUtils.getSentences(withoutFrontmatter);
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
                        //console.log(`Metric: ${metricId}, Value: ${value}, Normalized: ${normalizedScore}, Weight: ${weight}`);
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
                        //console.log(`${metricId}: score=${score} * weight=${weight} = ${contribution}`);
                    }
                }

                //console.log(`Total: weightedSum=${weightedSum}, totalWeight=${totalWeight}`);

                const normalizedScore = weightedSum / totalWeight;
                const finalScore = Math.round(normalizedScore * 100 * 100) / 100;
                //console.log(`Final score: ${normalizedScore} * 100 = ${finalScore}`);
                
                return finalScore;
            }
        } as CompositeMetric);
    }
}