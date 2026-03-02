const fs = require('fs');
const path = require('path');

const targetDir = 'd:/morphous/main/aamba/frontend/src';

const replacements = [
    // 1. Strip ALL unauthorized backgrounds -> map to bg-card-bg or bg-bg-primary
    { regex: /bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /!bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /bg-white/g, replacement: 'bg-card-bg' },
    { regex: /bg-black(\/\d+)?/g, replacement: 'bg-card-bg' },
    { regex: /bg-fintech-(?:surface|dark|accent)/g, replacement: 'bg-card-bg' },

    // 2. Strip ALL Gradients
    { regex: /bg-gradient-to-[trbl]{1,2}/g, replacement: '' },
    { regex: /!bg-gradient-to-[trbl]{1,2}/g, replacement: '' },
    { regex: /from-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /!from-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /to-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /!to-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },

    // 3. Strip ALL unauthorized text colors -> map to text-text-primary or secondary
    { regex: /text-(?:slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400)/g, replacement: 'text-text-secondary' },
    { regex: /text-(?:slate|gray|zinc|neutral|stone)-(?:500|600|700|800|900|950)/g, replacement: 'text-text-primary' },
    { regex: /text-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)/g, replacement: 'text-brand-accent' },
    { regex: /!text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)/g, replacement: '' },
    { regex: /\btext-white\b/g, replacement: 'text-text-primary' },
    { regex: /className="text-\[#FFFFFF\]/g, replacement: 'className="text-text-primary' },
    { regex: /text-black/g, replacement: 'text-text-primary' },

    // 4. Strip ALL unauthorized border colors -> map to border-border
    { regex: /border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: 'border-border' },
    { regex: /!border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /border-fintech-border/g, replacement: 'border-border' },
    { regex: /border-white(\/\d+)?/g, replacement: 'border-border' },

    // 5. Strip ALL unauthorized drop shadows / glassmorphism
    { regex: /shadow-(?:sm|md|lg|xl|2xl|inner)/g, replacement: '' },
    { regex: /shadow-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(\/\d+)?/g, replacement: '' },
    { regex: /shadow-\[.*?\]/g, replacement: '' },
    { regex: /drop-shadow-(?:sm|md|lg|xl|2xl|none)/g, replacement: '' },
    { regex: /backdrop-blur-(?:sm|md|lg|xl|2xl|none)/g, replacement: '' },

    // 6. Inline styles cleanup (especially Sidebar & charts)
    { regex: /style={{[^}]*backgroundColor:\s*['"](?!transparent|var|inherit).+?['"][^}]*}}/g, replacement: '' },
    { regex: /style={{[^}]*background:\s*['"]linear-gradient.+?['"][^}]*}}/g, replacement: '' },
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
    let modified = false;

    replacements.forEach(({ regex, replacement }) => {
        if (regex.test(content)) {
            // Because aggressive replacement might lead to multiple empty spaces in className
            content = content.replace(regex, replacement);
            modified = true;
        }
    });

    // Clean up multiple spaces in classNames left by replacements
    if (modified) {
        content = content.replace(/className="\s+/g, 'className="');
        content = content.replace(/\s+"/g, '"');
        content = content.replace(/\s{2,}/g, ' '); // collapse spaces

        fs.writeFileSync(file, content, 'utf8');
        changedFilesCount++;
        console.log(`Aggressively Standardized: ${file}`);
    }
});

console.log(`\nSuccess! Restored Aqua Glow strict enforcement in ${changedFilesCount} files.`);
