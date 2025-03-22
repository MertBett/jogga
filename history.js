document.addEventListener('DOMContentLoaded', function() {

    const runListContainer = document.getElementById('run-list-container');
    const noRunsMessage = document.getElementById('no-runs-message');
    const runDetailModal = document.getElementById('run-detail-modal');
    const closeModalButton = document.getElementById('close-modal');
    const deleteRunButton = document.getElementById('delete-run');
    
    let currentRunId = null;
    let detailMap = null;

    let db;

    // https://www.javascripttutorial.net/web-apis/javascript-indexeddb/ took the db from here and changed for my use case
    // same for all db stuff
    // initialise db
    function initDB() {
        // check for IndexedDB support
        if (!window.indexedDB) {
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
            
                console.log('Runs object store created');
            }
        };

        // handle the error event
        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };

        // handle the success event
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully');

            // load the db
            loadRunHistory(db);

            // Add a dummy run for testing
            addDummyRun(db);
        
            // activate the buttons in the modlas
            setupEventHandlers(db);
        };
    }

    initDB();
    
    // https://www.javascripttutorial.net/web-apis/javascript-indexeddb/ again
    // load all runs from the database
    function loadRunHistory(db) {
        const txn = db.transaction('runs', 'readonly');
        const store = txn.objectStore('runs');
        const runs = [];
        
        
        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                let run = cursor.value;
                run.id = cursor.key;
                runs.push(run);
                cursor.continue();
            } else {
                displayRuns(runs);
            }
        };
        
        // Handle any errors
        txn.onerror = (event) => {
            console.error("Error loading runs:", event.target.error);
            showErrorMessage("Failed to load run history");
        };
    }
    
    // Setup UI event handlers
    function setupEventHandlers(db) {
        // make close modal button work
        closeModalButton.addEventListener('click', function() {
            runDetailModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            currentRunId = null;
        });
        
        // make delete run button work
        deleteRunButton.addEventListener('click', function() {
            Swal.fire({
                title: 'Delete Run',
                text: 'Are you sure you want to delete this run? This action cannot be undone.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#007700',
                cancelButtonColor: '#ee0505',
                confirmButtonText: 'Yes'
            }).then((result) => {
                if (result.isConfirmed) {
                    // delete the run
                    deleteRun(db, currentRunId);
                }
            });
        });
    }
    
    // delete a given run
    function deleteRun(db, id) {
        const txn = db.transaction('runs', 'readwrite');
        const store = txn.objectStore('runs');
        
        const request = store.delete(id);
        
        request.onsuccess = (event) => {
            console.log("Run deleted successfully");
            Swal.fire(
                'Deleted!',
                'Your run has been deleted.',
                'success'
            );
            runDetailModal.classList.add('hidden');
            currentRunId = null;
            
            // reload the db because it's one smaller now
            loadRunHistory(db);
        };
        
        request.onerror = (event) => {
            console.error("Error deleting run:", event.target.error);
            showErrorMessage("Failed to delete run");
        };
    }
    
    // show runs in db
    function displayRuns(runs) 
    {
        if (runs.length == 0) {
            // no runs so show the no runs message
            noRunsMessage.classList.remove('hidden');
            runListContainer.classList.add('hidden');
            return;
        }
        
        // is runs so show the euns
        noRunsMessage.classList.add('hidden');
        runListContainer.classList.remove('hidden');

        // sort them by newest first
        runs.sort((a, b) => new Date(b.date) - new Date(a.date));
        runListContainer.innerHTML = '';

        // make the cards for each run
        runs.forEach(run => {
            const runCard = createRunCard(run);
            runListContainer.appendChild(runCard);
        });
    }
    
    // dynamically make card for each run in db
    function createRunCard(run) 
    {
        const runDate = new Date(run.date);
        const formattedDate = formatDate(runDate);
        const formattedDuration = formatDuration(run.duration);
        const pace = calculatePace(run.duration, run.distance);
        
        const card = document.createElement('div');
        card.className = 'run-card';
        card.dataset.runId = run.id;
        
        card.innerHTML = `
            <div class="run-card-left">
                <div class="run-date">${formattedDate}</div>
                <div class="run-distance">${run.distance} km</div>
            </div>
            <div class="run-card-right">
                <div class="run-duration">${formattedDuration}</div>
                <div class="run-pace">${pace}/km</div>
            </div>
        `;
        
        // make click on run work
        card.addEventListener('click', function() {
            currentRunId = run.id;
            document.body.style.overflow = 'hidden';
            showRunDetails(run);
        });
        
        return card;
    }
    
    // display the run info in the run modal
    function showRunDetails(run) 
    {
        const runDate = new Date(run.date);
        document.getElementById('detail-date').textContent = formatDate(runDate, true);
        document.getElementById('detail-distance').textContent = `${run.distance} km`;
        document.getElementById('detail-duration').textContent = formatDuration(run.duration);
        document.getElementById('detail-pace').textContent = `${calculatePace(run.duration, run.distance)}/km`;
        
        runDetailModal.classList.remove('hidden');
        
        // make the map
        if (!detailMap) 
        {
            console.log("Creating new map");
            detailMap = L.map('detail-map', { 
                zoomControl: false,
                attributionControl: true 
            });
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(detailMap);
        } 
        else 
        {
            // reset the map because it already exists
            console.log("Clearing existing map layers");
            detailMap.eachLayer(function(layer) {
                if (!(layer instanceof L.TileLayer)) {
                    detailMap.removeLayer(layer);
                }
            });
        }
        
        // Create a bounds object to track the area covered by all polylines
        const bounds = L.latLngBounds();
            
        // Add each polyline segment to the map
        run.polylines.forEach(function(coords) {
                // Create polyline for this segment
                const polyline = L.polyline(coords, {
                    color: 'black',
                    weight: 3
                }).addTo(detailMap);
                
                // Extend bounds to include all points in this polyline
                coords.forEach(function(coord) {
                    bounds.extend(coord);
                });
        });
            
        // Use fitBounds to automatically adjust the view
        detailMap.fitBounds(bounds, {
            padding: [30, 30]
        });
                
        // map needs to wait before modal loads before displaying properly
        setTimeout(function() {
            detailMap.invalidateSize();
        }, 500);
    }
    
    function calculatePace(durationSeconds, distanceKm) 
    {
        const paceInSeconds = durationSeconds / distanceKm;
        return formatDuration(paceInSeconds, true);
    }
    
    // https://stackoverflow.com/questions/3552461/how-do-i-format-a-date-in-javascript
    function formatDate(date, includeTime = false) 
    {
        
        if(includeTime = false)
        {
            var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return result = date.toLocaleDateString("en-GB", options);
        }
        else
        {
            return date.toLocaleString("en-GB", { timeZone: "UTC" });
        }
    }
    
    function formatDuration(totalSeconds, asPace = false) 
    {
        // https://www.programmingbasic.com/convert-seconds-to-minutes-and-seconds-javascript
        // for mins and secs (pace)
        if (asPace) {
            const min = Math.floor(totalSeconds/60);
            const secs = totalSeconds % 60;
            return min.toString().padStart(2, '0')+":"+secs.toString().padStart(2, '0');
        } 
        else 
        {
            // https://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript
            // for hours mins and secs (duration)
            let hours = Math.floor(totalSeconds / 3600);
            totalSeconds %= 3600;
            let minutes = Math.floor(totalSeconds / 60);
            let seconds = totalSeconds % 60;
            // If you want strings with leading zeroes:
            minutes = String(minutes).padStart(2, "0");
            hours = String(hours).padStart(2, "0");
            seconds = String(seconds).padStart(2, "0");
            return hours + ":" + minutes + ":" + seconds;
        }
    }
    
    function showErrorMessage(message) 
    {
        Swal.fire({
            title: 'Error',
            text: message,
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#007700'
        });
    }

    // Add a dummy run for testing purposes
