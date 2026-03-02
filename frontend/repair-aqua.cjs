const fs = require('fs');
const path = require('path');

const targetDir = 'd:/morphous/main/aamba/frontend/src';

const replacements = [
    // 1. Clean up stray zeroes attached to text-brand-accent / bg-card-bg
    { regex: /text-brand-accent00?/g, replacement: 'text-brand-accent' },
    { regex: /text-text-primary00?/g, replacement: 'text-text-primary' },
    { regex: /text-text-secondary00?/g, replacement: 'text-text-secondary' },
    { regex: /bg-card-bg00?/g, replacement: 'bg-card-bg' },
    { regex: /bg-bg-primary00?/g, replacement: 'bg-bg-primary' },
    { regex: /border-border00?/g, replacement: 'border-border' },

    // 2. Clean up stray opacity blocks left behind e.g. "0/5" "0/10" "0/30"
    { regex: /\b0\/\d+\b/g, replacement: '' },

    // 3. Clean up stray '0' floating in classnames e.g. "w-2 h-2 rounded-full 0 animate-pulse"
    { regex: /className="([^"]*?)\b0\b([^"]*?)"/g, replacement: 'className="$1 $2"' },

    // 4. Duplicate spaces
    { regex: /\s{2,}/g, replacement: ' ' },
    { regex: /className="\s+/g, replacement: 'className="' },
    { regex: /\s+"/g, replacement: '"' }
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
        console.log(`Repaired: ${file}`);
    }
});

console.log(`\nSuccess! Repaired corrupted regex remnants in ${changedFilesCount} files.`);
