document.addEventListener('DOMContentLoaded', function() {
    const dataUseButton = document.getElementById('dataUse-button');
    
    dataUseButton.addEventListener('click', function() {
        Swal.fire({
            title: 'Location Data Usage',
            html: `
                <div style="text-align: left; margin-top: 10px;">
                    <p>Jogga only uses your location information to track your runs in real-time. Your location data is:</p>
                    <ul style="padding-left: 20px;">
                        <li>Only collected when you actively start a run</li>
                        <li>Stored locally on your device only</li>
                    </ul>
                    <p>If you prefer not to share location data, you can disable location services in your browser settings. However, this will mean you cannot track your runs with Jogga.</p>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Okay',
            confirmButtonColor: '#007700'
        });
    });
});