function addDummyRun(db) {
    // Check if we already have runs first
    const txnCheck = db.transaction('runs', 'readonly');
    const storeCheck = txnCheck.objectStore('runs');
    let hasRuns = false;
    
    storeCheck.count().onsuccess = function(event) {
        // Only add dummy run if no runs exist
        if (event.target.result === 0) {
            console.log("No runs found. Adding dummy run for testing.");
            
            // Create a new transaction for writing
            const txn = db.transaction('runs', 'readwrite');
            const store = txn.objectStore('runs');
            
            // Create dummy polyline data - a small loop route
            const dummyPolylines = [
                [
                    [51.505, -0.09], // Starting point (example: London area)
                    [51.506, -0.095],
                    [51.508, -0.1],
                    [51.507, -0.105],
                    [51.505, -0.09]  // Back to start
                ]
            ];
            
            // Format the run data
            const dummyRun = {
                date: new Date(Date.now() - 86400000), // Yesterday
                duration: 1200, // 20 minutes in seconds
                distance: 2.5,  // 2.5 km
                polylines: dummyPolylines
            };
            
            // Add to database
            const request = store.add(dummyRun);
            
            request.onsuccess = function(event) {
                console.log("Dummy run added with ID:", event.target.result);
            };
            
            request.onerror = function(event) {
                console.error("Error adding dummy run:", event.target.error);
            };
        } else {
            console.log("Runs already exist. Not adding dummy run.");
        }
    };
}
       
});