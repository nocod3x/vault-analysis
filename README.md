# Vault Analysis Plugin

This plugin calculates specific quality metrics for each note and adds them as custom YAML tags at the top of the note:
- Average paragraph length (yaml name: avg_paragraph_length)
- Lix method (yaml name: lix)
- Question coefficient (yaml name: question_coefficient)
- Exclamation coefficient (exclamation_coefficient)
- Internal link density (yaml name: internal_link_density)
- External link density (yaml name: external_link_density)
- Custom quality score (yaml name: custom_quality_score)
You can use it together with Bases to create powerful workflows, such as sorting notes by metrics (for example `custom_quality_score`) or create your own formulas with plugin metrics.
*Example: a Bases view sorted by `custom_quality_score` to quickly identify high-quality notes.*

---
## Getting Started

### 1. Install the Plugin
Install the plugin from the **Community Plugins** tab in Obsidian.
### 2. Enable the Plugin
Turn the plugin on in the settings panel after installation.
### 3. Configure Metrics
Set up the metrics according to your needs:
- Enable the metrics you want to use
- Assign weights to each metric (higher weight = greater importance)
- Define optimal ranges (what values are considered “normal” for your notes)
- If needed, restore default settings using the **Reset** button in Settings
### 4. Calculate Metrics
You can calculate metrics in two ways:
- Click **Calculate** in Settings
- Run the command `calculate-all-metrics`
### 5. Create a Base and Analyse Results
Create a base to analyze all your notes together using the selected metrics. Then review and interpret the calculated results.
### 6. Delete Metrics (Optional)
You can remove calculated metrics in two ways:
- **Delete enabled metrics**
    - Click **Delete enabled metrics** in Settings
    - Or run the command `clean-yaml-selected-notes`
- **Delete all metrics**
    - Click **Delete all metrics** in Settings
    - Or run the command `clean-yaml-all-notes`

---
## Metrics Description

### Average paragraph length (`avg_paragraph_length`)
Shows the average length of your paragraphs.
- **How it’s calculated:** Total word count divided by the number of paragraphs (divider - `\n\n`).
- **What it means:** Higher values usually mean longer, denser paragraphs that may be harder to skim. Lower values mean shorter paragraphs, which can feel more broken up.

---
### Average chapter length (`avg_chapter_length`)
Shows the average length of your chapters.
- **How it’s calculated:** Total word count divided by the number of chapters (divider - `#`).
- **What it means:** Higher values suggest longer sections. Lower values suggest shorter, more divided chapters.

---
### LIX readability (`lix`)
A classic readability formula that estimates how difficult your text is to read.
- **How it’s calculated:** Based on sentence length (words per sentence) and word complexity (percentage of words longer than 6 letters).
- **Scale:**
    - **< 30:** Very easy (children’s books)
    - **30–40:** Easy (popular fiction)
    - **40–50:** Medium (news articles)
    - **50–60:** Hard (professional or official texts)
    - **> 60:** Very hard (academic or legal writing)

---
### Question coefficient (`question_coefficient`)
Shows how often you ask questions in your writing.
- **How it’s calculated:** Percentage of sentences ending with a question mark.
- **What it means:** Higher values suggest a conversational or exploratory tone. Lower values indicate a more declarative style.

---
### Exclamation coefficient (`exclamation_coefficient`)
Tracks emphasis and emotional intensity.
- **How it’s calculated:** Percentage of sentences ending with an exclamation mark.
- **What it means:** High values suggest energy or urgency. In professional writing, too many exclamations may feel informal or overly dramatic.

---
### Internal link density (`internal_link_density`)
Measures how well a note is connected within your knowledge base.
- **How it’s calculated:** Number of internal links per 100 words.
- **What it means:** Higher density suggests strong integration with your existing notes and ideas.

---
### Internal dead link density (`internal_dead_link_density`)
Measures how many internal links in a note point to notes that don’t exist.
- **How it’s calculated:** Number of dead internal links per 100 internal links.
- **What it means:** Higher values indicate more broken references in the note. Lower values suggest that most links correctly point to existing notes.

---
### External link density (`external_link_density`)
Measures how much your note relies on outside sources.
- **How it’s calculated:** Number of external URLs per 100 words.
- **What it means:** Higher values often indicate research-heavy content. Lower values suggest more standalone or original writing.

---
### Custom quality score (`custom_quality_score`)
A combined score representing the overall “health” of your note.
- **How it’s calculated:** Each metric is compared against your defined optimal ranges. Your chosen weights are applied, and the result is normalized to a score from 0 to 100.
- **What it means:** The closer the score is to 100, the more your note aligns with your personal definition of quality.

---