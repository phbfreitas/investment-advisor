const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [
    'src/app/api/guidance/route.ts',
    'src/app/profile/guidance/page.tsx',
    'src/app/profile/guidance/GuidanceClient.tsx',
    'scripts/list-profiles.ts',
    'scripts/migrate-excel-holdings.ts',
    'scripts/read-excel.ts'
];

files.forEach(file => {
    try {
        const content = execSync(`git show 90b7cdd:${file}`, { encoding: 'utf8' });
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file, content);
        console.log(`Restored: ${file}`);
    } catch (err) {
        console.error(`Failed to restore ${file}: ${err.message}`);
    }
});
