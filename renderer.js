// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const xml2js = require('xml2js')
const xml2jsParser = xml2js.Parser()
const fs = require('fs')
const moment = require('moment')

const videoElm = document.querySelector('.main-video video')
const chooseVideoElm = document.querySelector('#choose-video')
const chooseTrackElm = document.querySelector('#choose-track')
const titleTextInput = document.querySelector('#video-title')
const showDateTimeElm = document.querySelector('#show-date-time')
const showSpeedElevationElm = document.querySelector('#show-speed-elevation')
const showLLElm = document.querySelector('#show-LL')
const titleElm = document.querySelector('.text-overlay #title')
const dateTimeElm = document.querySelector('.text-overlay #date-time')
const speedElevationElm = document.querySelector('.text-overlay #speed-elevation')
const latlonElm = document.querySelector('.text-overlay #latlon')
const mapOpacityElm = document.querySelector('#map-opacity')
const mapOverlayElm = document.querySelector('.map-overlay')
const mapSizeElm = document.querySelector('#map-size')
const encodeDateElm = document.querySelector('#encode-date')
const trackStartDatetimeElm = document.querySelector('#track-start-datetime')
const trackColorElm = document.querySelector('#track-color')
const textColorElm = document.querySelector('#text-color')
const elevationElm = document.querySelector('#elevation-field')
const latFieldElm = document.querySelector('#lat-field')
const lonFieldElm = document.querySelector('#lon-field')

const feetPerMeter = 3.28084

// boulder
const initialMapLat = 40.0150
const initialMapLon = -105.2705

const mapOptions = {
  zoomControl: false,
  trackResize: true
}

const openTopoTiles =
  L.tileLayer('http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://opentopomap.org">opentopomap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://opentopomap.org">opentopomap.org</a>',
    maxZoom: 18
  })

const usgsTopoTiles =
  L.tileLayer('https://basemap.nationalmap.gov/ArcGIS/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 14,
    attribution: 'USGS The National Map http://viewer.nationalmap.gov'
  })

const natGeoTopoTiles =
  L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/NGS_Topo_US_2D/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Copyright: © 2013 National Geographic Society'
  })

const natGeoWorldTopoTiles =
  L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'National Geographic World Map http://goto.arcgisonline.com/maps/NatGeo_World_Map'
  })

const theMap = L.map('map', mapOptions).setView([initialMapLat, initialMapLon], 11)

const {
  dialog
} = require('electron').remote

const videoFileFilters = [{
  name: 'Videos',
  extensions: ['mp4', 'mov', 'webm']
}]

const trackFileFilters = [{
  name: 'Tracks',
  extensions: ['kml', 'kmz', 'gpx']
}]


let trackStartMoment, videoStartMoment, trackLayer

function initializeMap() {
  openTopoTiles.addTo(theMap)
}


function handleChooseVideo() {
  dialog.showOpenDialog({
    title: 'choose video',
    filters: videoFileFilters,
    properties: ['openFile']
  }, (path) => {
    console.log('chosen path', path)
    if (path) {
      handleVideoFile(path)
    }
  })
}

function handleChooseTrack() {
  dialog.showOpenDialog({
    title: 'choose track',
    filters: trackFileFilters,
    properties: ['openFile']
  }, (path) => {
    console.log('chosen path', path)
    if (path) {
      handleTrackFile(path)
    }
  })
}


function displayPath(path) {
  chooseVideoElm.value = path
}

function displayStart(start) {
  startDateTimeElm.innerHTML = start
}

function readVideoMetadata(path) {
  displayPath(path)
  const exec = require('child_process').exec
  // attempt to use mediainfo
  exec(`mediainfo --Output=XML ${path}`, (err, stdout, stderr) => {
    if (err) {
      console.log('error gathering mediainfo', err)
    }
    xml2jsParser.parseString(stdout, (err, data) => {
      let videoStartDate = data.Mediainfo.File[0].track[0].Encoded_date[0]
      let videoStartDateFormatted

      console.log(videoStartDate)

      // format is usually like UTC 2013-04-28 21:41:14
      if (videoStartDate.indexOf('UTC') != -1) {
        const dateTimeOnly = videoStartDate.match(/^\s*UTC\s*(.*?)$/i)[1]
        trackStartMoment = moment(dateTimeOnly + 'Z')
        videoStartDateFormatted = trackStartMoment.format('ddd MMM DD h:mm:ss A')

      }
      encodeDateElm.innerHTML = `Start: ${videoStartDateFormatted}`
    })
  })
}

function handleVideoFile(path) {
  readVideoMetadata(path)
  videoElm.src = path
  videoElm.poster = null
  videoElm.currentTime = 0.01
}

function valid(valid, message) {
  return {
    valid: valid,
    message: message
  }
}


