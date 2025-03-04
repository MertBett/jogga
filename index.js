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
    let previousTime = null;
    
    // updating user location and line showing movement
    function updateLocation(position) {

        let newLat = position.coords.latitude;
        let newLng = position.coords.longitude;
        let currentTime = new Date().getTime();
      
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
            if(previousTime == null)
            {
                previousTime = currentTime;
            }
            if(previousLat && previousLng)
            {
                let distanceBetweenCoords = distance(previousLat,previousLng, newLat, newLng);
                totalDistance+=distanceBetweenCoords;
                let timeElapsed = (currentTime - previousTime)/1000 // time is in milliseconds so convert to seconds
                if(distanceBetweenCoords > 0.0001)
                {
                    let pace = timeElapsed / (60 * distanceBetweenCoords) // mins per km so *60
                }
                // case where person hasn't moved so doesnt divide by zero above
                else
                {
                    let pace = 0;
                }
                document.getElementById("distance").innerHTML = totalDistance.toFixed(2) + "km"
                document.getElementById("pace").innerHTML = getMinAndSec(pace) + "/km"
            }
            previousLat = newLat;
            previousLng = newLng;
            previousTime = currentTime;
        }
    }

    function locationError(error) 
    {
        console.error("Error finding location", error);
    }
    
    // https://www.programmingbasic.com/convert-seconds-to-minutes-and-seconds-javascript
    function getMinAndSec(seconds){
        const min = Math.floor(seconds / 60);
        const secs = seconds%60;
        return min.toString().padStart(2, '0')+":"+secs.toString().padStart(2, '0');
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
    
    // start/stop button
    const startBtn = document.getElementById('start-button');

    startBtn.addEventListener('click', function handleClick() {
        if (!isRunning) 
        {
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