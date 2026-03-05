import { App, PluginSettingTab, Setting } from 'obsidian';
import AverageParagraphLengthPlugin from './main';
import { AnyMetric } from './metrics';

export interface MetricRange {
    min: number;
    optimal_min: number;
    optimal_max: number;
    max: number;
}

export interface QualityScoreConfig {
    weights: {
        avg_paragraph_length: number;
        avg_chapter_length: number;
        lix: number;
        question_coefficient: number;
        exclamation_coefficient: number;
        internal_link_density: number;
        internal_dead_link_density: number;
        external_link_density: number;
    };
    ranges: {
        avg_paragraph_length: MetricRange;
        avg_chapter_length: MetricRange;
        lix: MetricRange;
        question_coefficient: MetricRange;
        exclamation_coefficient: MetricRange;
        internal_link_density: MetricRange;
        internal_dead_link_density: MetricRange;
        external_link_density: MetricRange;
    };
}

export interface PluginSettings {
    enabledMetrics: string[]; // metrics ids
    qualityScoreConfig: QualityScoreConfig;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    enabledMetrics: [
        'avg_paragraph_length',
        'avg_chapter_length',
        'lix',
        'question_coefficient',
        'exclamation_coefficient',
        'internal_link_density',
        'internal_dead_link_density',
        'external_link_density',
        'custom_quality_score'
    ], // by default all metrics are enabled
    qualityScoreConfig: {
        weights: {
            avg_paragraph_length: 0.1,
            avg_chapter_length: 0.1,
            lix: 0.20,
            question_coefficient: 0.15,
            exclamation_coefficient: 0.15,
            internal_link_density: 0.10,
            internal_dead_link_density: 0.10,
            external_link_density: 0.10
        },
        ranges: {
            avg_paragraph_length: {
                min: 0,
                optimal_min: 30,
                optimal_max: 60,
                max: 150
            },
            avg_chapter_length: {
                min: 0,
                optimal_min: 90,
                optimal_max: 120,
                max: 200
            },
            lix: {
                min: 0,
                optimal_min: 30,
                optimal_max: 40,
                max: 90
            },
            question_coefficient: {
                min: 0,
                optimal_min: 0,
                optimal_max: 15,
                max: 100
            },
            exclamation_coefficient: {
                min: 0,
                optimal_min: 0,
                optimal_max: 5,
                max: 100
            },
            internal_link_density: {
                min: 0,
                optimal_min: 1,
                optimal_max: 5,
                max: 100
            },
            internal_dead_link_density: {
                min: 0,
                optimal_min: 0,
                optimal_max: 0.5,
                max: 100
            },
            external_link_density: {
                min: 0,
                optimal_min: 0.5,
                optimal_max: 3,
                max: 100
            }
        }
    }
}

export class SettingTab extends PluginSettingTab {
    plugin: AverageParagraphLengthPlugin;
    weightSumEl: HTMLElement;
    weightSumValueEl: HTMLElement;

    constructor(app: App, plugin: AverageParagraphLengthPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    } 

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
		/*containerEl.createEl('h2', { 
			text: 'Metric settings', 
			cls: 'settings-header'
		});*/
        new Setting(containerEl).setName('Metrics').setHeading();

        containerEl.createEl('p', { 
            text: 'Select metrics to enable or disable them. Disabled metrics will not be calculated or included in the quality score calculation.',
			cls: 'settings-small-text'
        });

        const categories = [
            { id: 'structure', name: 'Structure Metrics' },
            { id: 'syntax', name: 'Syntax Metrics' },
            { id: 'semantics', name: 'Semantics Metrics' },
            { id: 'graph', name: 'Graph & Connectivity Metrics' },
            { id: 'composite', name: 'Composite Metrics' }
        ];

