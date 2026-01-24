const QRCode = require('qrcode');
const bwipjs = require('bwip-js');
const db = require('../../../../database/models/db');

/**
 * Generate SGTIN using PostgreSQL sequence (Production-ready)
 * @param {string} gtin - 14-digit GTIN
 * @returns {Promise<string>} SGTIN in GS1 format
 */
async function generateSGTINWithSequence(gtin) {
  try {
    // Get next serial number from PostgreSQL sequence
    const result = await db.query('SELECT nextval($1) as serial', ['sgtin_serial_sequence']);
    const serial = result.rows[0].serial;
    
    // Pad serial to 13 digits with leading zeros
    const serialNumber = serial.toString().padStart(13, '0');
    
    // GS1 format: 01{GTIN}21{Serial}
    return `01${gtin}21${serialNumber}`;
  } catch (error) {
    console.error('Error generating SGTIN with sequence:', error);
    throw new Error('Failed to generate SGTIN - database sequence error');
  }
}

/**
 * Generate SGTIN in GS1 format: 01{GTIN}21{Serial}
 * @deprecated Use generateSGTINWithSequence() for production
 * @param {string} gtin - 14-digit GTIN
 * @returns {string} SGTIN in GS1 format
 */
function generateSGTIN(gtin) {
  // Generate 13-digit serial number (timestamp + random)
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const serialNumber = timestamp + random;

  // GS1 format: 01{GTIN}21{Serial}
  return `01${gtin}21${serialNumber}`;
}

/**
 * Validate SGTIN format
 * @param {string} sgtin - SGTIN to validate
 * @returns {object} { valid: boolean, error?: string, gtin?: string, serial?: string }
 */
function validateSGTINFormat(sgtin) {
  // Expected format: 01{14-digit GTIN}21{serial}
  if (!sgtin || typeof sgtin !== 'string') {
    return { valid: false, error: 'SGTIN must be a non-empty string' };
  }

  if (!sgtin.startsWith('01')) {
    return { valid: false, error: 'SGTIN must start with "01" (GTIN identifier)' };
  }

  if (sgtin.length < 19) {
    return { valid: false, error: 'SGTIN too short. Expected format: 01{14-digit GTIN}21{serial}' };
  }

  const gtinPart = sgtin.substring(2, 16); // 14 digits
  if (!/^\d{14}$/.test(gtinPart)) {
    return { valid: false, error: 'GTIN part must be 14 digits' };
  }

  if (!sgtin.substring(16).startsWith('21')) {
    return { valid: false, error: 'Serial number must be prefixed with "21"' };
  }

  const serialPart = sgtin.substring(18);
  if (serialPart.length < 1) {
    return { valid: false, error: 'Serial number is missing' };
  }

  return {
    valid: true,
    gtin: gtinPart,
    serial: serialPart
  };
}

/**
 * Extract GTIN from SGTIN
 * @param {string} sgtin - SGTIN in GS1 format
 * @returns {string} 14-digit GTIN
 */
function extractGTIN(sgtin) {
  const validation = validateSGTINFormat(sgtin);
  return validation.valid ? validation.gtin : null;
}

/**
 * Extract serial number from SGTIN
 * @param {string} sgtin - SGTIN in GS1 format
 * @returns {string} Serial number
 */
function extractSerial(sgtin) {
  const validation = validateSGTINFormat(sgtin);
  return validation.valid ? validation.serial : null;
}

/**
 * Generate QR code for SGTIN
 * @param {string} sgtin - SGTIN in GS1 format
 * @returns {Promise<string>} Base64 encoded QR code image
 */
async function generateQRCode(sgtin) {
  try {
    // Generate QR code as data URL (base64)
    const qrCode = await QRCode.toDataURL(sgtin, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1
    });
    return qrCode;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate barcode for SGTIN
 * @param {string} sgtin - SGTIN in GS1 format
 * @returns {Promise<string>} Base64 encoded barcode image
 */
async function generateBarcode(sgtin) {
  try {
    // Generate Code 128 barcode
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: sgtin,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center'
    });

    // Convert to base64
    const barcode = `data:image/png;base64,${png.toString('base64')}`;
    return barcode;
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error('Failed to generate barcode');
  }
}

module.exports = {
  generateSGTIN,
  generateSGTINWithSequence,
  validateSGTINFormat,
  extractGTIN,
  extractSerial,
  generateQRCode,
  generateBarcode
};
