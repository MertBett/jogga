document.addEventListener('DOMContentLoaded', function() {

    const runListContainer = document.getElementById('run-list-container');
    const noRunsMessage = document.getElementById('no-runs-message');
    const runDetailModal = document.getElementById('run-detail-modal');

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
        
        // Now load the run history
        loadRunHistory(db);
    };
}

initDB();
    
    // Load all runs from the database
    function loadRunHistory(db) {
        const txn = db.transaction('runs', 'readonly');
        const store = txn.objectStore('runs');
        const runs = [];
        
        // Use a cursor to get all runs
        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // Add this run to our array (with its ID)
                let run = cursor.value;
                run.id = cursor.key;
                runs.push(run);
                
                // Move to next run
                cursor.continue();
            } else {
                // No more runs - now display them
                displayRuns(runs);
            }
        };
        
        // Handle any errors
        txn.onerror = (event) => {
            console.error("Error loading runs:", event.target.error);
            showErrorMessage("Failed to load run history");
        };
    }
    
    // Show error message
    function showErrorMessage(message) {
        Swal.fire({
            title: 'Error',
            text: message,
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#007700'
        });
    }
});