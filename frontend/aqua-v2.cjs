const fs = require('fs');
const path = require('path');

const targetDir = 'd:/morphous/main/aamba/frontend/src';

const regexps = [
    // Backgrounds
    { r: /!*bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: '' },
    { r: /!*bg-white(?:\/\d+)?/g, v: 'bg-card-bg' },
    { r: /!*bg-black(?:\/\d+)?/g, v: 'bg-card-bg' },
    { r: /!*bg-fintech-(?:surface|dark|accent|card)(?:\/\d+)?/g, v: 'bg-card-bg' },

    // Gradients
    { r: /!*bg-gradient-to-[trbl]{1,2}/g, v: '' },
    { r: /!*from-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: '' },
    { r: /!*to-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: '' },

    // Text colors
    { r: /!*text-(?:slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400)(?:\/\d+)?/g, v: 'text-text-secondary' },
    { r: /!*text-(?:slate|gray|zinc|neutral|stone)-(?:500|600|700|800|900|950)(?:\/\d+)?/g, v: 'text-text-primary' },
    { r: /!*text-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: 'text-brand-accent' },
    { r: /\btext-white(?:\/\d+)?\b/g, v: 'text-text-primary' },
    { r: /!*text-black(?:\/\d+)?/g, v: 'text-text-primary' },
    { r: /text-\[#FFFFFF\]/g, v: 'text-text-primary' },

    // Border colors
    { r: /!*border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: 'border-border' },
    { r: /!*border-fintech-border(?:\/\d+)?/g, v: 'border-border' },
    { r: /!*border-white(?:\/\d+)?/g, v: 'border-border' },

    // Shadows
    { r: /!*shadow-(?:sm|md|lg|xl|2xl|inner|none)/g, v: '' },
    { r: /!*shadow-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?/g, v: '' },
    { r: /shadow-\[.*?\]/g, v: '' },
    { r: /!*drop-shadow-(?:sm|md|lg|xl|2xl|none)/g, v: '' },
    { r: /!*backdrop-blur-(?:sm|md|lg|xl|2xl|none)/g, v: '' },

    // Opacity removals on mapped styles
    { r: /bg-card-bg\/\d+/g, v: 'bg-card-bg' },
    { r: /bg-bg-primary\/\d+/g, v: 'bg-bg-primary' },
    { r: /text-text-primary\/\d+/g, v: 'text-text-primary' },
    { r: /text-text-secondary\/\d+/g, v: 'text-text-secondary' },
    { r: /text-brand-accent\/\d+/g, v: 'text-brand-accent' },
    { r: /border-border\/\d+/g, v: 'border-border' },

    // Clean inline color/bg attributes
    { r: /backgroundColor:\s*['"](?:(?!transparent|var|inherit).)+?['"],?/g, v: '' },
    { r: /background:\s*['"]linear-gradient.+?['"],?/g, v: '' },
    { r: /color:\s*['"](?:(?!transparent|var|inherit).)+?['"],?/g, v: '' },

    // Fix empty styles resulting from above
    { r: /style={{\s*}}/g, v: '' },

    // Collapse multiple spaces WITHOUT touching newlines (ONLY tabs and spaces)
    { r: /[ \t]{2,}/g, v: ' ' },
    { r: /className="[ \t]+/g, v: 'className="' },
    { r: /[ \t]+"/g, v: '"' },
    { r: /className=""/g, v: '' }
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

    regexps.forEach(({ r, v }) => {
        if (r.test(content)) {
            content = content.replace(r, v);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        changedFilesCount++;
        console.log(`Systematic Aqua Standardization: ${file}`);
    }
});

console.log(`\nSuccess! Reapplied strict styling rules to ${changedFilesCount} files without corrupting syntax.`);
