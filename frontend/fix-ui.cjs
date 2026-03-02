const fs = require('fs');
const path = require('path');

const targetDir = 'd:/morphous/main/aamba/frontend/src';

const replacements = [
    // 1. Text sizes (bump up egregiously small text)
    { regex: /text-\[8px\]/g, replacement: 'text-xs' },
    { regex: /text-\[9px\]/g, replacement: 'text-xs' },
    { regex: /text-\[10px\]/g, replacement: 'text-sm' },
    { regex: /text-\[11px\]/g, replacement: 'text-sm' },

    // 2. Backgrounds
    { regex: /bg-slate-950(\/\d+)?/g, replacement: 'bg-card-bg' },
    { regex: /bg-slate-900(\/\d+)?/g, replacement: 'bg-card-bg' },
    { regex: /bg-slate-800(\/\d+)?/g, replacement: 'bg-bg-primary' },
    { regex: /bg-fintech-dark/g, replacement: 'bg-card-bg' },

    // 3. Text colors
    { regex: /text-slate-(400|500|600)/g, replacement: 'text-text-secondary' },
    { regex: /text-slate-(300|700|800|900)/g, replacement: 'text-text-primary' },
    { regex: /\btext-white\b/g, replacement: 'text-text-primary' }, // Safe because button CSS already defines text color

    // 4. Borders
    { regex: /border-slate-(950|900|800|700|600)(\/\d+)?/g, replacement: 'border-border' },

    // 5. Specific hardcoded inline styles in Sidebar.jsx etc
    { regex: /var\(--surface\)/g, replacement: 'var(--card-bg)' }
];

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(fullPath));
        } else if (file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walkDir(targetDir);
let changedFilesCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalClassCount = content.length;
    let modified = false;

    replacements.forEach(({ regex, replacement }) => {
        if (regex.test(content)) {
            content = content.replace(regex, replacement);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        changedFilesCount++;
        console.log(`Updated: ${file}`);
    }
});

console.log(`\nSuccess! Replaced dark classes and tiny text in ${changedFilesCount} files.`);
