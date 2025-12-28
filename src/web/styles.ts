/**
 * Embedded CSS styles for trajectory viewer
 */

export const styles = `
:root {
  --bg: #ffffff;
  --bg-secondary: #f8f9fa;
  --text: #1a1a2e;
  --text-muted: #6c757d;
  --border: #e9ecef;
  --accent: #4f46e5;
  --accent-light: #eef2ff;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a2e;
    --bg-secondary: #16213e;
    --text: #e9ecef;
    --text-muted: #adb5bd;
    --border: #2d3748;
    --accent: #818cf8;
    --accent-light: #1e1b4b;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

h1, h2, h3 {
  margin-bottom: 0.5rem;
}

h1 {
  font-size: 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

h2 {
  font-size: 1.25rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
  margin-top: 1.5rem;
}

.header {
  border-bottom: 2px solid var(--border);
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.meta-value {
  font-weight: 500;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-active {
  background: var(--accent-light);
  color: var(--accent);
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-abandoned {
  background: #fee2e2;
  color: #991b1b;
}

.section {
  margin: 1.5rem 0;
}

.collapsible {
  cursor: pointer;
  user-select: none;
}

.collapsible::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.2s;
}

.collapsible.open::before {
  transform: rotate(90deg);
}

.collapsible-content {
  display: none;
  margin-top: 0.5rem;
  padding-left: 1rem;
  border-left: 2px solid var(--border);
}

.collapsible.open + .collapsible-content {
  display: block;
}

.decision {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  margin: 0.75rem 0;
  border-left: 3px solid var(--accent);
}

.decision-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.decision-reasoning {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.alternatives {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.alternatives-label {
  color: var(--text-muted);
}

.timeline {
  position: relative;
  padding-left: 1.5rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 0.35rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border);
}

.timeline-item {
  position: relative;
  margin: 1rem 0;
  padding-left: 1rem;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: -1.15rem;
  top: 0.5rem;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
}

.timeline-item.decision::before {
  background: var(--warning);
}

.timeline-item.chapter::before {
  background: var(--success);
}

.timeline-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.timeline-content {
  margin-top: 0.25rem;
}

.chapter {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.chapter-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chapter-agent {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.retrospective {
  background: linear-gradient(135deg, var(--accent-light), var(--bg-secondary));
  border-radius: 8px;
  padding: 1.5rem;
  margin: 1.5rem 0;
}

.retrospective h3 {
  margin-bottom: 1rem;
}

.confidence {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.confidence-bar {
  flex: 1;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  max-width: 200px;
}

.confidence-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

.list {
  list-style: none;
}

.list li {
  padding: 0.25rem 0;
  padding-left: 1rem;
  position: relative;
}

.list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent);
}

.files-changed {
  font-family: monospace;
  font-size: 0.85rem;
  background: var(--bg-secondary);
  padding: 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
}

.empty {
  color: var(--text-muted);
  font-style: italic;
}

/* Index page styles */
.trajectory-list {
  list-style: none;
}

.trajectory-card {
  display: block;
  padding: 1rem;
  margin: 0.5rem 0;
  background: var(--bg-secondary);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
  border: 1px solid var(--border);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.trajectory-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.trajectory-card-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.trajectory-card-meta {
  font-size: 0.85rem;
  color: var(--text-muted);
  display: flex;
  gap: 1rem;
}

.group-header {
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
`;
