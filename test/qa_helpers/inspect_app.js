const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const match = appJs.match(/PRIVACY_NOTICE_KEY\s*=\s*['"]([^'"]+)['"]/);
console.log('PRIVACY_NOTICE_KEY:', match ? match[1] : 'not found');