        for (const category of categories) {
            //containerEl.createEl('h3', { text: category.name });
            
            const metrics: AnyMetric[] = this.plugin.metricsRegistry.getByCategory(category.id);
            
            for (const metric of metrics) {
                new Setting(containerEl)
                    .setName(metric.name)
                    .setDesc(metric.description)
                    .addToggle(toggle => toggle
                        .setValue(metric.enabled)
                        .onChange(async (value) => {
                            this.plugin.metricsRegistry.setEnabled(metric.id, value);
                            
                            if (value) {
                                if (!this.plugin.settings.enabledMetrics.includes(metric.id)) {
                                    this.plugin.settings.enabledMetrics.push(metric.id);
                                }
                            } else {
                                this.plugin.settings.enabledMetrics = 
                                    this.plugin.settings.enabledMetrics.filter(id => id !== metric.id);
                            }
                            
                            await this.plugin.saveSettings();
                            this.display();
                        }));
            }
        }

        // containerEl.createEl('h2', { 
		// 	text: 'Custom Quality Score Configuration',
		// 	cls: 'settings-header'
		// });
        
        const enabledForQuality = this.plugin.metricsRegistry.getEnabledMetricsForQuality();
        const isCustomQualityScoreEnabled = this.plugin.metricsRegistry.getEnabled().filter(metric => metric.id === 'custom_quality_score').length > 0;

        // containerEl.createEl('p', {
        //     text: 'Configure weights and optimal ranges for the quality score calculation. Weights must sum to 1.0 (100%).',
		// 	cls: 'settings-small-text'
        // });

        if (enabledForQuality.length === 0 && isCustomQualityScoreEnabled) {
            const warningEl = containerEl.createEl('div', { cls: 'mod-warning' });
            warningEl.createEl('strong', { text: '⚠️ warning: ' });
            warningEl.appendText('No metrics are enabled for Quality Score calculation. Enable at least one metric above (avg_paragraph_length, avg_chapter_length, lix, question_coefficient, exclamation_coefficient, internal_link_density, or external_link_density).');
        }

        /*containerEl.createEl('h2', { 
			text: 'Metric weights for custom quality score metric',
			cls: 'settings-header'
		});*/
        
        new Setting(containerEl).setName('Metric weights for custom quality score metric').setHeading();

        containerEl.createEl('p', {
            text: 'Weights are automatically normalized based on enabled metrics. You can set any values - they will be scaled proportionally.',
			cls: 'settings-small-text'
        });
        
        this.addWeightSetting(containerEl, 'avg_paragraph_length', 'Average Paragraph Length', enabledForQuality);
        this.addWeightSetting(containerEl, 'avg_chapter_length', 'Average Chapter Length', enabledForQuality);
        this.addWeightSetting(containerEl, 'lix', 'LIX (Readability)', enabledForQuality);
        this.addWeightSetting(containerEl, 'question_coefficient', 'Question Coefficient', enabledForQuality);
        this.addWeightSetting(containerEl, 'exclamation_coefficient', 'Exclamation Coefficient', enabledForQuality);
        this.addWeightSetting(containerEl, 'internal_link_density', 'Internal Link Density', enabledForQuality);
        this.addWeightSetting(containerEl, 'internal_dead_link_density', 'Internal Dead Link Density', enabledForQuality);
        this.addWeightSetting(containerEl, 'external_link_density', 'External Link Density', enabledForQuality);
        
        this.weightSumEl = containerEl.createEl('div', { cls: 'setting-item' });

        this.weightSumValueEl = this.weightSumEl.createEl('strong', {
            text: `Sum of enabled weights: ${this.calculateWeightSum(enabledForQuality).toFixed(2)} `
        });

        this.weightSumEl.createEl('span', {
            text: '(normalized automatically during calculation)',
            cls: 'setting-item-description'
        });
        
        /*containerEl.createEl('h2', { 
			text: 'Optimal ranges for custom quality score metric',
			cls: 'settings-header'
		});*/
        new Setting(containerEl).setName('Optimal ranges for custom quality score metric').setHeading();

        containerEl.createEl('p', {
            text: 'Define what values are considered optimal for each metric. Values outside the optimal range will be penalized.',
			cls: 'settings-small-text'
        });

