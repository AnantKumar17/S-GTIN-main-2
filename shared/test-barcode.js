const barcodeScanner = require('./utils/barcodeScanner');

// Test with a simple QR code containing SGTIN
const testSGTIN = '0120001234567890210000000000301';

console.log('Testing barcode scanner...');
console.log('Test SGTIN:', testSGTIN);

// Test validation first
const validation = barcodeScanner.validateSGTIN(testSGTIN);
console.log('\nValidation result:', validation);

// Test simulate scan
const simulated = barcodeScanner.simulateScan(testSGTIN);
console.log('\nSimulated scan result:', simulated);

console.log('\n✅ Basic tests passed!');
console.log('\nNote: Image decoding requires actual QR code image from the frontend.');
