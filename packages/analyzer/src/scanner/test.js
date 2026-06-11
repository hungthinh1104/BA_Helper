const { FrameworkDetector } = require('./framework-detector');
const path = require('path');
FrameworkDetector.detect(path.join(__dirname, '../../../../tests/fixtures/booking-inventory-multi-file')).then(console.log);