        this.addRangeSetting(containerEl, 'avg_paragraph_length', 'Average Paragraph Length', 'words');
        this.addRangeSetting(containerEl, 'avg_chapter_length', 'Average Chapter Length', 'words');
        this.addRangeSetting(containerEl, 'lix', 'LIX', 'points');
        this.addRangeSetting(containerEl, 'question_coefficient', 'Question Coefficient', '%');
        this.addRangeSetting(containerEl, 'exclamation_coefficient', 'Exclamation Coefficient', '%');
        this.addRangeSetting(containerEl, 'internal_link_density', 'Internal Link Density', '%');
        this.addRangeSetting(containerEl, 'internal_dead_link_density', 'Internal Dead Link Density', '%');
        this.addRangeSetting(containerEl, 'external_link_density', 'External Link Density', '%');

		/*containerEl.createEl('h2', { 
			text: 'Other settings',
			cls: 'settings-header'
		});*/
        new Setting(containerEl).setName('Other').setHeading();

        containerEl.createEl('p', {
            text: 'Other miscellaneous settings for the plugin.',
			cls: 'settings-small-text'
        });

        new Setting(containerEl)
            .setName('Calculate metrics')
            .setDesc('Calculate enabled metrics for all notes')
            .addButton(button => button
                .setButtonText('Calculate')
                .setCta()
                .onClick(async () => {
                    await this.plugin.calculateMetricsForAllNotes();                    
                }));

       new Setting(containerEl)
            .setName('Reset to defaults')
            .setDesc('Reset all settings to default values')
            .addButton(button => button
                .setButtonText('Reset')
                .setCta()
                .onClick(async () => {
                    const defaultSettingsString: string = JSON.stringify(DEFAULT_SETTINGS);
                    this.plugin.settings = JSON.parse(defaultSettingsString) as PluginSettings;
                    await this.plugin.saveSettings();
                    
                    this.plugin.metricsRegistry.updateQualityScoreConfig(this.plugin.settings.qualityScoreConfig);
                    this.plugin.applySavedMetricStates();
                    
                    this.display();
                }));

        new Setting(this.containerEl)
			.setName("Delete selected plugin YAML tags")
			.setDesc("Removes selected plugin-related YAML keys from all notes")
			.addButton(btn =>
				btn
					.setButtonText("Delete enabled metrics")
					.setWarning()
					.onClick(async () => {
						await this.plugin.deletePluginYamlTags(this.plugin.settings.enabledMetrics);
					})
			);

