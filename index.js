document.addEventListener("DOMContentLoaded", function () {

    const map = new L.map('map', { zoomControl: false, attributionControl: true });
    
    // add open street map tile from https://leafletjs.com/index.html
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.attributionControl.setPosition('topleft');
    
    let marker;
    /* this puts a blue dot immediately, might be better making it transparent and then become blue when is running? */
    const polyline = L.polyline([], {color: 'blue'}).addTo(map);
    let newVisit = true;
    
    // updating user location and line showing movement
    function updateLocation(position) {
        let lat = position.coords.latitude;
        let lng = position.coords.longitude;
        
        if (!marker) {
            marker = L.marker([lat, lng]).addTo(map);
        } else {
            marker.setLatLng([lat, lng]);
        }

        // don't want it snapping you back to your position all the time because then you can't move the map around and plan where you're going
        // so only do it when you initially enter the page.
        // possibly add a button to snap you back so if you scroll too far and get lost you can get moved back
        if (newVisit) {
            map.setView([lat, lng], 19);
            newVisit = false;
        }

        if(isRunning = true)
        {
            polyline.addLatLng([lat, lng]);
        }
    }
    
    function locationError(error) {
        console.error("Error finding location", error);
    }
    
    // get user location
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateLocation, locationError, {
            enableHighAccuracy: true,
            timeout: 1500,
            maximumAge: 0
        });
    } else {
        alert("Geolocation is not supported :( try jogga another time");
    }
});

const startBtn = document.getElementById('start-button');
let isRunning = false;

startBtn.addEventListener('click', function handleClick() {
    if(startBtn.textContent == "Start")
    {
        startBtn.textContent = 'Stop';
        startBtn.style.background = "red";
        timerVar = setInterval(countTimer, 1000);
        isRunning = true;
    }
    else
    {
        startBtn.textContent = 'Start';
        startBtn.style.background = "#4CAF50";
        clearInterval(timerVar);
    }
});

// https://stackoverflow.com/questions/5517597/plain-count-up-timer-in-javascript
let totalSeconds = 0;
function countTimer() {
    ++totalSeconds;
    
    let hour = Math.floor(totalSeconds / 3600);
    let minute = Math.floor((totalSeconds - hour * 3600) / 60);
    let seconds = totalSeconds - (hour * 3600 + minute * 60);
    if (hour < 10)
        hour = "0" + hour;
    if (minute < 10)
        minute = "0" + minute;
    if (seconds < 10)
        seconds = "0" + seconds;

    document.getElementById("timer").innerHTML = hour + ":" + minute + ":" + seconds;
}