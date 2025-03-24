// https://stackoverflow.com/questions/1134579/smooth-gps-data
// kalman filter which filters out gps noise
class GPSKalmanFilter 
{
    constructor (decay = 4) 
    {
      this.decay = decay
      this.variance = -1
      this.minAccuracy = 1
    }
    
    process (lat, lng, accuracy, timestampInMs) {
      if (accuracy < this.minAccuracy) accuracy = this.minAccuracy
  
      if (this.variance < 0) {
        this.timestampInMs = timestampInMs
        this.lat = lat
        this.lng = lng
        this.variance = accuracy * accuracy
      } else {
        const timeIncMs = timestampInMs - this.timestampInMs
  
        if (timeIncMs > 0) {
          this.variance += (timeIncMs * this.decay * this.decay) / 1000
          this.timestampInMs = timestampInMs
        }
    
        const _k = this.variance / (this.variance + (accuracy * accuracy))
        this.lat += _k * (lat - this.lat)
        this.lng += _k * (lng - this.lng)
  
        this.variance = (1 - _k) * this.variance
      }
  
      return [this.lng, this.lat]
    }
}

let db;

// https://www.javascripttutorial.net/web-apis/javascript-indexeddb/ took the db from here and changed for my use case
// same for all db stuff
// initialise db
function initDB() {
    // check for IndexedDB support
    if (!window.indexedDB) {
        // this should prob be an error
        console.log("Your browser doesn't support IndexedDB");
        return;
    }

    // open the Jogga database with the version 1
    const request = indexedDB.open('JoggaDB', 1);

    // create the runs store and index
    request.onupgradeneeded = (event) => {
        db = event.target.result;

        // create the runs object store with auto-increment
        if (!db.objectStoreNames.contains('runs')) {
            const store = db.createObjectStore('runs', {
                autoIncrement: true
            });
            
            // create an index on the date
            store.createIndex('date', 'date', { unique: false });
        }
    };

    // handle the error event
    request.onerror = (event) => {
        // do I need this now?
        console.error('Database error:', event.target.error);
    };

    // handle the success event
    request.onsuccess = (event) => {
        db = event.target.result;
    };
}

// save a run to the db
function saveRun(runData) 
{

    // check db exists
    if (!db) 
    {
        Swal.fire({
            title: "Error Saving Run",
            text: "Database not initialised. Please reload the page.",
            icon: "error",
            confirmButtonText: "Okay",
            confirmButtonColor: "#007700"
        });
        return;
    }
    
    // create a new transaction
    const txn = db.transaction('runs', 'readwrite');

    // get the runs object store
    const store = txn.objectStore('runs');
    
    // format the run data
    const run = {
        date: new Date(),
        duration: runData.duration,
        distance: runData.distance,
        polylines: runData.polylines
    };
    
    // add the run to db
    let query = store.add(run);

    // handle success case
    query.onsuccess = function (event) {        
        // just put this so when I test on phone I can see what's happening
        Swal.fire({
            title: "Run Saved!",
            text: `Your ${runData.distance}km run has been saved.`,
            icon: "success",
            confirmButtonText: "Great!",
            confirmButtonColor: "#007700"
        });
    };

    // handle the error case
    query.onerror = function (event) {
        // just put this so when I test on phone I can see what's happening
        Swal.fire({
            title: "Error Saving Run",
            text: "There was a problem saving your run data.",
            icon: "error",
            confirmButtonText: "Okay",
            confirmButtonColor: "#007700"
        });
    }
}

