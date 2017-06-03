// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const xml2js = require('xml2js')
const xml2jsParser = xml2js.Parser()
const builder = new xml2js.Builder()
const fs = require('fs')
const moment = require('moment')
const settings = require('electron-settings')
const geolib = require('geolib')
const toGeoJSON = require('togeojson')
const toGPX = require('togpx')
const xmlParser = require('xmldom').DOMParser
const _ = require('underscore')

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
const elevationOpacityElm = document.querySelector('#elevation-opacity')
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
const elevationCanvasElm = document.querySelector('#elevation-canvas-element')
const currentElevationCanvasElm = document.querySelector('#current-elevation-marker-canvas-element')
const elevationGraphElm = document.querySelector('.elevation-graph-inner')
const errorDialogElm = document.querySelector('.error-dialog')
const errorTitleElm = document.querySelector('.error-dialog .content .message')
const errorDetailsElm = document.querySelector('.error-dialog .content .message-details')
const errorOKElm = document.querySelector('.error-dialog .content button')
const showElevationGraphElm = document.querySelector('#show-elevation')
const saveProjectElm = document.querySelector('#save-project')
const openProjectElm = document.querySelector('#open-project')
const infoDialogElm = document.querySelector('.info-dialog')
const infoMessageElm = document.querySelector('.info-dialog .message-details')

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
    trackMarker, locked, videoSliderPosition, secondsPerVideoFrame,
    lockedPositions, activeSlider, mapMouseEvent, gpxJSON, loadedGpxFile,
    elevationTrackPoints, elevationDrawingCtx, currentElevationDrawingCtx, fullGeoJSON

