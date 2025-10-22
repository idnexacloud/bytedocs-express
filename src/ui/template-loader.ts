/**
 * ByteDocs Express - Template Loader
 * Load and render HTML templates
 */

import fs from 'fs';
import path from 'path';

/**
 * Template cache
 */
const templateCache = new Map<string, string>();

/**
 * Load template file
 */
export function loadTemplate(templateName: string): string {
  // Check cache first
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const templatePath = path.join(__dirname, 'templates', templateName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  const content = fs.readFileSync(templatePath, 'utf-8');
  templateCache.set(templateName, content);

  return content;
}

/**
 * Render template with data (simple template engine)
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  // Replace {{.Variable}} patterns (Go template style)
  rendered = rendered.replace(/\{\{\.(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : '';
  });

  // Replace {{if .Condition}}...{{end}} patterns
  rendered = rendered.replace(
    /\{\{if\s+\.(\w+)\}\}([\s\S]*?)\{\{end\}\}/g,
    (match, key, content) => {
      return data[key] ? content : '';
    }
  );

  // Replace {{range .Array}}...{{end}} patterns
  rendered = rendered.replace(
    /\{\{range\s+\.(\w+)\}\}([\s\S]*?)\{\{end\}\}/g,
    (match, key, content) => {
      const array = data[key];
      if (!Array.isArray(array)) {
        return '';
      }

      return array
        .map(item => {
          return content.replace(/\{\{\.(\w+)?\}\}/g, (_m: string, itemKey?: string) => {
            if (!itemKey) return String(item);
            return item[itemKey] !== undefined ? String(item[itemKey]) : '';
          });
        })
        .join('');
    }
  );

  return rendered;
}

/**
 * Clear template cache (for development)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
