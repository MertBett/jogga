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
            // this should prob just be an error
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
            console.error('Database error:', event.target.error);
        };

        // handle the success event
        request.onsuccess = (event) => {
            db = event.target.result;

            // load the db
            loadRunHistory(db);
        
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
        
        txn.onerror = (event) => {
            Swal.fire({
                title: 'Error',
                text: "Failed to load run history",
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#007700'
            });
        };
    }
    
    // make buttons in modal work
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
                if (result.isConfirmed) 
                {
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
            Swal.fire({
                title: 'Error',
                text: "Failed to delete run",
                icon: 'error',
                confirmButtonText: 'OK',
                confirmButtonColor: '#007700'
            });
        };
    }
    
    // show runs in db
    function displayRuns(runs) 
    {
        if (runs.length == 0) 
        {
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
            detailMap.eachLayer(function(layer) {
                if (!(layer instanceof L.TileLayer)) {
                    detailMap.removeLayer(layer);
                }
            });
        }
        
        // keep track of the bounds so we can focus the map when its done
        const bounds = L.latLngBounds();
            
        // add each polyline to the map
        run.polylines.forEach(function(coords) {
                const polyline = L.polyline(coords, {
                    color: 'blue',
                    weight: 3
                }).addTo(detailMap);
                
                // add the polyline to the bounds 
                coords.forEach(function(coord) {
                    bounds.extend(coord);
                });
        });
            
        // resizes the map to fit polylines
        setTimeout(function() 
        {
            detailMap.invalidateSize();
            detailMap.fitBounds(bounds);
        }, 100);
    }
    
    function calculatePace(durationSeconds, distance) 
    {
        const paceInSeconds = durationSeconds / distance;
        return formatDuration(paceInSeconds, true);
    }
    
    // https://stackoverflow.com/questions/3552461/how-do-i-format-a-date-in-javascript
    function formatDate(date, includeTime = false) 
    {
        
        if(includeTime == false)
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
        if (asPace) 
        {
            totalSeconds = Math.round(totalSeconds);
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
});