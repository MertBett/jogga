document.addEventListener("DOMContentLoaded", function () {

    const map = new L.map('map', { zoomControl: false, attributionControl: true });

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
    
    // updating user location and line showing movement
    function updateLocation(position) {

        let newLat = position.coords.latitude;
        let newLng = position.coords.longitude;
      
        if (!marker) 
        {
            marker = L.marker([newLat, newLng]).addTo(map);
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
            if(previousLat && previousLng)
            {
                let distanceBetweenCoords = distance(previousLat,previousLong, lat, lng);
                totalDistance+=distanceBetweenCoords;
                document.getElementById("distance").innerHTML = `Distance: ${totalDistance.toFixed(2)} km`;
            }
            previousLat = newLat;
            previousLng = newLng;
        }
    }

    function locationError(error) 
    {
        console.error("Error finding location", error);
    }
    
    // get user location
    if (navigator.geolocation) 
    {
        navigator.geolocation.watchPosition(updateLocation, locationError, {
        enableHighAccuracy: true,
        timeout: 1000,
        maximumAge: 0
        });
    } 
    else 
    {
      alert("Geolocation is not supported by your browser(?)");
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
    
    // Handle start/stop button
    const startBtn = document.getElementById('start-button');

    startBtn.addEventListener('click', function handleClick() {
        if (!isRunning) 
        {
            // Start tracking
            startBtn.textContent = 'Stop';
            startBtn.style.background = "red";
            timerVar = setInterval(countTimer, 1000);
            isRunning = true;
            // make current polyline a new polyline
            currentPolyline = L.polyline([], {color: 'blue', smoothFactor: 1.5}).addTo(map);
        } 
        else 
        {
            startBtn.textContent = 'Start';
            startBtn.style.background = "#4CAF50";
            clearInterval(timerVar);
            isRunning = false;
            // end the current polyline
            currentPolyline = null;
        }
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

});