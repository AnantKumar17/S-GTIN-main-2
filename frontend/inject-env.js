#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
let envConfig = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim();
        }
    });
}

// Create window.__CONFIG__ script
const configScript = `
<script>
    window.__CONFIG__ = ${JSON.stringify(envConfig)};
</script>
`;

// Read index.html
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Check if config script already exists
    if (!indexContent.includes('window.__CONFIG__')) {
        // Inject the config script before the closing head tag
        indexContent = indexContent.replace('</head>', configScript + '</head>');
        fs.writeFileSync(indexPath, indexContent);
        console.log('Environment variables injected into index.html');
    } else {
        console.log('Environment variables already injected');
    }
} else {
    console.log('index.html not found, creating a basic one...');
    const basicIndex = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGTIN Lifecycle Management</title>
    <script>
        window.__CONFIG__ = ${JSON.stringify(envConfig)};
    </script>
    <script id="sap-ui-bootstrap"
            src="resources/sap-ui-core.js"
            data-sap-ui-resourceroots='{
                "com.sgtin.lifecycle": "./"
            }'
            data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
            data-sap-ui-compatVersion="edge"
            data-sap-ui-async="true"
            data-sap-ui-preload="async"
            data-sap-ui-frameOptions="trusted">
    </script>
</head>
<body class="sapUiBody" id="content">
</body>
</html>`;
    fs.writeFileSync(indexPath, basicIndex);
    console.log('Created index.html with environment configuration');
}