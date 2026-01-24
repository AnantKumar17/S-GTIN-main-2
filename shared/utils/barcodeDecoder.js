/**
 * Barcode Decoder Utility
 * Decodes barcodes from Base64 images using Quagga
 */

const Quagga = require('quagga');

/**
 * Decode barcode from Base64 image
 * @param {string} base64Image - Base64 encoded image (data:image/png;base64,...)
 * @returns {Promise<string>} Decoded barcode value (SGTIN)
 */
async function decodeBarcode(base64Image) {
  return new Promise((resolve, reject) => {
    // Remove data:image/png;base64, prefix if present
    const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');
    
    // Configure Quagga
    Quagga.decodeSingle({
      src: `data:image/png;base64,${imageData}`,
      numOfWorkers: 0,  // Needs to be 0 in Node.js environment
      decoder: {
        readers: ['code_128_reader'] // Code 128 format used for SGTIN barcodes
      },
      locate: true,
      locator: {
        patchSize: 'medium',
        halfSample: false
      }
    }, (result) => {
      if (result && result.codeResult) {
        resolve(result.codeResult.code);
      } else {
        reject(new Error('Could not decode barcode from image'));
      }
    });
  });
}

/**
 * Decode QR code from Base64 image
 * Note: QR codes contain the same SGTIN data, just in 2D format
 * @param {string} base64Image - Base64 encoded QR image
 * @returns {Promise<string>} Decoded SGTIN
 */
async function decodeQRCode(base64Image) {
  // For QR codes, we can use a different library like jsQR
  // For now, return the same decoding logic
  return decodeBarcode(base64Image);
}

/**
 * Validate SGTIN format from decoded barcode
 * @param {string} sgtin - Decoded SGTIN string
 * @returns {boolean} True if valid SGTIN format
 */
function validateSGTINFormat(sgtin) {
  // SGTIN format: 01{14-digit GTIN}21{serial}
  // Example: 0120001234567890210000000001101
  const sgtinPattern = /^01\d{14}21\d+$/;
  return sgtinPattern.test(sgtin);
}

/**
 * Extract GTIN and Serial from SGTIN
 * @param {string} sgtin - Full SGTIN
 * @returns {Object} Object with gtin and serial properties
 */
function parseSGTIN(sgtin) {
  if (!validateSGTINFormat(sgtin)) {
    throw new Error('Invalid SGTIN format');
  }
  
  // Extract GTIN (after '01' prefix, 14 digits)
  const gtin = sgtin.substring(2, 16);
  
  // Extract serial number (after '21' prefix, rest of string)
  const serial = sgtin.substring(18);
  
  return {
    sgtin,
    gtin,
    serial
  };
}

module.exports = {
  decodeBarcode,
  decodeQRCode,
  validateSGTINFormat,
  parseSGTIN
};
