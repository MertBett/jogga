document.addEventListener("DOMContentLoaded", function () {

    // Create the map and set initial view
    var map = L.map('map').setView([56.462, -2.9707], 19);
    
    // add open street map tile from https://leafletjs.com/index.html
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    var marker;
    
    // Function to update user location
    function updateLocation(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        
        if (!marker) {
            marker = L.marker([lat, lng]).addTo(map);
        } else {
            marker.setLatLng([lat, lng]);
        }
        
        map.setView([lat, lng], 19);
    }
    
    // Handle location errors
    function locationError(error) {
        console.error("Error obtaining location", error);
    }
    
    // get user location
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateLocation, locationError, {
            enableHighAccuracy: true
        });
    } else {
        alert("Geolocation is not supported by your browser");
    }

    setInterval(updateLocation, 2000);
});
