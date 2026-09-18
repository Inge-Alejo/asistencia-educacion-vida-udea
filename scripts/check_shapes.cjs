const pptxgen = require('pptxgenjs');
const p = new pptxgen();
console.log('ShapeType:', Object.keys(p.ShapeType || {}));
console.log('shapes:', Object.keys(p.shapes || {}));
