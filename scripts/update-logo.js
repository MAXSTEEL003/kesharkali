const fs = require('fs');
const path = require('path');

const webpBuf = fs.readFileSync(path.join(__dirname, '../public/logo.webp'));
const b64 = webpBuf.toString('base64');
const dataUri = `data:image/webp;base64,${b64}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 225 115" width="225" height="115">
  <image href="${dataUri}" width="225" height="115" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

fs.writeFileSync(path.join(__dirname, '../public/logo.svg'), svg);
fs.writeFileSync(path.join(__dirname, '../public/logo-icon.svg'), svg);
console.log('Successfully updated public/logo.svg and public/logo-icon.svg with authentic Keshar Kali logo!');