        new Setting(this.containerEl)
			.setName("Delete all plugin YAML tags")
			.setDesc("Removes all plugin-related YAML keys from all notes")
			.addButton(btn =>
				btn
					.setButtonText("Delete all metrics")
					.setWarning()
					.onClick(async () => {
						await this.plugin.deletePluginYamlTags(DEFAULT_SETTINGS.enabledMetrics);
					})
			);
    }

    private calculateWeightSum(enabledForQuality: string[]): number {
        return Object.entries(this.plugin.settings.qualityScoreConfig.weights)
            .filter(([key]) => enabledForQuality.includes(key))
            .reduce((sum, [, weight]) => sum + (weight), 0);
    }

    private addWeightSetting(containerEl: HTMLElement, metricId: string, displayName: string, enabledMetrics: string[]) {
        const key = metricId as keyof typeof this.plugin.settings.qualityScoreConfig.weights;
        const isEnabled = enabledMetrics.includes(metricId);
        
        const setting = new Setting(containerEl)
            .setName(displayName + (isEnabled ? '' : ' (disabled)'))
            .setDesc(`Current: ${this.plugin.settings.qualityScoreConfig.weights[key].toFixed(2)}`);

        if (!isEnabled) {
            setting.setClass('mod-disabled');
        }
        
        setting.addSlider(slider => slider
            .setLimits(0, 1, 0.05)
            .setValue(this.plugin.settings.qualityScoreConfig.weights[key])
            .setDynamicTooltip()
            .setDisabled(!isEnabled)
            .onChange(async (value) => {
                this.plugin.settings.qualityScoreConfig.weights[key] = value;
                await this.plugin.saveSettings();

                this.plugin.metricsRegistry.updateQualityScoreConfig(
                    this.plugin.settings.qualityScoreConfig
                );

                setting.setDesc(`Current: ${value.toFixed(2)}`);

                if (this.weightSumValueEl) {
                    const sum = this.calculateWeightSum(enabledMetrics);
                    this.weightSumValueEl.setText(
                        `Sum of enabled weights: ${sum.toFixed(2)} `
                    );
                }
            }));
    }

    private addRangeSetting(containerEl: HTMLElement, metricId: string, displayName: string, unit: string) {
        const key = metricId as keyof typeof this.plugin.settings.qualityScoreConfig.ranges;
        const range = this.plugin.settings.qualityScoreConfig.ranges[key];

        const settingEl = new Setting(containerEl)
            .setName(`${displayName}, ${unit}`);

        const rangeContainer = settingEl.controlEl.createDiv({ cls: 'metric-range-settings' });

        const createField = (labelText: string, value: string) => {
            const label = rangeContainer.createEl('label', { text: labelText });
            label.setCssProps({ fontSize: '0.6em' });
            const input = rangeContainer.createEl('input', { type: 'number', value });
            input.setCssProps({ width: '40px', marginRight: '10px', fontSize: '0.6em' });
            return input;
        };

        const absMinInput = createField('Min: ', range.min.toString());
        const optMinInput = createField('Optimal min: ', range.optimal_min.toString());
        const optMaxInput = createField('Optimal max: ', range.optimal_max.toString());
        const absMaxInput = createField('Max: ', range.max.toString());

        const errorEl = settingEl.controlEl.createDiv({ cls: 'metric-range-error' });
        errorEl.setCssProps({ color: 'var(--text-error)', fontSize: '0.8em', marginTop: '4px', display: 'none' });

        const showError = (msg: string) => {
            errorEl.setText(msg);
            errorEl.setCssProps({ display: 'block' });
            [absMinInput, optMinInput, optMaxInput, absMaxInput].forEach(input =>
                input.setCssProps({ borderColor: 'var(--text-error)' })
            );
        };

        const clearError = () => {
            errorEl.setText('');
            errorEl.setCssProps({ display: 'none' });
            [absMinInput, optMinInput, optMaxInput, absMaxInput].forEach(input =>
                input.setCssProps({ borderColor: '' })
            );
        };

        const updateRange = async () => {
            const newAbsMin = parseFloat(absMinInput.value);
            const newOptMin = parseFloat(optMinInput.value);
            const newOptMax = parseFloat(optMaxInput.value);
            const newAbsMax = parseFloat(absMaxInput.value);

            if (isNaN(newAbsMin) || isNaN(newOptMin) || isNaN(newOptMax) || isNaN(newAbsMax)) {
                showError('All fields must be valid numbers.');
                return;
            }
            if (newAbsMin > newOptMin) {
                showError(`Min (${newAbsMin}) must be ≤ Optimal min (${newOptMin}).`);
                return;
            }
            if (newOptMin >= newOptMax) {
                showError(`Optimal min (${newOptMin}) must be < Optimal max (${newOptMax}).`);
                return;
            }
            if (newOptMax > newAbsMax) {
                showError(`Optimal max (${newOptMax}) must be ≤ Max (${newAbsMax}).`);
                return;
            }

            clearError();
            this.plugin.settings.qualityScoreConfig.ranges[key].min = newAbsMin;
            this.plugin.settings.qualityScoreConfig.ranges[key].optimal_min = newOptMin;
            this.plugin.settings.qualityScoreConfig.ranges[key].optimal_max = newOptMax;
            this.plugin.settings.qualityScoreConfig.ranges[key].max = newAbsMax;
            await this.plugin.saveSettings();
            this.plugin.metricsRegistry.updateQualityScoreConfig(this.plugin.settings.qualityScoreConfig);
        };

        absMinInput.addEventListener('blur', () => void updateRange());
        optMinInput.addEventListener('blur', () => void updateRange());
        optMaxInput.addEventListener('blur', () => void updateRange());
        absMaxInput.addEventListener('blur', () => void updateRange());
    }
}