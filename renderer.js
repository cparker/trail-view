// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const xml2js = require('xml2js')
const xml2jsParser = xml2js.Parser()
const builder = new xml2js.Builder();
const fs = require('fs')
const moment = require('moment')
const settings = require('electron-settings')
const geolib = require('geolib')

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
const tileLayerElm = document.querySelector('#tile-layer')
const playPauseElm = document.querySelector('#play-pause')
const videoPositionElm = document.querySelector('#video-position')
const trackPositionElm = document.querySelector('#track-position')
const playbackSpeedElm = document.querySelector('#playback-speed')
const headingElm = document.querySelector('#heading')
const speedFieldElm = document.querySelector('#speed-field')
const headingFieldElm = document.querySelector('#heading-field')
const trackVideoLockElm = document.querySelector('#track-video-lock')
const videoTypeElm = document.querySelector('#video-type')
const compassElm = document.querySelector('#compass-field')
const mapZoomElm = document.querySelector('#map-zoom')
const newWaypointElm = document.querySelector('#new-waypoint')
const addWaypointDialog = document.querySelector('.add-waypoint')

const feetPerMeter = 3.28084

// boulder
const initialMapLat = 40.0150
const initialMapLon = -105.2705

const framesPerSecond = 30.0

let textColor = '#FFFFFF'
let trackColor = '#FF0000'

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

const usaTopoTiles =
  L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: 'Copyright:© 2013 National Geographic Society, i-cubed'
  })

const openCycleMapTiles =
  L.tileLayer('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=a5dd6a2f1c934394bce6b0fb077203eb', {
    maxZoom: 22,
    attribution: 'OpenCycleMap http://www.openstreetmap.org/'
  })

const openStreetMapTiles =
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22,
    attribution: 'OpenStreetMap http://www.openstreetmap.org/'
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


let trackStartMoment, videoStartMoment, trackLayer, tileLayer, checkVideoInterval, trackPoints, trackIndex,
  trackMarker, locked, videoSliderPosition, trackSliderPosition, secondsPerVideoFrame,
  lockedPositions, activeSlider, mapMouseEvent, gpxJSON, loadedGpxFile

function initializeMap() {
  tileLayer = openTopoTiles
  tileLayer.addTo(theMap)
  locked = false
  trackSliderPosition = 0
  videoSliderPosition = 0
  trackIndex = 0
  secondsPerVideoFrame = 1 / framesPerSecond
  lockedPositions = {}
  trackVideoLockElm.classList.remove('fa-lock')
  trackVideoLockElm.classList.add('fa-unlock')
  theMap.on('click', handleMapClick)
  theMap.on('zoomend', z => {
    console.log('zoom', z.target._zoom)
    mapZoomElm.value = z.target._zoom
  })
}


function handleMapClick(mapClickEvent) {
  console.log('clicked map', mapClickEvent)
  mapMouseEvent = mapClickEvent
  addWaypointDialog.classList.remove('hidden')
  newWaypointElm.focus()
}

