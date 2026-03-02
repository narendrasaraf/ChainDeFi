const fs = require('fs');
const path = require('path');

const targetDir = 'd:/morphous/main/aamba/frontend/src';

const replacements = [
    // 1. Clean up orphaned prefixes from previous aggressive regex
    { regex: /\bdrop-\b/g, replacement: '' },
    { regex: /! /g, replacement: '' },
    { regex: /! "/g, replacement: '"' },

    // 2. Eradicate ALL Tailwind opacity modifiers on standardized tokens
    { regex: /bg-card-bg\/\d+/g, replacement: 'bg-card-bg' },
    { regex: /bg-bg-primary\/\d+/g, replacement: 'bg-bg-primary' },
    { regex: /text-text-primary\/\d+/g, replacement: 'text-text-primary' },
    { regex: /text-text-secondary\/\d+/g, replacement: 'text-text-secondary' },
    { regex: /text-brand-accent\/\d+/g, replacement: 'text-brand-accent' },
    { regex: /border-border\/\d+/g, replacement: 'border-border' },

    // 3. Any stray opacities from the initial conversion text-brand-accent0/20 etc
    { regex: /text-brand-accent0?\/\d+/g, replacement: 'text-brand-accent' },
    { regex: /border-border0?\/\d+/g, replacement: 'border-border' },

    // 4. Duplicate spaces
    { regex: /\s{2,}/g, replacement: ' ' },
    { regex: /className="\s+/g, replacement: 'className="' },
    { regex: /\s+"/g, replacement: '"' },
    { regex: /className=""/g, replacement: '' }
];

// AA

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
        console.log(`Final Sweep: ${file}`);
    }
});

console.log(`\nSuccess! Final cleanup processed ${changedFilesCount} files.`);