function initializeMap() {
    tileLayer = openTopoTiles
    tileLayer.addTo(theMap)
    locked = false
    videoSliderPosition = 0
    trackIndex = 0
    secondsPerVideoFrame = 1 / framesPerSecond
    lockedPositions = {}
    elevationTrackPoints = {}
    trackVideoLockElm.classList.remove('fa-lock')
    trackVideoLockElm.classList.add('fa-unlock')
    theMap.on('click', handleMapClick)
    theMap.on('zoomend', z => {
        console.log('zoom', z.target._zoom)
        mapZoomElm.value = z.target._zoom
    })
    currentElevationDrawingCtx = currentElevationCanvasElm.getContext('2d')

    elevationCanvasElm.height = elevationGraphElm.offsetHeight
    currentElevationCanvasElm.height = elevationGraphElm.offsetHeight

    console.log(`div hieght is ${elevationGraphElm.offsetHeight}, canvas height is ${elevationCanvasElm.height}`)
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
            handleTrackFile(settings.get('lastTrackPath'), true)
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
    if (settings.has('elevationOpacity')) {
        elevationGraphElm.style.opacity = parseInt(settings.get('elevationOpacity')) / 100.0
        elevationOpacityElm.value = settings.get('elevationOpacity')
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
        lockedPositions.moment = moment(lockedPositions.time)
        // videoElm.currentTime = lockedPositions.videoCurrentTimeSec
        // videoPositionElm.value = lockedPositions.videoFrame
        locked = true
    }
    // oh no, a 🐛
    if (settings.has('trackIndex')) {
        setTimeout(() => {
            trackIndex = parseInt(settings.get('trackIndex'))
            trackPositionElm.value = trackIndex
            updateDisplayFromTrackPosition()
        }, 2000)
    }
    if (settings.has('videoCurrentTime')) {
        setTimeout(() => {
            const currentTime = settings.get('videoCurrentTime')
            videoElm.currentTime = currentTime
            videoPositionElm.value = videoElm.currentTime * framesPerSecond
        }, 2000)
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
    for (let found = false; !found && i < trackPoints.properties.coordTimes.length; i++) {
    // console.log('i',i)

    // console.log('diffing ', realWorldVideoTimeAtCurrentPoint.toISOString(), ' to ', trackPoints[i].moment.toISOString())
        let dif = realWorldVideoTimeAtCurrentPoint.diff(trackPoints.properties.coordMoments[i])
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
    saveVideoPosition(videoElm.currentTime)

    if (locked) {
        trackIndex = getTrackIndexForVideoPosition()
        trackPositionElm.value = trackIndex
        updateDisplayFromTrackPosition()
        drawCurrentElevationMarker()
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
function checkValidTrack(geoJSON) {

    /*
      a geo json 'feature' of type 'linestring' has a properties object and a geometry object.
      The geometry object has a coordinates array with the LL and elevation, the properties has a coordTimes array with the timestamps
    */

    if (!geoJSON.features) {
        return valid(false, 'Couldn\'t find any features in this file')
    }

    // find the first linestring feature
    const foundTrack = geoJSON.features.find(feature => feature.geometry.type.toLowerCase() === 'linestring')

    if (!foundTrack) {
        return valid(false, 'Coundn\'t find a track')
    }
    console.log('working with', foundTrack)

    if (!foundTrack.geometry.coordinates || foundTrack.geometry.coordinates.length <= 0) {
        return valid(false, 'Track contains no points')
    }

    if (!foundTrack.properties.coordTimes || foundTrack.properties.coordTimes.length <= 0) {
        return valid(false, 'Track has points but no timestamps')
    }

    return valid(true, `Track has ${foundTrack.geometry.coordinates.length} valid points`)
}

function extractStartTime(geoJSONLinestring) {
    return (() => {
        try {
            return geoJSONLinestring.properties.coordTimes[0]
        } catch (err) {
            console.log('error extracting start time', err, err.stack)
            return undefined
        }
    })()
}

function extractTrackName(geoJSONLinestring) {
    return (() => {
        try {
            return geoJSONLinestring.properties.name
        } catch (err) {
            console.log('error extracting track name', err, err.stack)
            return undefined
        }
    })()
}

function extractStartLL(geoJSONLinestring) {
    return (() => {
        try {
            return [
                geoJSONLinestring.geometry.coordinates[0][1],
                geoJSONLinestring.geometry.coordinates[0][0]
            ]
        } catch (err) {
            console.log('error extracting starting Lat Long point', err, err.stack)
            return undefined
        }
    })()
}

function extractStartElevation(geoJSONLinestring, meters) {
    const multiplier = meters ? 1 : feetPerMeter
    return (() => {
        try {
            return Math.round(geoJSONLinestring.geometry.coordinates[0][2] * multiplier)
        } catch (err) {
            console.log('error extracting start elevation', err, err.stack)
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
        console.log('ERROR', err)
    }
}

function drawCurrentElevationMarker() {
    let ti = trackIndex
    const closestPoint = (() => {
        while (!elevationTrackPoints[ti]) {
            ti++
        }
        return elevationTrackPoints[ti]
    })()

    // const lineWidth = Math.max(4, Math.round(0.01 * currentElevationCanvasElm.width))
    const lineWidth = 4

    // draw a white vertical line
    currentElevationDrawingCtx.clearRect(0, 0, currentElevationCanvasElm.width, currentElevationCanvasElm.height)
    currentElevationDrawingCtx.beginPath()
    currentElevationDrawingCtx.moveTo(closestPoint.x, currentElevationCanvasElm.height)
    currentElevationDrawingCtx.lineTo(closestPoint.x, 0)
    currentElevationDrawingCtx.strokeStyle = '#000000'
    currentElevationDrawingCtx.lineWidth = 4
    currentElevationDrawingCtx.stroke()
    currentElevationDrawingCtx.closePath()

    currentElevationDrawingCtx.beginPath()
    currentElevationDrawingCtx.moveTo(closestPoint.x, currentElevationCanvasElm.height)
    currentElevationDrawingCtx.lineTo(closestPoint.x, 0)
    currentElevationDrawingCtx.strokeStyle = '#FFFFFF'
    currentElevationDrawingCtx.lineWidth = 2
    currentElevationDrawingCtx.stroke()
    currentElevationDrawingCtx.closePath()
}

function drawElevationGraph() {
    elevationDrawingCtx.clearRect(0, 0, elevationCanvasElm.width, elevationCanvasElm.height)

    Object.keys(elevationTrackPoints).forEach(trackIndexKey => {
        const point = elevationTrackPoints[trackIndexKey]
        // now we draw a line that starts at the bottom of the area, to pctHeight to the top
        elevationDrawingCtx.moveTo(point.x, elevationCanvasElm.height)
        elevationDrawingCtx.lineTo(point.x, elevationCanvasElm.height - point.pixelHeight)
        elevationDrawingCtx.stroke()
    })
}

function buildElevationGraph(geoJSONLinestring) {
    elevationDrawingCtx = elevationCanvasElm.getContext('2d')

    /*
      example coordinate:
      [
        -97.72330678068101,
        30.182916149497032,
        170.29
      ]
    */
    let minMaxElev = geoJSONLinestring.geometry.coordinates.reduce((accum, point) => {
        if (point[2] < accum.min) {
            accum.min = point[2]
        }
        if (point[2] > accum.max) {
            accum.max = point[2]
        }
        return accum

    }, {
        min: 50000,
        max: -1
    })

    const elevRange = minMaxElev.max - minMaxElev.min
    let x = 0

    // FIXME, the idea here is to make the canvas width (visible width) match the number of points
    // so that the elevation graph 'fills' the whole way across
    // if the canvas visible width is less than the actual pixel width , then the canvas
    // will 'stretch' the content, which is actually what we want

    // FIXME #2 , the / 2 needs to be computed
    elevationCanvasElm.width = geoJSONLinestring.geometry.coordinates.length / 2
    currentElevationCanvasElm.width = elevationCanvasElm.width // needs to match
    currentElevationDrawingCtx = currentElevationCanvasElm.getContext('2d')

    // build the array of elevationTrackPoints, but don't draw them yet
    geoJSONLinestring.geometry.coordinates.forEach((point, index) => {
    // we can skip drawing every point to make the whole track fit
    // let modFactor = Math.round(trackPoints.length / elevationCanvasElm.width)

        // FIXME, this needs to be computed
        let modFactor = 2
        if (index % modFactor != 0) {
            // hacky way to keep track
            elevationTrackPoints[index] = {}
            elevationTrackPoints[index].point = point

            // minMaxElev.max should be the full height of the area, and min should be the bottom
            const totalHeight = elevRange
            const markerHeight = point[2] - minMaxElev.min
            const pctHeight = markerHeight / totalHeight
            let pixelHeight = Math.round(pctHeight * elevationGraphElm.offsetHeight)
            pixelHeight -= 5 // gap at the top of elevation graph

            elevationTrackPoints[index].x = x
            elevationTrackPoints[index].pixelHeight = pixelHeight

            x = x + 1
        }
    })

    drawElevationGraph()
}

function drawNamedPoints(geoJSON) {
    const points = geoJSON.features.filter(f => f.geometry.type.toLowerCase() === 'point')
    points.forEach(point => addStarMarker(point.properties.name, point.geometry.coordinates[1], point.geometry.coordinates[0]))
}

/**
  Given a geo json object, draw the path on the map
*/
function drawTrack(geoJSONLinestring) {

    // we have just the linestring feature, so pass the full geojson structure to
    // leaflet
    const fullGJ = {
        type: 'FeatureCollection',
        features: [geoJSONLinestring]
    }
    // remove the old one
    if (trackLayer) {
        theMap.removeLayer(trackLayer)
    }
    const trackStyle = (feature) => {
        return {
            weight: 5,
            color: trackColor
        }
    }
    trackLayer = L.geoJSON(fullGJ, {style: trackStyle})
    trackLayer.addTo(theMap)

    theMap.fitBounds(trackLayer.getBounds())
}

/**
  Given a geo json object, find the first 'linestring', which is a track we can work with
  and return it
*/
function extractTrackPoints(gpsData) {
    return (() => {
        try {
            return gpsData.features.find(feature => feature.geometry.type.toLowerCase() === 'linestring')
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

function displayTrack(geoJSONLinestringFeature) {
    // compute and store a moment() object for each coordTime
    const coordMoments = []
    geoJSONLinestringFeature.properties.coordTimes.forEach(t => {
        coordMoments.push(moment(t))
    })
    geoJSONLinestringFeature.properties.coordMoments = coordMoments
    trackPositionElm.max = geoJSONLinestringFeature.geometry.coordinates.length
    const trackTime = moment(extractStartTime(geoJSONLinestringFeature))
    trackStartDatetimeElm.innerHTML = `Start: ${trackTime.format('ddd MMM DD h:mm:ss A')}`
    dateTimeElm.innerHTML = trackTime.format('dddd MMM DD, YYYY')
    titleTextInput.value = extractTrackName(geoJSONLinestringFeature)
    titleElm.innerHTML = settings.get('title') || extractTrackName(geoJSONLinestringFeature) || ''
    titleTextInput.value = settings.get('title') || extractTrackName(geoJSONLinestringFeature) || ''
    elevationElm.innerHTML = extractStartElevation(geoJSONLinestringFeature)
    const LL = extractStartLL(geoJSONLinestringFeature)
    trackMarker = createMarker(LL[0], LL[1])
    trackMarker.addTo(theMap)
    theMap.panTo(L.latLng(LL[0], LL[1]))
    latFieldElm.innerHTML = parseFloat(LL[0]).toFixed(6)
    lonFieldElm.innerHTML = parseFloat(LL[1]).toFixed(6)

    drawTrack(geoJSONLinestringFeature)
}

function handleGPXFile(path) {
    try {
        let gpxText = fs.readFileSync(path, 'utf-8')
        let gpxDom = new xmlParser().parseFromString(gpxText)
        let gpxGEOJson = toGeoJSON.gpx(gpxDom)
        // TODO remove this , its only for debug
        global.gpsData = gpxGEOJson

        const validResult = checkValidTrack(gpxGEOJson)
        if (!validResult.valid) {
            showError('Error reading GPX file', validResult.message)
        }

        trackPoints = extractTrackPoints(gpxGEOJson)
        displayTrack(trackPoints)
        buildElevationGraph(trackPoints)
        drawNamedPoints(gpxGEOJson)

        return gpxGEOJson
    } catch (err) {
        showError('Error reading GPX', `${err}\n${err.stack}`)
    }
}

function handleTrackFile(path) {
    console.log('handling', path)
    chooseTrackElm.value = path

    if (path.toLowerCase().endsWith('gpx')) {
        const geoJSON = handleGPXFile(path)
        fullGeoJSON = geoJSON
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
    const ll = L.latLng(trackPoints.geometry.coordinates[trackIndex][1], trackPoints.geometry.coordinates[trackIndex][0])
    theMap.panTo(ll)
    trackMarker.setLatLng(ll)

    const previousTrackIndex = Math.max(trackIndex - 1, 0)

    const prevPointTime = {
        lat: trackPoints.geometry.coordinates[previousTrackIndex][1],
        lng: trackPoints.geometry.coordinates[previousTrackIndex][0],
        time: trackPoints.properties.coordMoments[previousTrackIndex].valueOf()
    }
    const currentPointTime = {
        lat: trackPoints.geometry.coordinates[trackIndex][1],
        lng: trackPoints.geometry.coordinates[trackIndex][0],
        time: trackPoints.properties.coordMoments[trackIndex].valueOf()
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
    latFieldElm.innerHTML = parseFloat(trackPoints.geometry.coordinates[trackIndex][1]).toFixed(6)
    lonFieldElm.innerHTML = parseFloat(trackPoints.geometry.coordinates[trackIndex][0]).toFixed(6)
    elevationElm.innerHTML = Math.round(trackPoints.geometry.coordinates[trackIndex][2] * feetPerMeter) // TODO handle unit preference
    dateTimeElm.innerHTML = trackPoints.properties.coordMoments[trackIndex].format('ddd MMM DD, YYYY hh:mm:ss a')
}

let saveTrackIndex = _.throttle(() => {
    settings.set('trackIndex', trackIndex)
}, 1000)

let saveVideoPosition = _.throttle((currentTime) => {
    settings.set('videoCurrentTime', currentTime)
}, 1000)

function handleTrackPositionChange() {
    if (!trackPoints) {
        return
    }

  // set the global track index per the slider
    trackIndex = parseInt(this.value)

    console.log('trackIndex', trackIndex, 'currentPoint', trackPoints.geometry.coordinates[trackIndex])

    if (locked) {
        // this is the number of millis between the locked track position and the current track position
        const realWorldSecDiff = trackPoints.properties.coordMoments[trackIndex].diff(lockedPositions.moment) / 1000
        console.log('realWorldSecDiff', realWorldSecDiff)
        newVideoPositionSeconds = lockedPositions.videoCurrentTimeSec + realWorldSecDiff / secondsPerVideoFrame / framesPerSecond
        console.log('newVideoPositionSeconds', newVideoPositionSeconds)
        videoElm.currentTime = newVideoPositionSeconds
        videoPositionElm.value = videoElm.currentTime * framesPerSecond
        saveVideoPosition(videoElm.currentTime)
    }

    saveTrackIndex()

    updateDisplayFromTrackPosition()
    drawCurrentElevationMarker()
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
        lockedPositions.videoFrame = parseInt(videoPositionElm.value)
        lockedPositions.trackIndex = trackIndex
        lockedPositions.time = trackPoints.properties.coordTimes[trackIndex]
        lockedPositions.moment = trackPoints.properties.coordMoments[trackIndex]
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

        // TODO ok to write to the file we loaded?  Maybe write a .original
        fs.writeFileSync(loadedGpxFile, xml, 'utf-8')

        // now add a marker
        addStarMarker(this.value, mapMouseEvent.latlng.lat, mapMouseEvent.latlng.lng)

        addWaypointDialog.classList.add('hidden')
    }

    if (event.key === 'Escape') {
        addWaypointDialog.classList.add('hidden')
    }
}

function flashInfo(message) {
    infoMessageElm.innerHTML = message
    infoDialogElm.classList.remove('seethrough')
    setTimeout(() => {
        infoDialogElm.classList.add('seethrough')
    }, 5000)
}

function showError(title, message) {
    errorTitleElm.innerHTML = title
    errorDetailsElm.innerHTML = message
    errorDialogElm.classList.remove('hidden')
}

errorOKElm.addEventListener('click', () => {
    errorDialogElm.classList.add('hidden')
})

showDateTimeElm.addEventListener('click', handleTextOverlayDisplay)
showSpeedElevationElm.addEventListener('click', handleTextOverlayDisplay)
showLLElm.addEventListener('click', handleTextOverlayDisplay)
titleTextInput.addEventListener('input', handleTextOverlayDisplay)

showElevationGraphElm.addEventListener('click', function() {
    console.log(this)
    if (this.checked) {
        document.querySelector('.elevation-graph-outer').classList.remove('hidden')
    } else {
        document.querySelector('.elevation-graph-outer').classList.add('hidden')
    }
})

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

elevationOpacityElm.addEventListener('input', function() {
    elevationGraphElm.style.opacity = parseInt(this.value) / 100.0
    settings.set('elevationOpacity', this.value)
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
    saveVideoPosition(videoElm.currentTime)
    // compute the real world time of this video position and find the closest track point
    if (locked) {
        trackIndex = getTrackIndexForVideoPosition(true) // allowBackwards is true
        trackPositionElm.value = trackIndex
        updateDisplayFromTrackPosition()
        drawCurrentElevationMarker()
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

saveProjectElm.addEventListener('click', function() {
    dialog.showSaveDialog({
        title: 'save project',
        defaultPath: titleTextInput.value,
        filters: [{
            name: 'json',
            extensions: ['json']
        }]
    }, (path) => {
        console.log('chosen path', path)
        if (path) {
            fs.writeFileSync(path, JSON.stringify(settings.getAll(), null, 2), 'utf-8')
            flashInfo(`Saved ${path}`)
        }
    })
})

openProjectElm.addEventListener('click', function() {
    dialog.showOpenDialog({
        title: 'choose project',
        filters: [{
            name: 'json',
            extensions: ['json']
        }],
        properties: ['openFile']
    }, (path) => {
        console.log('chosen path', path)
        if (path) {
            theMap.eachLayer(function(layer) {
                theMap.removeLayer(layer)
            })
            const projJSONText = fs.readFileSync(path[0], 'utf-8')
            const projectJSON = JSON.parse(projJSONText)
            settings.setAll(projectJSON)
            loadSettings()
        }
    })

})

document.querySelector('body').addEventListener('resize', () => {
    console.log('body resize')

  // TODO, handle the canvas resizing here for elevation graph, if necessary
})

initializeMap()
loadSettings()

/**

*/
