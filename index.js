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
    let paceHistory = [];
    let avgPace = null;
    
    // updating user location and line showing movement
    function updateLocation(position) {

        let newLat = position.coords.latitude;
        let newLng = position.coords.longitude;
        let currentTime = new Date().getTime();
        let speed = position.coords.speed;
      
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

            if (speed !== null && speed !== undefined) 
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
                if (paceHistory.length > 12) 
                {
                    paceHistory.shift();
                }
                
                let avgPace = paceHistory.reduce((a, b) => a + b, 0) / paceHistory.length;
                if (avgPace > 0) 
                {
                    document.getElementById("pace").innerHTML = getMinAndSec(avgPace) + "/km";
                } 
                else if(avgPace==0)
                {
                    document.getElementById("pace").innerHTML = "∞/km";
                }
            }
            else
            {
                document.getElementById("pace").innerHTML = "speed aint work";
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
                if(distanceBetweenCoords > 0.0003)
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

    function locationError(error) 
    {
        console.error("Error finding location", error);
    }
    
    // https://www.programmingbasic.com/convert-seconds-to-minutes-and-seconds-javascript
    function getMinAndSec(seconds){
        seconds = Math.round(seconds);
        const min = Math.floor(seconds/60);
        const secs = seconds % 60;
        return min.toString().padStart(2, '0')+":"+secs.toString().padStart(2, '0');
    }

    // get user location
    if (navigator.geolocation) 
    {
        navigator.geolocation.watchPosition(updateLocation, locationError, {
        enableHighAccuracy: true,
        timeout: 1500;
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
            currentPolyline = L.polyline([], {color: 'blue', smoothFactor: 1.3}).addTo(map);

            // might need to add current coords here because it seems to start after you press start, not when

            document.getElementById("pace").innerHTML = "--:--/km";
        } 
        else 
        {
            startBtn.textContent = 'Start';
            startBtn.style.background = "#4CAF50";
            clearInterval(timerVar);
            isRunning = false;
            // end the current polyline
            currentPolyline = null;
            document.getElementById("pace").innerHTML = "--:--/km";
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
