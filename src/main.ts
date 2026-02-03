import { App, Plugin, TFile, Notice } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, SettingTab } from './settings';
import { MetricsRegistry, Metric } from './metrics';
import yaml from "js-yaml";

export default class AverageParagraphLengthPlugin extends Plugin {
    settings: PluginSettings;
    metricsRegistry: MetricsRegistry;

    async onload() {
        console.log('Loading Note Metrics Plugin');

        this.metricsRegistry = new MetricsRegistry();

        await this.loadSettings();

        this.metricsRegistry.setPluginSettings(this.settings);

        this.metricsRegistry.updateQualityScoreConfig(this.settings.qualityScoreConfig);

        this.applySavedMetricStates();

        this.addSettingTab(new SettingTab(this.app, this));

        this.addRibbonIcon('calculator', 'Calculate Note Metrics', async () => {
            await this.calculateMetricsForAllNotes();
        });

        this.addCommand({
            id: 'calculate-all-metrics',
            name: 'Calculate metrics for all notes',
            callback: async () => {
                await this.calculateMetricsForAllNotes();
            }
        });

        this.addCommand({
			id: "clean-yaml-selected-notes",
			name: "Delete selected YAML tags for all notes",
			callback: () => this.deletePluginYamlTags(this.settings.enabledMetrics)
		});

        this.addCommand({
			id: "clean-yaml-all-notes",
			name: "Delete all YAML tags for all notes",
			callback: () => this.deletePluginYamlTags(DEFAULT_SETTINGS.enabledMetrics)
		});
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    applySavedMetricStates() {
        const allMetrics = this.metricsRegistry.getAll();
        
        for (const metric of allMetrics) {
            const isEnabled = this.settings.enabledMetrics.includes(metric.id);
            this.metricsRegistry.setEnabled(metric.id, isEnabled);
        }
    }

    async deletePluginYamlTags(enabledMetrics: string[]) {
		const files = this.app.vault.getMarkdownFiles();
		let modifiedCount = 0;

		for (const file of files) {
			const content = await this.app.vault.read(file);
			if (!content.startsWith("---")) continue;

			const match = content.match(/^---\n([\s\S]*?)\n---/);
			if (!match) continue;

			let data: any;
			try {
				data = yaml.load(match[1] ?? "");
			} catch {
				continue;
			}

			if (!data || typeof data !== "object") continue;

			let changed = false;
			for (const key of enabledMetrics) {
				if (key in data) {
					delete data[key];
					changed = true;
				}
			}

			if (!changed) continue;

			const newYaml = Object.keys(data).length
				? `---\n${yaml.dump(data).trim()}\n---`
				: "";

			const newContent = newYaml + content.slice(match[0].length + (newYaml.length > 0 ? 0 : 1));
			await this.app.vault.modify(file, newContent);
			modifiedCount++;
		}

		new Notice(`Removed plugin YAML tags from ${modifiedCount} notes`);
	}

    async calculateMetricsForAllNotes() {
        const files = this.app.vault.getMarkdownFiles();
        const enabledMetrics = this.metricsRegistry.getEnabled();

        if (enabledMetrics.length === 0) {
            new Notice('No metrics enabled. Please enable metrics in settings.');
            return;
        }

        let processedCount = 0;
        let errorCount = 0;

        new Notice(`Calculating ${enabledMetrics.length} metric(s) for ${files.length} note(s)...`);

        for (const file of files) {
            try {
                await this.processFile(file, enabledMetrics);
                processedCount++;
            } catch (error) {
                console.error(`Error processing file ${file.path}:`, error);
                errorCount++;
            }
        }

        new Notice(`Completed! Processed: ${processedCount}, Errors: ${errorCount}`);
    }

    async processFile(file: TFile, metrics: any[]) {
        const content = await this.app.vault.read(file);
        
        const results = this.metricsRegistry.calculateAll(content, metrics);
        //console.log(results);
        await this.updateFrontmatter(file, results);
    }

    async updateFrontmatter(file: TFile, metrics: Record<string, number>) {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            for (const [key, value] of Object.entries(metrics)) {
                frontmatter[key] = value;
            }
        });
    }

    onunload() {
        console.log('Unloading Note Metrics Plugin');
    }
}