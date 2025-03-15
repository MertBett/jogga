// https://stackoverflow.com/questions/1134579/smooth-gps-data
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

    startButton.classList.add('hidden');
    pauseButton.classList.add('hidden');
    continueButton.classList.add('hidden');
    finishButton.classList.add('hidden');

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
    
    // updating user location and line showing movement
    function updateLocation(position) {
        // if we get here then we have location services
        if (!permissionGranted) 
        {
            permissionGranted = true;
            startButton.classList.remove('hidden');
        }

        let rawLat = position.coords.latitude;
        let rawLng = position.coords.longitude;
        let accuracy = position.coords.accuracy;
        let timestamp = position.timestamp;

        const [newLng, newLat] = kalmanFilter.process(rawLat, rawLng, accuracy, timestamp);

        let currentTime = new Date().getTime();
        let speed = position.coords.speed;
      
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
                    let currentPace;
                    if(speed > 0)
                    {
                        currentPace = 1000/speed;
                    }
                    else
                    {
                        currentPace = 0;
                    }
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

    function locationError(error) {
        // https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
        console.error("Geolocation error:", error.code, error.message);
        
        if (error.code === 1) {
            Swal.fire({
                title: "Location Access Denied",
                text: "Jogga requires access to your location. Enable location services to continue.",
                icon: "error",
                confirmButtonText: "Okay",
                confirmButtonColor: "#3085d6"
            });
            
            startButton.classList.add('hidden');
        } else if (error.code === 2) { 
            Swal.fire({
                title: "Location Unavailable",
                text: "Your current position is unavailable. Please check your device's GPS or try again later.",
                icon: "warning",
                confirmButtonText: "Okay",
                confirmButtonColor: "#3085d6"
            });
        } else if (error.code === 3) {
            Swal.fire({
                title: "Location Timeout",
                text: "It's taking too long to get your location. Please check your GPS settings.",
                icon: "warning",
                confirmButtonText: "Okay",
                confirmButtonColor: "#3085d6"
            });
            
            startLocationTracking();
        }
    }

    // https://www.programmingbasic.com/convert-seconds-to-minutes-and-seconds-javascript
    function getMinAndSec(seconds){
        seconds = Math.round(seconds);
        const min = Math.floor(seconds/60);
        const secs = seconds % 60;
        return min.toString().padStart(2, '0')+":"+secs.toString().padStart(2, '0');
    }

    function startLocationTracking() {
        // Clear any existing watch to avoid duplicates
        if (watchPositionId !== null) {
            navigator.geolocation.clearWatch(watchPositionId);
        }
        
        // Start a new watch
        watchPositionId = navigator.geolocation.watchPosition(updateLocation, locationError, {
            enableHighAccuracy: true,
            timeout: 10000, 
            maximumAge: 0
        });
    }
    
    if (navigator.geolocation) {
        // FIXED: Improved permissions checking
        if ('permissions' in navigator) {
            navigator.permissions.query({name: 'geolocation'})
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        permissionGranted = true;
                        startButton.classList.remove('hidden');
                        startLocationTracking();
                    } else if (permissionStatus.state === 'denied') {
                        permissionGranted = false;
                        // Use standard GeolocationPositionError codes
                        locationError({
                            code: 1, // PERMISSION_DENIED
                            message: "Permission denied"
                        });
                    } else {
                        // If permission state is 'prompt', we'll wait for user to decide
                        console.log("Permission status: prompt - waiting for user decision");
                        // Start location tracking anyway, as it will trigger the permission prompt
                        startLocationTracking();
                    }
                    
                    // Handle permission changes
                    permissionStatus.onchange = function() {
                        console.log("Permission status changed to:", this.state);
                        if (this.state === 'granted') {
                            permissionGranted = true;
                            startButton.classList.remove('hidden');
                            startLocationTracking();
                        } else if (this.state === 'denied') {
                            permissionGranted = false;
                            startButton.classList.add('hidden');
                            if (watchPositionId !== null) {
                                navigator.geolocation.clearWatch(watchPositionId);
                                watchPositionId = null;
                            }
                            locationError({
                                code: 1, // PERMISSION_DENIED
                                message: "Permission denied"
                            });
                        }
                    };
                })
                .catch(error => {
                    console.error("Error checking permission:", error);
                    startLocationTracking();
                });
        } else {
            // Permissions API not supported, fall back to direct watchPosition
            console.log("Permissions API not supported, using watchPosition directly");
            startLocationTracking();
        }
    } else {
        // error when browser can't gps
        Swal.fire({
            title: "GPS Not Supported",
            text: "Your browser doesn't support geolocation, which is required for this app to work.",
            icon: "error",
            confirmButtonText: "Okay",
            confirmButtonColor: "#3085d6"
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

    startButton.addEventListener('click', function() 
    {
        timerVar = setInterval(countTimer, 1000);
        isRunning = true;
        currentPolyline = L.polyline([], {color: 'black'}).addTo(polylineGroup);
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
        finishButton.classList.remove('hidden');
        continueButton.classList.remove('hidden');
        pauseButton.classList.add('hidden');
    });

    finishButton.addEventListener('click', function() 
    {
        clearInterval(timerVar);
        isRunning = false;
        previousLat = null;
        previousLng = null;
        totalDistance = 0;
        previousTime = null;
        currentPolyline = null;
        finishButton.classList.add('hidden');
        continueButton.classList.add('hidden');
        startButton.classList.remove('hidden');
        totalSeconds = 0;
        polylineGroup.clearLayers();
        document.getElementById("pace").innerHTML = "--:--/km";
        document.getElementById("distance").innerHTML = "0.00km";
        document.getElementById("timer").innerHTML = "00:00:00";
        historyButton.classList.remove('hidden');
        settingsButton.classList.remove('hidden');
    });

    continueButton.addEventListener('click', function() 
    {
        timerVar = setInterval(countTimer, 1000);
        isRunning = true;
        currentPolyline = L.polyline([], {color: 'black'}).addTo(polylineGroup);
        finishButton.classList.add('hidden');
        continueButton.classList.add('hidden');
        pauseButton.classList.remove('hidden');
    });

    // https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
    function distance(lat1, lon1, lat2, lon2) {
        const r = 6371; // km
        const p = Math.PI / 180;
      
        const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2
                      + Math.cos(lat1 * p) * Math.cos(lat2 * p) *
                        (1 - Math.cos((lon2 - lon1) * p)) / 2;
      
        return 2 * r * Math.asin(Math.sqrt(a));
    }

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
            confirmButtonColor: "#3085d6"
        });
    });
});