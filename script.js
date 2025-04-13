// Constants
const KAABA_LAT = 21.422487;
const KAABA_LON = 39.826206;
const SMOOTHING_FACTOR = 0.15;

// DOM Elements
const compassCanvas = document.getElementById('compassCanvas');
const ctx = compassCanvas.getContext('2d');
const cityNameEl = document.getElementById('cityName');
const accuracyIndicatorEl = document.getElementById('accuracyIndicator');
const directionArrow = document.getElementById('directionArrow');
const turnInstruction = document.getElementById('turnInstruction');
const qiblaAngle = document.getElementById('qiblaAngle');
const prayerTimesEl = document.getElementById('prayerTimes');
const statusMessageEl = document.getElementById('statusMessage');
const refreshBtn = document.getElementById('refreshBtn');
const compassPermissionBtn = document.getElementById('compassPermissionBtn');

// State variables
let currentHeading = 0;
let qiblaDirection = 0;
let lastHeading = null;
let watchId = null;
let orientationId = null;
let animationFrameId = null;
let compassPermissionGranted = false;
let prayerTimings = {};
let prayerCheckInterval = null;

// Initialize the app
function init() {
    setupCanvas();
    
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser");
        return;
    }
    
    if (window.DeviceOrientationEvent) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            compassPermissionBtn.style.display = 'block';
            compassPermissionBtn.addEventListener('click', requestCompassPermission);
        } else {
            startCompass();
        }
    } else {
        showError("Device orientation not supported - compass won't work");
    }
    
    refreshBtn.addEventListener('click', refreshLocation);
    refreshLocation();
    animateCompass();
}

function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = compassCanvas.getBoundingClientRect();
    
    compassCanvas.width = rect.width * dpr;
    compassCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}

function requestCompassPermission() {
    DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === 'granted') {
                compassPermissionGranted = true;
                compassPermissionBtn.style.display = 'none';
                startCompass();
            } else {
                showError("Compass requires orientation permission");
            }
        })
        .catch(error => {
            console.error("Compass permission error:", error);
            showError("Failed to get compass permission");
        });
}

function startCompass() {
    if (orientationId) {
        window.removeEventListener('deviceorientation', handleOrientation);
    }
    
    window.addEventListener('deviceorientation', handleOrientation);
    orientationId = true;
}

function handleOrientation(event) {
    if (event.alpha !== null) {
        let newHeading = event.alpha;
        
        if (event.webkitCompassHeading !== undefined) {
            newHeading = event.webkitCompassHeading;
        }
        
        if (lastHeading === null) {
            currentHeading = newHeading;
        } else {
            currentHeading = lastHeading + SMOOTHING_FACTOR * (newHeading - lastHeading);
        }
        lastHeading = newHeading;
    }
}

function animateCompass() {
    drawCompass();
    updateDirectionDisplay();
    animationFrameId = requestAnimationFrame(animateCompass);
}

function drawCompass() {
    const centerX = compassCanvas.width / (window.devicePixelRatio || 1) / 2;
    const centerY = compassCanvas.height / (window.devicePixelRatio || 1) / 2;
    const radius = Math.min(centerX, centerY) * 0.9;
    
    ctx.clearRect(0, 0, compassCanvas.width, compassCanvas.height);
    
    // Draw compass border with glow (outer only)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'var(--primary-color)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw Qibla emoji at the top
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'var(--primary-color)';
    ctx.fillText('🕋', centerX, centerY - radius * 0.8);
    
    // Draw Qibla direction arrow with improved visibility
    if (qiblaDirection) {
        const qiblaRad = (qiblaDirection - currentHeading) * Math.PI / 180;
        const arrowLength = radius * 0.7;
        const arrowEndX = centerX + Math.sin(qiblaRad) * arrowLength;
        const arrowEndY = centerY - Math.cos(qiblaRad) * arrowLength;
        
        // Arrow shaft with glow effect
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(arrowEndX, arrowEndY);
        ctx.strokeStyle = '#00ffcc'; // Brighter color
        ctx.shadowColor = 'rgba(0, 255, 204, 0.8)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 6; // Thicker line
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Reset shadow for other drawings
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Arrow head with improved visibility
        const headLength = 30; // Larger arrow head
        const headAngle = Math.PI / 4.5;
        ctx.beginPath();
        ctx.moveTo(arrowEndX, arrowEndY);
        ctx.lineTo(
            arrowEndX - headLength * Math.sin(qiblaRad - headAngle),
            arrowEndY + headLength * Math.cos(qiblaRad - headAngle)
        );
        ctx.lineTo(
            arrowEndX - headLength * Math.sin(qiblaRad + headAngle),
            arrowEndY + headLength * Math.cos(qiblaRad + headAngle)
        );
        ctx.closePath();
        ctx.fillStyle = '#00ffcc'; // Brighter color
        ctx.shadowColor = 'rgba(0, 255, 204, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
    
    // Draw subtle center point
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2); // Slightly larger center point
    ctx.fillStyle = 'var(--primary-color)';
    ctx.fill();
}