document.addEventListener("DOMContentLoaded", function () {

    const kalmanFilter = new GPSKalmanFilter();
    const map = new L.map('map', { zoomControl: false, attributionControl: true });
    const polylineGroup = L.layerGroup().addTo(map);

    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');
    const continueButton = document.getElementById('continue-button');
    const finishButton = document.getElementById('finish-button');
    const historyButton = document.getElementById('history-button');
    const settingsButton = document.getElementById('settings-button');
    const whereamiButton = document.getElementById('whereami-button');

    // hide buttons until location established
    startButton.classList.add('hidden');
    pauseButton.classList.add('hidden');
    continueButton.classList.add('hidden');
    finishButton.classList.add('hidden');

    initDB();

    const myIcon = L.divIcon({
        html: '<i class="fas fa-circle" style="color: gold; font-size: 20px;"></i>',
        className: 'marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });

    // add open street map tile from https://leafletjs.com/index.html
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.attributionControl.setPosition('topleft');
    
    map.setView([0, 0], 2);
    
    let marker;
    let currentPolyline;
    let newVisit = true;
    let isRunning = false;
    let previousLat = null;
    let previousLng = null;
    let totalDistance = 0;
    let previousTime = null;
    let paceHistory = [];
    let permissionGranted = false;
    
    // tracking current line and all line sso they can be saved
    let allPolylines = [];
    let currentPolylineCoords = [];
    
    // updating user location and line showing movement
    function updateLocation(position) {
        // if we get here then we have location services
        if (!permissionGranted) 
        {
            permissionGranted = true;

            // display start button only if we are not restoring a locally saved run
            if (continueButton.classList.contains('hidden')) 
            {
                startButton.classList.remove('hidden');
            }
        }

        let rawLat = position.coords.latitude;
        let rawLng = position.coords.longitude;
        let accuracy = position.coords.accuracy;
        let timestamp = position.timestamp;

        // filter out gps noise
        const [newLng, newLat] = kalmanFilter.process(rawLat, rawLng, accuracy, timestamp);

        let currentTime = new Date().getTime();
        let speed = position.coords.speed;
      
        // move the marker to current coords
        if (!marker) 
        {
            marker = L.marker([newLat, newLng], {icon: myIcon}).addTo(map);
        } 
        else 
        {
            marker.setLatLng([newLat, newLng]);
        }

        // don't want it snapping you back to your position all the time because then you can't move the map around and plan where you're going
        // so only do it when you initially enter the page.
        if (newVisit) 
        {
            map.setView([newLat, newLng], 19);
            newVisit = false;
        }

        // if running then draw line
        if (isRunning) 
        {
            currentPolyline.addLatLng([newLat, newLng]);
            
            // Store coordinate for database storage
            currentPolylineCoords.push([newLat, newLng]);

            if(previousLat != null && previousLng != null)
            {
                let distanceBetweenCoords = distance(previousLat,previousLng, newLat, newLng);
                totalDistance+=distanceBetweenCoords;
                document.getElementById("distance").innerHTML = totalDistance.toFixed(2) + "km";

                if(previousTime == null)
                {
                    previousTime = currentTime;
                }

                if (speed != null && speed != undefined) 
                {
                    // calc pace in km/hr
                    let currentPace;
                    if(speed > 0)
                    {
                        currentPace = 1000/speed;
                    }
                    else
                    {
                        currentPace = 0;
                    }
                    // keep 25 speed readings and avg them so any rogue readings have less impact
                    paceHistory.push(currentPace);
                    if(paceHistory.length > 25)
                    {
                        paceHistory.shift();
                    }
                    if(paceHistory.length==25 && totalDistance > 0.08)
                    {
                        let avgPace = paceHistory.reduce((a, b) => a + b, 0) / paceHistory.length;
                        if (avgPace > 0) 
                        {
                            document.getElementById("pace").innerHTML = getMinAndSec(avgPace) + "/km";
                        }   
                        else if(avgPace==0)
                        {
                            document.getElementById("pace").innerHTML = "∞/km";
                        }
                        for (let i = 0; i < 5; i++) 
                        {
                            paceHistory.shift();
                        }
                    }
                }
                else
                {
                    document.getElementById("pace").innerHTML = "--:--/km";
                }
            }

            // will add an else here if I like the above so when it fails it will use this because the literature seems
            // to suggest ios doesn't like the speed reading
/*
            if(previousLat != null && previousLng != null)
            {
                let pace;
                let distanceBetweenCoords = distance(previousLat,previousLng, newLat, newLng);
                totalDistance+=distanceBetweenCoords;
                document.getElementById("distance").innerHTML = totalDistance.toFixed(2) + "km";
                let timeElapsed = (currentTime - previousTime)/1000; // time is in milliseconds so convert to seconds
                if(distanceBetweenCoords > 0.0001)
                {
                    pace = timeElapsed / distanceBetweenCoords; // this is seconds per km now
                    // get rid of crazy paces because they are gps issues, I think I'll try and smooth the noise 
                    // eventually earlier than this and chuck any that suddenly jolt but need some research to see
                    // what is acceptable and not etc, this does for now I think
                    if(pace > 140)
                    {
                        paceHistory.push(pace);
                    }
                }
                else
                {
                    pace = 0;
                    paceHistory.push(pace);
                }
                if(paceHistory.length == 12)
                {
                    // https://stackoverflow.com/questions/29544371/finding-the-average-of-an-array-using-js
                    avgPace = paceHistory.reduce((a, b) => a + b) / paceHistory.length;
                    if(avgPace==0)
                    {
                        document.getElementById("pace").innerHTML = "∞/km";
                    }
                    else
                    {
                        document.getElementById("pace").innerHTML = getMinAndSec(avgPace) + "/km";
                    }
                    // this makes it so it then averages the next n otherwise it would update every time a gps location is received
                    paceHistory = [];
                }
                // dont have enough gps entries yet so 
                else if(paceHistory.length == 0)
                {
                    document.getElementById("pace").innerHTML = "--:--/km";
                }
            }
                */
            previousLat = newLat;
            previousLng = newLng;
            previousTime = currentTime;
        }
    }

    // handle location errors
    // https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
    function locationError(error) {
        // case user denied location services
        if (error.code == 1) 
        {
            Swal.fire({
                title: "Location Access Denied",
                text: "Jogga requires access to your location. Enable location services and reload the page.",
                icon: "error",
                confirmButtonText: "Okay",
                confirmButtonColor: "#007700"
            });
            
            // hide start button so track can't be used
            startButton.classList.add('hidden');
        } 
        else if (error.code == 2) 
        // gps can't get location
        {
            Swal.fire({
                title: "Location Unavailable",
                text: "Your current position is unavailable. Please check your device's GPS or try again later.",
                icon: "warning",
                confirmButtonText: "Okay",
                confirmButtonColor: "#007700"
            });
        } 
        // gps timed out
        else if (error.code == 3) 
        {
            Swal.fire({
                title: "Location Timeout",
                text: "It's taking too long to get your location. Please check your GPS settings.",
                icon: "warning",
                confirmButtonText: "Okay",
                confirmButtonColor: "#007700"
            });
        }
    }

    // https://www.programmingbasic.com/convert-seconds-to-minutes-and-seconds-javascript
    // turn seconds to mins and seconds
    function getMinAndSec(seconds){
        seconds = Math.round(seconds);
        const min = Math.floor(seconds/60);
        const secs = seconds % 60;
        return min.toString().padStart(2, '0')+":"+secs.toString().padStart(2, '0');
    }
    
    // track location
    if (navigator.geolocation) 
    {
        // Simply start watchPosition - this should prompt for permission if needed
        navigator.geolocation.watchPosition(updateLocation, locationError, {
            enableHighAccuracy: true,
            timeout: 10000, 
            maximumAge: 0
        });
    } 
    else 
    {
        // when browser can't gps
        Swal.fire({
            title: "GPS Not Supported",
            text: "Your browser doesn't support geolocation, which is required for this app to work.",
            icon: "error",
            confirmButtonText: "Okay",
            confirmButtonColor: "#007700"
        });
    }
    
    // https://stackoverflow.com/questions/5517597/plain-count-up-timer-in-javascript
    let totalSeconds = 0;
    let timerVar;
    
    function countTimer() {
      ++totalSeconds;
      let hour = Math.floor(totalSeconds / 3600);
      let minute = Math.floor((totalSeconds - hour * 3600) / 60);
      let seconds = totalSeconds - (hour * 3600 + minute * 60);
      
      if (hour < 10) hour = "0" + hour;
      if (minute < 10) minute = "0" + minute;
      if (seconds < 10) seconds = "0" + seconds;
      
      document.getElementById("timer").innerHTML = hour + ":" + minute + ":" + seconds;
    }

    // take the run data and pass it to saverun
    function saveRunToDatabase() 
    {
        const runData = {
            duration: totalSeconds,
            distance: parseFloat(totalDistance.toFixed(2)),
            polylines: allPolylines,
        };
            
        // save run to db
        saveRun(runData);
    }

    // following are all functions to add and remove buttons when one is clicked
    // and to stop and start timers, lines etc
    startButton.addEventListener('click', function() 
    {
        timerVar = setInterval(countTimer, 1000);
        isRunning = true;
        
        // create polyline and add to map
        currentPolyline = L.polyline([], {color: 'black'}).addTo(polylineGroup);
        currentPolylineCoords = [];
        
        startButton.classList.add('hidden');
        pauseButton.classList.remove('hidden');
        historyButton.classList.add('hidden');
        settingsButton.classList.add('hidden');
    });

    pauseButton.addEventListener('click', function() 
    {
        isRunning = false;
        clearInterval(timerVar);
        document.getElementById("pace").innerHTML = "--:--/km";
        paceHistory = [];
        
        // save current polyline to all polylines
        if (currentPolylineCoords.length > 0) {
            allPolylines.push([...currentPolylineCoords]);
        }
        
        finishButton.classList.remove('hidden');
        continueButton.classList.remove('hidden');
        pauseButton.classList.add('hidden');
    });

    finishButton.addEventListener('click', function() 
    {
        clearInterval(timerVar);
        isRunning = false;
        
        // save run
        // maybe make a pop up ask are you sure then confirm then save rnu
        if (totalDistance > 0) {
            saveRunToDatabase();
        }
        
        // reset everything
        previousLat = null;
        previousLng = null;
        totalDistance = 0;
        previousTime = null;
        currentPolyline = null;
        currentPolylineCoords = [];
        allPolylines = [];
        totalSeconds = 0;
        
        polylineGroup.clearLayers();
        document.getElementById("pace").innerHTML = "--:--/km";
        document.getElementById("distance").innerHTML = "0.00km";
        document.getElementById("timer").innerHTML = "00:00:00";

        finishButton.classList.add('hidden');
        continueButton.classList.add('hidden');
        startButton.classList.remove('hidden');
        historyButton.classList.remove('hidden');
        settingsButton.classList.remove('hidden');

        localStorage.removeItem('joggaRunData');
    });

    continueButton.addEventListener('click', function() 
    {
        timerVar = setInterval(countTimer, 1000);
        isRunning = true;

        previousLat = null;
        previousLng = null;
        previousTime = null;
        
        // new polyline
        currentPolyline = L.polyline([], {color: 'black'}).addTo(polylineGroup);
        currentPolylineCoords = [];
        
        finishButton.classList.add('hidden');
        continueButton.classList.add('hidden');
        pauseButton.classList.remove('hidden');
    });

    // https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
    // distance between 2 points on globe
    function distance(lat1, lon1, lat2, lon2) {
        const r = 6371; // km
        const p = Math.PI / 180;
      
        const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2
                      + Math.cos(lat1 * p) * Math.cos(lat2 * p) *
                        (1 - Math.cos((lon2 - lon1) * p)) / 2;
      
        return 2 * r * Math.asin(Math.sqrt(a));
    }

    // button moving focus back to user so if they get lost on map they can re-centre
    whereamiButton.addEventListener('click', function()
    {
        if (marker) 
        {
            map.setView(marker.getLatLng(), 19);
        }
    });

    // tell user they are offline and how map might not load but it's stull tracking
    window.addEventListener('offline', function() {
        Swal.fire({
            title: "You're offline",
            text: "Tracking will continue but map won't update until you're back online",
            icon: "warning",
            confirmButtonText: "Okay",
            confirmButtonColor: "#007700"
        });
    });

    // save run data in local storage 
    function saveRunToLocalStorage() 
    {
        // only save if run is happening
        if ((isRunning || (continueButton.classList.contains('hidden') == false))) 
        {
            // save the current polyline if ongoing
            if (isRunning && currentPolylineCoords.length > 0) 
            {
                allPolylines.push([...currentPolylineCoords]);
            }
                
            const runData = {
                totalSeconds: totalSeconds,
                totalDistance: totalDistance,
                allPolylines: allPolylines
                };
            
            localStorage.setItem('joggaRunData', JSON.stringify(runData));
        }
    }

    // save the run when app is minimised or closed
    document.addEventListener('visibilitychange', function() {
        // only do this when minimising 
        if (document.visibilityState == 'hidden') 
        {
            saveRunToLocalStorage();
            // if it was during a run then pause everything and save it
            if (isRunning) 
            {
                clearInterval(timerVar);
                isRunning = false;
                document.getElementById("pace").innerHTML = "--:--/km";
                paceHistory = [];
                if (currentPolylineCoords.length > 0) 
                {
                    allPolylines.push([...currentPolylineCoords]);
                }
                
                startButton.classList.add('hidden');
                pauseButton.classList.add('hidden');
                continueButton.classList.remove('hidden');
                finishButton.classList.remove('hidden');
                historyButton.classList.add('hidden');
                settingsButton.classList.add('hidden');
            }
        }
    });

    // check local storage for a saved run
    function checkForSavedRun() 
    {
        // get the run (null if none)
        const savedRunData = localStorage.getItem('joggaRunData');
    
        // if exists then load it
        if (savedRunData) 
        {
            const runData = JSON.parse(savedRunData);
            
            // restore the session
            restoreRun(runData);
        }
    }

    // restore a run from local storage
    function restoreRun(runData) 
    {
        totalSeconds = runData.totalSeconds;
        totalDistance = runData.totalDistance;
        allPolylines = runData.allPolylines;
    
        // redraw all the lines
        polylineGroup.clearLayers();
        allPolylines.forEach(polylineCoords => {
            L.polyline(polylineCoords, {color: 'black'}).addTo(polylineGroup);
        });
    
        // display all the run info
        document.getElementById("distance").innerHTML = totalDistance.toFixed(2) + "km";

        let hour = Math.floor(totalSeconds / 3600);
        let minute = Math.floor((totalSeconds - hour * 3600) / 60);
        let seconds = totalSeconds - (hour * 3600 + minute * 60);
        
        if (hour < 10) hour = "0" + hour;
        if (minute < 10) minute = "0" + minute;
        if (seconds < 10) seconds = "0" + seconds;
        
        document.getElementById("timer").innerHTML = hour + ":" + minute + ":" + seconds;
    
        // set UI to paused
        startButton.classList.add('hidden');
        pauseButton.classList.add('hidden');
        continueButton.classList.remove('hidden');
        finishButton.classList.remove('hidden');
        historyButton.classList.add('hidden');
        settingsButton.classList.add('hidden');

        localStorage.removeItem('joggaRunData');
    }

    checkForSavedRun();
});