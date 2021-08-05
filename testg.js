var tj = require('togeojson'),
    fs = require('fs'),
    // node doesn't have xml parsing or a dom. use xmldom
    DOMParser = require('xmldom').DOMParser;

var kml = new DOMParser().parseFromString(fs.readFileSync('austin-mtb-3-27-17.kml', 'utf8'), 'text/xml');

var converted = tj.kml(kml);

var convertedWithStyles = tj.kml(kml, { styles: true });
console.log(JSON.stringify(converted, null, 2))
