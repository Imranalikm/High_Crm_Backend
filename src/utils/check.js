const fs = require('fs');
const buffer = fs.readFileSync('logo.png');

// Find IDAT chunk
let offset = 8;
while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
        console.log('Found IHDR');
    }
    offset += 12 + length;
}
console.log('Need a real parser');
