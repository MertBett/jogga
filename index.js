document.addEventListener("DOMContentLoaded", function () {

    // Create the map and set initial view
    var map = L.map('map');
    
    // add open street map tile from https://leafletjs.com/index.html
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    var marker;
    var polyline = L.polyline([], {color: 'blue'}).addTo(map);
    
    // updating user location and line showing movement
    function updateLocation(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        
        if (!marker) {
            marker = L.marker([lat, lng]).addTo(map);
        } else {
            marker.setLatLng([lat, lng]);
        }
        

        //map.setView([lat, lng], 19);
        polyline.addLatLng([lat, lng]);
    }
    
    // Handle location errors
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
        alert("Geolocation is not supported by your browser :( try jogga another time");
    }
});