// must have at least one trkseg with points including times
function checkValidGPX(gpxData) {

  if (!gpxData.gpx.trk) {
    return valid(false, "Couldn't find any tracks in this file")
  }

  // assume first track
  const track = gpxData.gpx.trk[0]

  if (!track.trkseg) {
    return valid(false, 'Track contains no segments')
  }

  // assume first segment
  const segment = track.trkseg[0]

  if (!segment.trkpt) {
    return valid(false, 'Segment contains no points')
  }

  let pointsWithTime = segment.trkpt.reduce((accum, point) => accum + (point.time ? 1 : 0), 0)

  if (segment.trkpt.length / pointsWithTime >= 0.75) {
    return valid(true, `Track contains ${pointsWithTime} points with timestamps`)
  } else {
    return valid(false, `Track has ${segment.trkpt.length} points, but only ${pointsWithTime} timestamps`)
  }
}


function extractStartTime(gpxData) {
  return (() => {
    try {
      return gpsData.gpx.trk[0].trkseg[0].trkpt[0].time[0]
    } catch (err) {
      return undefined
    }
  })()
}

function extractTrackName(gpxData) {
  return (() => {
    try {
      return gpxData.gpx.metadata[0].name[0]
    } catch (err) {
      return undefined
    }
  })()
}

function extractStartLL(gpxData) {
  return (() => {
    try {
      return [
        gpxData.gpx.trk[0].trkseg[0].trkpt[0].$.lat,
        gpxData.gpx.trk[0].trkseg[0].trkpt[0].$.lon
      ]
    } catch (err) {
      return undefined
    }
  })()
}

function extractStartElevation(gpxData, meters) {
  return (() => {
    try {
      if (meters) {
        return Math.round(parseInt(gpxData.gpx.trk[0].trkseg[0].trkpt[0].ele[0]))
      } else {
        return Math.round(parseInt(gpxData.gpx.trk[0].trkseg[0].trkpt[0].ele[0]) * feetPerMeter)
      }
    } catch (err) {
      return undefined
    }
  })()
}


function drawGPXTrack(path) {
  if (trackLayer) {
    theMap.removeLayer(trackLayer)
  }
  const customLayer = L.geoJson(null, {})
  trackLayer = omnivore.gpx(path, null, customLayer)
  trackLayer.addTo(theMap)
  trackLayer.on('ready', () => {
    theMap.fitBounds(trackLayer.getBounds())
  })
}

function handleGPXFile(path) {
  let gpxText = fs.readFileSync(path, 'utf-8')
  xml2jsParser.parseString(gpxText, (err, parsedGPX) => {
    if (err) {
      // TODO show error dialog
      console.log('error parsing gpx file', err)
      return
    }

    // TODO remove this , its only for debug
    global.gpsData = parsedGPX
    console.log(checkValidGPX(parsedGPX))
    const trackTime = moment(extractStartTime(parsedGPX))
    trackStartDatetimeElm.innerHTML = `Start: ${trackTime.format('ddd MMM DD h:mm:ss A')}`
    dateTimeElm.innerHTML = trackTime.format('dddd MMM DD, YYYY')
    titleTextInput.value = extractTrackName(parsedGPX)
    titleElm.innerHTML = extractTrackName(parsedGPX)
    elevationElm.innerHTML = extractStartElevation(parsedGPX)
    const LL = extractStartLL(parsedGPX)
    latFieldElm.innerHTML = LL[0]
    lonFieldElm.innerHTML = LL[1]

    drawGPXTrack(path)
  })
}


function handleTrackFile(path) {
  console.log('will load track', path)
  chooseTrackElm.value = path

  if (path[0].endsWith('gpx')) {
    handleGPXFile(path[0])
  }
}

function showHideElm(elm, show) {
  if (show) {
    elm.classList.remove('hidden')
  } else {
    elm.classList.add('hidden')
  }
}

function handleTextOverlayDisplay() {
  console.log('handleTextOverlayDisplay', showDateTimeElm.checked)
  showHideElm(titleElm, titleTextInput.value.length > 0)
  showHideElm(dateTimeElm, showDateTimeElm.checked)
  showHideElm(speedElevationElm, showSpeedElevationElm.checked)
  showHideElm(latlonElm, showLLElm.checked)
}

function handleTextColorInput() {
  document.documentElement.style.setProperty('--text-overlay-color', this.value)
}

showDateTimeElm.addEventListener('click', handleTextOverlayDisplay)
showSpeedElevationElm.addEventListener('click', handleTextOverlayDisplay)
showLLElm.addEventListener('click', handleTextOverlayDisplay)
titleTextInput.addEventListener('input', handleTextOverlayDisplay)

titleTextInput.addEventListener('input', function() {
  titleElm.innerHTML = this.value
})

mapOpacityElm.addEventListener('input', function() {
  mapOverlayElm.style.opacity = parseInt(this.value) / 100.0
})

mapSizeElm.addEventListener('input', function() {
  mapOverlayElm.style.height = `${this.value}%`
  mapOverlayElm.style.width = `${this.value}%`
  theMap.invalidateSize()
})

chooseVideoElm.addEventListener('click', handleChooseVideo)
chooseTrackElm.addEventListener('click', handleChooseTrack)

textColorElm.addEventListener('input', handleTextColorInput)

initializeMap()
