const fs = require('fs')
const toGeoJSON = require('togeojson')
const xmlParser = require('xmldom').DOMParser

const gpxText = fs.readFileSync(process.argv[2], 'utf-8')
const dom = new xmlParser().parseFromString(gpxText)
console.log(JSON.stringify(toGeoJSON.gpx(dom), null, 2))