function loadSettings() {
  if (settings.has('lastVideoPath')) {
    handleVideoFile(settings.get('lastVideoPath'))
  }

  if (settings.has('textColor')) {
    textColor = settings.get('textColor')
    document.documentElement.style.setProperty('--text-overlay-color', textColor)
    textColorElm.value = textColor
  }

  if (settings.has('trackColor')) {
    trackColor = settings.get('trackColor')
    console.log('trackColor', trackColor)
    trackColorElm.value = trackColor
    if (trackLayer) {
      trackLayer.setStyle({
        color: trackColor
      })
    }
  }

  if (settings.has('lastTrackPath')) {
    // waits for map to initialize... simpler this way
    setTimeout(() => {
      handleTrackFile(settings.get('lastTrackPath'))
    }, 500)
  }

  if (settings.has('mapWidth')) {
    mapOverlayElm.style.width = `${settings.get('mapWidth')}%`
    mapSizeElm.value = settings.get('mapWidth')
  }
  if (settings.has('mapHeight')) {
    mapOverlayElm.style.height = `${settings.get('mapHeight')}%`
    mapSizeElm.value = settings.get('mapHeight')
  }
  if (settings.has('mapOpacity')) {
    mapOverlayElm.style.opacity = parseInt(settings.get('mapOpacity')) / 100.0
    mapOpacityElm.value = settings.get('mapOpacity')
  }
  if (settings.has('mapZoom')) {
    mapZoomElm.value = settings.get('mapZoom')
    // setting the actual map zoom is handled in loading the track
  }

  if (settings.has('tileLayer')) {
    tileLayerElm.value = settings.get('tileLayer')
    handleChooseTileLayer()
  }

  if (settings.has('secondsPerVideoFrame')) {
    videoTypeElm.value = settings.get('secondsPerVideoFrame')
    handleChooseVideoType()
  }
  if (settings.has('playbackSpeed')) {
    videoElm.playbackRate = parseInt(settings.get('playbackSpeed')) / 100
    playbackSpeedElm.value = settings.get('playbackSpeed')
  }
  if (settings.has('lockedPositions')) {
    trackVideoLockElm.classList.add('fa-lock')
    trackVideoLockElm.classList.remove('fa-unlock')
    lockedPositions = settings.get('lockedPositions')
    videoElm.currentTime = lockedPositions.videoCurrentTimeSec
    videoPositionElm.value = lockedPositions.videoFrame
    trackPositionElm.value = lockedPositions.trackIndex
    locked = true

  }
}


function getTrackIndexForVideoPosition(allowBackwards) {

  // based on the track locked positions, determine the
  // {video: 1.166666, trackIndex: "10", time: "2017-05-06T14:26:40Z"}
  const lockedTimeMoment = moment(lockedPositions.time)
  // console.log('lockedTimeMoment', lockedTimeMoment.toISOString())
  const seconds = (videoElm.currentTime - lockedPositions.videoCurrentTimeSec) * framesPerSecond * secondsPerVideoFrame
  // console.log('seconds', seconds)
  const realWorldVideoTimeAtCurrentPoint = lockedTimeMoment.clone().add(seconds, 'seconds')
  // console.log('realWorldVideoTimeAtCurrentPoint', realWorldVideoTimeAtCurrentPoint.toISOString())

  // now we have to find the track point closest to this time
  // for each point (starting at trackIndex), is realWorldVideoTimeAtCurrentPoint >= point

  // if allowBackwards is true, this means we need to start searching from the begining of the track points
  // this is used when the user is scribbing with the range slider and it's possible they are scrubbing backwards
  let i = allowBackwards ? 0 : trackIndex
  for (let found = false; !found && i < trackPoints.length; i++) {
    // console.log('i',i)

    // console.log('diffing ', realWorldVideoTimeAtCurrentPoint.toISOString(), ' to ', trackPoints[i].moment.toISOString())
    let dif = realWorldVideoTimeAtCurrentPoint.diff(trackPoints[i].moment)
    // console.log('dif', dif)
    if (dif < 0) {
      found = true

    }
  }

  return i - 1
}


function checkVideo() {
  // update the position slider, which has one tick per frame
  videoPositionElm.value = videoElm.currentTime * framesPerSecond

  if (locked) {
    trackIndex = getTrackIndexForVideoPosition()
    trackPositionElm.value = trackIndex
    updateDisplayFromTrackPosition()
  }
}


function handlePlayPause() {
  if (videoElm.paused) {
    videoElm.play()
  } else {
    videoElm.pause()
  }
}