function updateDirectionDisplay() {
    if (!qiblaDirection) return;
    
    // Calculate the relative angle (0-360) from current heading to Qibla
    let relativeAngle = (qiblaDirection - currentHeading + 360) % 360;
    
    // Fix the left/right inversion by mirroring the angle
    relativeAngle = 360 - relativeAngle;
    
    const displayAngle = Math.round(relativeAngle);
    qiblaAngle.textContent = `${displayAngle}°`;
    
    // Update arrow direction
    directionArrow.style.transform = `rotate(${displayAngle}deg)`;
    
    // Determine turn direction
    if (displayAngle === 0 || displayAngle === 360) {
        turnInstruction.textContent = "Facing Qibla 🕋";
        turnInstruction.style.color = "var(--primary-color)";
    } else if (displayAngle > 180) {
        turnInstruction.textContent = "← Turn Left to Qibla";
        turnInstruction.style.color = "#ffffff";
    } else {
        turnInstruction.textContent = "Turn Right to Qibla →";
        turnInstruction.style.color = "#ffffff";
    }
}

function updateLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Update location info separately
    cityNameEl.textContent = "Locating...";
    accuracyIndicatorEl.textContent = `Accuracy: ±${Math.round(accuracy)} meters`;
    
    reverseGeocode(latitude, longitude);
    calculateQiblaDirection(latitude, longitude);
    fetchPrayerTimes(latitude, longitude);
}

async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=12`
        );
        const data = await response.json();
        
        let locationName = "Current Location";
        if (data.address) {
            const address = data.address;
            locationName = address.city || address.town || address.village || 
                            address.county || address.state || address.country;
        }
        
        cityNameEl.textContent = locationName;
    } catch (error) {
        console.error("Geocoding error:", error);
        cityNameEl.textContent = "Current Location";
    }
}

function calculateQiblaDirection(latitude, longitude) {
    const latRad = latitude * Math.PI / 180;
    const lonRad = longitude * Math.PI / 180;
    const kaabaLatRad = KAABA_LAT * Math.PI / 180;
    const kaabaLonRad = KAABA_LON * Math.PI / 180;
    
    const y = Math.sin(kaabaLonRad - lonRad);
    const x = Math.cos(latRad) * Math.tan(kaabaLatRad) - 
                Math.sin(latRad) * Math.cos(kaabaLonRad - lonRad);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    if (bearing < 0) bearing += 360;
    
    qiblaDirection = bearing;
}

async function fetchPrayerTimes(latitude, longitude) {
    const date = new Date();
    const formattedDate = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
    
    try {
        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${latitude}&longitude=${longitude}&method=2`
        );
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        
        if (data.code === 200 && data.data?.timings) {
            prayerTimings = data.data.timings;
            displayPrayerTimes(prayerTimings);
            clearStatus();
            startPrayerTimeChecker();
        } else {
            throw new Error("Invalid prayer times data");
        }
    } catch (error) {
        console.error("Prayer times error:", error);
        showError("Couldn't fetch prayer times");
    }
}

function displayPrayerTimes(timings) {
    const prayers = [
        { name: "Fajr", time: timings.Fajr },
        { name: "Sunrise", time: timings.Sunrise },
        { name: "Dhuhr", time: timings.Dhuhr },
        { name: "Asr", time: timings.Asr },
        { name: "Maghrib", time: timings.Maghrib },
        { name: "Isha", time: timings.Isha }
    ];
    
    let html = '';
    prayers.forEach(prayer => {
        html += `
            <div class="prayer-time">
                <span class="prayer-name">${prayer.name}</span>
                <span class="prayer-value">${prayer.time}</span>
            </div>
        `;
    });
    
    prayerTimesEl.innerHTML = html;
}

function startPrayerTimeChecker() {
    // Clear any existing interval
    if (prayerCheckInterval) {
        clearInterval(prayerCheckInterval);
    }
    
    // Check every minute for prayer times
    prayerCheckInterval = setInterval(checkForPrayerTime, 60000);
    
    // Also check immediately
    checkForPrayerTime();
}

function checkForPrayerTime() {
    const now = new Date();
    const currentTime = formatTime(now);
    
    // Check each prayer time
    for (const prayer in prayerTimings) {
        if (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(prayer)) {
            const prayerTime = prayerTimings[prayer];
            
            // Check if current time matches prayer time (within 1 minute)
            if (timesMatch(currentTime, prayerTime)) {
                showPrayerNotification(prayer, prayerTime);
                return; // Only show one notification at a time
            }
        }
    }
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function timesMatch(time1, time2) {
    // Simple comparison of HH:MM strings
    return time1 === time2;
}

function showPrayerNotification(prayerName, prayerTime) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Time for ${prayerName}`, {
            body: `It's time to pray ${prayerName} (${prayerTime})`
        });
    }
}

function handlePositionError(error) {
    let message = "Error getting location: ";
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += "Permission denied. Please enable location services.";
            break;
        case error.POSITION_UNAVAILABLE:
            message += "Location unavailable.";
            break;
        case error.TIMEOUT:
            message += "Request timed out.";
            break;
        default:
            message += "Unknown error.";
    }
    showError(message);
}

function refreshLocation() {
    statusMessageEl.textContent = "Updating location...";
    navigator.geolocation.getCurrentPosition(
        updateLocation,
        handlePositionError,
        { enableHighAccuracy: true }
    );
}

function showError(message) {
    statusMessageEl.textContent = message;
}

function clearStatus() {
    statusMessageEl.textContent = "";
}

window.addEventListener('beforeunload', () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (orientationId) window.removeEventListener('deviceorientation', handleOrientation);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (prayerCheckInterval) clearInterval(prayerCheckInterval);
});

window.addEventListener('load', init);