function handleChooseTileLayer() {
  theMap.removeLayer(tileLayer)

  switch (this.value || tileLayerElm.value) {
    case 'open-topo':
      tileLayer = openTopoTiles
      break
    case 'usgs-topo':
      tileLayer = usgsTopoTiles
      break
    case 'ngs-topo':
      tileLayer = natGeoTopoTiles
      break
    case 'ngs-world':
      tileLayer = natGeoWorldTopoTiles
      break
    case 'usa-topo':
      tileLayer = usaTopoTiles
      break
    case 'open-cycle':
      tileLayer = openCycleMapTiles
      break
    case 'open-street':
      tileLayer = openStreetMapTiles
      break
  }

  tileLayer.addTo(theMap)
  settings.set('tileLayer', this.value || tileLayerElm.value)
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
      settings.set('lastVideoPath', path)
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
    if (path[0]) {
      handleTrackFile(path[0])
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

  videoElm.addEventListener('durationchange', function() {
    // assume 30 frames per second, give the slider a mark for every frame
    videoPositionElm.max = videoElm.duration * framesPerSecond
  })
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
  console.log('working with', track.trkseg)

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


function addStarMarker(text, lat, lon) {
  try {
    const starIcon = L.divIcon({
      className: 'my-div-icon',
      html: '<i class="fa fa-star fa-2x fa-red"></i>'
    })

    const textIcon = L.divIcon({
      className: 'my-div-text-icon',
      html: text
    })

    const textMarker = L.marker(L.latLng(lat, lon), {
      icon: textIcon
    })

    const starMarker = L.marker(L.latLng(lat, lon), {
      icon: starIcon
    })
    textMarker.addTo(theMap)
    starMarker.addTo(theMap)
  } catch (err) {
    console.log("ERROR", err)
  }
}


function drawGPXTrack(path, gpxJSON) {
  if (trackLayer) {
    theMap.removeLayer(trackLayer)
  }
  const trackStyle = (feature) => {
    return {
      weight: 5,
      color: trackColor
    }
  }
  const customLayer = L.geoJson(null, {
    style: trackStyle,

    // filter out the points, because we'll draw those a different way
    filter: thing => {
      return thing.geometry.type.toLowerCase() != 'point'
    }
  })
  trackLayer = omnivore.gpx(path, null, customLayer)
  trackLayer.addTo(theMap)
  trackLayer.on('ready', () => {
    if (settings.has('mapZoom')) {
      theMap.setZoom(parseInt(settings.get('mapZoom')))
      theMap.invalidateSize()
    } else {
      theMap.fitBounds(trackLayer.getBounds())
    }
  })

  // draw names for the waypoints
  if (gpxJSON.gpx.wpt) {
    gpxJSON.gpx.wpt.forEach(waypoint => {
      addStarMarker(waypoint.name[0], waypoint.$.lat, waypoint.$.lon)
    })
  }

}


function extractTrackPoints(gpsData) {
  return (() => {
    try {
      return JSON.parse(JSON.stringify(gpsData.gpx.trk[0].trkseg[0].trkpt)) // clone it
    } catch (err) {
      return undefined
    }
  })()
}


function createMarker(lat, lon) {
  // icon anchor is offset from the image, assuming 0,0 is upper left of the image
  let arrowIcon = L.icon({
    iconUrl: 'Up-Arrow-PNG-Transparent-Image.png',
    iconSize: [32, 32],
    iconAnchor: [16, 0]
  })
  const marker = L.marker(L.latLng(lat, lon), {
    icon: arrowIcon
  })
  return marker
}


function handleGPXFile(path) {
  let gpxText = fs.readFileSync(path, 'utf-8')
  xml2jsParser.parseString(gpxText, (err, parsedGPX) => {
    loadedGpxFile = path
    if (err) {
      // TODO show error dialog
      console.log('error parsing gpx file', err)
      return
    }

    // const xml = builder.buildObject(parsedGPX)
    // fs.writeFileSync('test-me.gpx', xml, 'utf-8')

    // TODO remove this , its only for debug
    global.gpsData = parsedGPX
    gpxJSON = parsedGPX
    console.log(checkValidGPX(parsedGPX))
    trackPoints = extractTrackPoints(parsedGPX)

    // map over trackPoints and compute and store a moment object for easy comparison later
    trackPoints = trackPoints.map(p => {
      p.moment = moment(p.time[0])
      return p
    })
    trackPositionElm.max = trackPoints.length
    const trackTime = moment(extractStartTime(parsedGPX))
    trackStartDatetimeElm.innerHTML = `Start: ${trackTime.format('ddd MMM DD h:mm:ss A')}`
    dateTimeElm.innerHTML = trackTime.format('dddd MMM DD, YYYY')
    titleTextInput.value = extractTrackName(parsedGPX)
    titleElm.innerHTML = settings.get('title') || extractTrackName(parsedGPX) || ''
    titleTextInput.value = settings.get('title') || extractTrackName(parsedGPX) || ''
    elevationElm.innerHTML = extractStartElevation(parsedGPX)
    const LL = extractStartLL(parsedGPX)
    trackMarker = createMarker(LL[0], LL[1])
    trackMarker.addTo(theMap)
    theMap.panTo(L.latLng(LL[0], LL[1]))
    latFieldElm.innerHTML = parseFloat(LL[0]).toFixed(6)
    lonFieldElm.innerHTML = parseFloat(LL[1]).toFixed(6)

    drawGPXTrack(path, parsedGPX)
  })
}


function handleTrackFile(path) {
  console.log('handling', path)
  chooseTrackElm.value = path

  if (path.toLowerCase().endsWith('gpx')) {
    handleGPXFile(path)
    settings.set('lastTrackPath', path)
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
  showHideElm(titleElm, titleTextInput.value.length > 0)
  showHideElm(dateTimeElm, showDateTimeElm.checked)
  showHideElm(speedElevationElm, showSpeedElevationElm.checked)
  showHideElm(latlonElm, showLLElm.checked)
}

function handleTextColorInput() {
  document.documentElement.style.setProperty('--text-overlay-color', this.value)
  settings.set('textColor', this.value)
}

function handleTrackColorInput() {
  settings.set('trackColor', this.value)
  trackLayer.setStyle({
    color: this.value
  })
}

function updateDisplayFromTrackPosition() {
  const ll = L.latLng(trackPoints[trackIndex].$.lat, trackPoints[trackIndex].$.lon)
  theMap.panTo(ll)
  trackMarker.setLatLng(ll)

  const previousTrackIndex = Math.max(trackIndex - 1, 0)

  const prevPointTime = {
    lat: trackPoints[previousTrackIndex].$.lat,
    lng: trackPoints[previousTrackIndex].$.lon,
    time: moment(trackPoints[previousTrackIndex].time[0]).valueOf()
  }
  const currentPointTime = {
    lat: trackPoints[trackIndex].$.lat,
    lng: trackPoints[trackIndex].$.lon,
    time: moment(trackPoints[trackIndex].time[0]).valueOf()
  }

  const speedMPH = geolib.getSpeed(prevPointTime, currentPointTime, {
    unit: 'mph'
  })
  const heading = geolib.getBearing(prevPointTime, currentPointTime)
  const compassDir = geolib.getCompassDirection(prevPointTime, currentPointTime)
  trackMarker.setRotationAngle(heading)
  speedFieldElm.innerHTML = Math.round(speedMPH)
  headingFieldElm.innerHTML = Math.round(heading)
  compassElm.innerHTML = compassDir.exact
  latFieldElm.innerHTML = parseFloat(trackPoints[trackIndex].$.lat).toFixed(6)
  lonFieldElm.innerHTML = parseFloat(trackPoints[trackIndex].$.lon).toFixed(6)
  elevationElm.innerHTML = Math.round(trackPoints[trackIndex].ele[0] * feetPerMeter) // TODO handle unit preference
  dateTimeElm.innerHTML = moment(trackPoints[trackIndex].time[0]).format('ddd MMM DD, YYYY hh:mm:ss a')
}


function handleTrackPositionChange() {
  if (!trackPoints) {
    return
  }

  // set the global track index per the slider
  trackIndex = this.value

  if (locked) {
    // this is the number of millis between the locked track position and the current track position
    const millisecondsDiff = trackPoints[trackIndex].moment.diff(lockedPositions.moment)
    console.log('msdiff', millisecondsDiff)

    const framesDiff = (millisecondsDiff / 1000) / secondsPerVideoFrame
    console.log('framesDiff', framesDiff)
    const videoPosSec = lockedPositions.videoCurrentTimeSec + (millisecondsDiff / 1000)
    console.log('videoPosSec', videoPosSec)
    videoElm.currentTime = videoPosSec
    videoPositionElm.value = (lockedPositions.videoCurrentTimeSec * framesPerSecond) + framesDiff
  }

  updateDisplayFromTrackPosition()

  // if locked, move the video position in proportion
  // if (locked) {
  //   // figure out the proportional change
  //   const delta = this.value - trackSliderPosition
  //   const pct = delta / this.max
  //   console.log('video position max', videoPositionElm.max)
  //   console.log('delta, pct', delta, pct)
  //   console.log('current video position', videoPositionElm.value)
  //   console.log('changing video position slider by', videoPositionElm.max * pct)
  //   videoPositionElm.value = parseInt(videoPositionElm.value) + Math.round(videoPositionElm.max * pct)
  //   console.log('videoPositionElm.value now', videoPositionElm.value)
  //   videoElm.currentTime = parseInt(videoPositionElm.value) / framesPerSecond
  // }

  trackSliderPosition = this.value
}


function handleChooseVideoType() {
  switch (this.value || videoTypeElm.value) {
    case 'regular-video':
      secondsPerVideoFrame = 1 / framesPerSecond
      break

    case '1-sec-time-lapse':
      secondsPerVideoFrame = 1
      break

    case '2-sec-time-lapse':
      secondsPerVideoFrame = 2
      break

    case '3-sec-time-lapse':
      secondsPerVideoFrame = 3
      break

    case '5-sec-time-lapse':
      secondsPerVideoFrame = 5
      break

    case '30-sec-time-lapse':
      secondsPerVideoFrame = 30
      break

    case '60-sec-time-lapse':
      secondsPerVideoFrame = 60
      break
  }

  if (this.value) {
    settings.set('secondsPerVideoFrame', this.value)
  }

}

function handleLock() {
  if (locked) {
    this.classList.remove('fa-lock')
    this.classList.add('fa-unlock')
    settings.delete('lockedPositions')
  } else {
    this.classList.add('fa-lock')
    this.classList.remove('fa-unlock')
  }

  // if they are locking the video to the track, we need to bind the two together
  // based on the current timestamp in the track
  // so we'll make note of which position in the track equals which position
  // in the video, and use that as a reference basis

  locked = !locked
  if (locked) {
    lockedPositions.videoCurrentTimeSec = videoElm.currentTime
    lockedPositions.videoFrame = videoPositionElm.value
    lockedPositions.trackIndex = trackIndex
    lockedPositions.time = trackPoints[trackIndex].time[0]
    lockedPositions.moment = moment(trackPoints[trackIndex].time[0])
    settings.set('lockedPositions', lockedPositions)
    console.log('lockedPositions', lockedPositions)
  }
}

function handleTrackFocusBlur(event) {
  console.log('track focus blur', this.id, event.type)
  if (event.type == 'focus' && this.id === 'video-position') {
    document.querySelector('.slider-w-label.video label').classList.add('selected')
    document.querySelector('.slider-w-label.track label').classList.remove('selected')
    activeSlider = 'video'
  }

  if (event.type == 'focus' && this.id === 'track-position') {
    document.querySelector('.slider-w-label.track label').classList.add('selected')
    document.querySelector('.slider-w-label.video label').classList.remove('selected')
    activeSlider = 'track'
  }

  if (event.type === 'blur') {
    document.querySelector('.slider-w-label.track label').classList.remove('selected')
    document.querySelector('.slider-w-label.video label').classList.remove('selected')
    activeSlider = undefined
  }

}

function handleNewWaypoint(event) {
  if (event.key === 'Enter') {
    console.log('handle new waypoint', mapMouseEvent)
    const newWaypoint = {
      $: {
        lat: `${mapMouseEvent.latlng.lat}`,
        lon: `${mapMouseEvent.latlng.lng}`
      },
      name: this.value
    }
    if (!gpxJSON.gpx.wpt) {
      gpxJSON.gpx.wpt = []
    }
    gpxJSON.gpx.wpt.push(newWaypoint)
    const xml = builder.buildObject(gpxJSON)

    // TODO ok to write to the file we loaded?
    fs.writeFileSync(loadedGpxFile, xml, 'utf-8')

    // now add a marker
    addStarMarker(this.value, mapMouseEvent.latlng.lat, mapMouseEvent.latlng.lng)

    addWaypointDialog.classList.add('hidden')
  }

  if (event.key === 'Escape') {
    addWaypointDialog.classList.add('hidden')
  }
}


showDateTimeElm.addEventListener('click', handleTextOverlayDisplay)
showSpeedElevationElm.addEventListener('click', handleTextOverlayDisplay)
showLLElm.addEventListener('click', handleTextOverlayDisplay)
titleTextInput.addEventListener('input', handleTextOverlayDisplay)

titleTextInput.addEventListener('input', function() {
  titleElm.innerHTML = this.value
  settings.set('title', this.value)
})

mapZoomElm.addEventListener('input', function() {
  console.log('zooming to', this.value)
  theMap.setZoom(this.value)
  settings.set('mapZoom', this.value)
  theMap.invalidateSize()
})

mapOpacityElm.addEventListener('input', function() {
  mapOverlayElm.style.opacity = parseInt(this.value) / 100.0
  settings.set('mapOpacity', this.value)
})

mapSizeElm.addEventListener('input', function() {
  mapOverlayElm.style.height = `${this.value}%`
  mapOverlayElm.style.width = `${this.value}%`
  settings.set('mapHeight', this.value)
  settings.set('mapWidth', this.value)
  theMap.invalidateSize()
})

chooseVideoElm.addEventListener('click', handleChooseVideo)
chooseTrackElm.addEventListener('click', handleChooseTrack)

textColorElm.addEventListener('input', handleTextColorInput)
trackColorElm.addEventListener('input', handleTrackColorInput)

tileLayerElm.addEventListener('change', handleChooseTileLayer)

playPauseElm.addEventListener('click', handlePlayPause)

videoTypeElm.addEventListener('change', handleChooseVideoType)

videoPositionElm.addEventListener('focus', handleTrackFocusBlur)
trackPositionElm.addEventListener('focus', handleTrackFocusBlur)
videoPositionElm.addEventListener('blur', handleTrackFocusBlur)
trackPositionElm.addEventListener('blur', handleTrackFocusBlur)

playbackSpeedElm.addEventListener('input', function() {
  videoElm.playbackRate = this.value / 100
  settings.set('playbackSpeed', this.value)
})

trackVideoLockElm.addEventListener('click', handleLock)

trackPositionElm.addEventListener('input', handleTrackPositionChange)

videoPositionElm.addEventListener('input', function() {
  videoElm.currentTime = this.value / framesPerSecond
  // compute the real world time of this video position and find the closest track point
  if (locked) {
    trackIndex = getTrackIndexForVideoPosition(true) // allowBackwards is true
    trackPositionElm.value = trackIndex
    updateDisplayFromTrackPosition()
  }

})

videoElm.addEventListener('play', () => {
  playPauseElm.classList.remove('fa-play')
  playPauseElm.classList.add('fa-pause')
  checkVideoInterval = setInterval(checkVideo, 100)
})

videoElm.addEventListener('pause', () => {
  playPauseElm.classList.remove('fa-pause')
  playPauseElm.classList.add('fa-play')
  clearInterval(checkVideoInterval)
})

newWaypointElm.addEventListener('keydown', handleNewWaypoint)

initializeMap()
loadSettings()


/**
  • add icon names to map
  The simplest way to handle this will be to just parse the gpx ourselves (we already do this)
  and add our own markers to the map.

  The current approach involves adding a hook that gets called for each 'feature' as it's added
  that's more for attaching popups and stuff.  Let's just add more markers... simpler

  • fix independent sliders
    It might be usful to have one method that does the video / track syncing which is used
    both during play AND scrubbing

  • play button behavior when unlocked?
    When unlocked, what should the play button do?

  • add points
    I want the ability to add points with labels in this tool.  This will be useful because as I
    watch the video with the track, I want to add things like 'this is a good lunch spot'
*/
