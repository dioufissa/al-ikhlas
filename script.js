// Constants
const SMOOTHING_FACTOR = 0.15;

// DOM Elements
const cityNameEl = document.getElementById('cityName');
const accuracyIndicatorEl = document.getElementById('accuracyIndicator');
const prayerTimesEl = document.getElementById('prayerTimes');
const statusMessageEl = document.getElementById('statusMessage');
const refreshBtn = document.getElementById('refreshBtn');
const weeklyPrayerTimesEl = document.getElementById('weeklyPrayerTimes');
const islamicEventsEl = document.getElementById('islamicEvents'); 

// State variables
let prayerTimings = {};
let prayerCheckInterval = null;
let weeklyPrayerData = [];
let currentPosition = null;

// Initialize the app
function init() {
    setupCollapsibles();
    
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser");
        return;
    }
    
    refreshBtn.addEventListener('click', refreshLocation);
    refreshLocation();
    
    displayIslamicEvents();
}

function setupCollapsibles() {
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const icon = this.querySelector('.collapse-icon');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                icon.textContent = '+';
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                icon.textContent = '-';
            }
            
            // Close other collapsibles
            document.querySelectorAll('.collapsible-content').forEach(otherContent => {
                if (otherContent !== content && otherContent.style.maxHeight) {
                    otherContent.style.maxHeight = null;
                    otherContent.previousElementSibling.querySelector('.collapse-icon').textContent = '+';
                }
            });
        });
    });
}

function updateLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    currentPosition = { latitude, longitude };
    
    cityNameEl.textContent = "Locating...";
    accuracyIndicatorEl.textContent = `Accuracy: ±${Math.round(accuracy)} meters`;
    
    reverseGeocode(latitude, longitude);
    fetchPrayerTimes(latitude, longitude);
    fetchWeeklyPrayerTimes(latitude, longitude);
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

async function fetchPrayerTimes(latitude, longitude) {
    const date = new Date();
    const formattedDate = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
    
    try {
        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${latitude}&longitude=${longitude}&method=2`,
            { signal: AbortSignal.timeout(10000) }
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
        showError("Couldn't fetch prayer times. Please check your internet connection or try again later.");
        displayPrayerTimes({
            Fajr: "N/A",
            Sunrise: "N/A",
            Dhuhr: "N/A",
            Asr: "N/A",
            Maghrib: "N/A",
            Isha: "N/A"
        });
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

async function fetchWeeklyPrayerTimes(latitude, longitude) {
    try {
        const today = new Date();
        weeklyPrayerData = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(today.getDate() + i);
            const formattedDate = `${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
            
            const response = await fetch(
                `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${latitude}&longitude=${longitude}&method=2`,
                { signal: AbortSignal.timeout(10000) }
            );
            
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            
            const data = await response.json();
            
            if (data.code === 200 && data.data?.timings) {
                const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
                const dateStr = new Intl.DateTimeFormat('en-US', { 
                    day: 'numeric', 
                    month: 'short'
                }).format(date);
                
                weeklyPrayerData.push({
                    day: dayName,
                    date: dateStr,
                    timings: data.data.timings
                });
            } else {
                throw new Error("Invalid prayer times data");
            }
        }
        
        displayWeeklyPrayerTimes();
    } catch (error) {
        console.error("Weekly prayer times error:", error);
        showError("Couldn't fetch weekly prayer times. Please check your internet connection or try again later.");
        weeklyPrayerTimesEl.innerHTML = '<div class="prayer-time">Weekly times unavailable</div>';
    }
}

function displayWeeklyPrayerTimes() {
    if (!weeklyPrayerData || weeklyPrayerData.length === 0) {
        weeklyPrayerTimesEl.innerHTML = '<div class="prayer-time">Weekly times unavailable</div>';
        updateCollapsibleHeight(weeklyPrayerTimesEl);
        return;
    }
    
    let html = '';
    
    weeklyPrayerData.forEach((dayData, index) => {
        const isToday = index === 0;
        const todayClass = isToday ? 'today' : '';
        
        html += `
            <div class="weekly-prayer-day ${todayClass}">
                <div class="day-header">
                    <div class="day-name">${dayData.day}</div>
                    <div class="day-date">${dayData.date}</div>
                </div>
                <div class="day-prayers">
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Fajr</span>
                        <span class="prayer-value">${dayData.timings.Fajr}</span>
                    </div>
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Sunrise</span>
                        <span class="prayer-value">${dayData.timings.Sunrise}</span>
                    </div>
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Dhuhr</span>
                        <span class="prayer-value">${dayData.timings.Dhuhr}</span>
                    </div>
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Asr</span>
                        <span class="prayer-value">${dayData.timings.Asr}</span>
                    </div>
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Maghrib</span>
                        <span class="prayer-value">${dayData.timings.Maghrib}</span>
                    </div>
                    <div class="prayer-time-weekly">
                        <span class="prayer-name">Isha</span>
                        <span class="prayer-value">${dayData.timings.Isha}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    weeklyPrayerTimesEl.innerHTML = html;
    updateCollapsibleHeight(weeklyPrayerTimesEl);
}

function displayIslamicEvents() {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    const events = getIslamicEvents(currentYear, nextYear);
    
    // Filter to show only the next occurrence of each event
    const uniqueEvents = [];
    const seenEvents = new Set();
    
    events.forEach(event => {
        if (!seenEvents.has(event.name)) {
            seenEvents.add(event.name);
            uniqueEvents.push(event);
        }
    });
    
    uniqueEvents.sort((a, b) => {
        const aDate = new Date(a.sortDate);
        const bDate = new Date(b.sortDate);
        return aDate - bDate;
    });
    
    console.log("Islamic Events:", uniqueEvents); // Debug log to verify events
    
    let html = '<div class="disclaimer">Note: Dates are approximate. Please confirm with local authorities or news for accurate Islamic event dates.</div>';
    
    if (uniqueEvents.length === 0) {
        html += '<div class="islamic-event">No upcoming events available</div>';
    } else {
        uniqueEvents.forEach(event => {
            html += `
                <div class="islamic-event">
                    <div class="event-name">${event.name}</div>
                    <div class="event-date">${event.date} ${event.year}</div>
                    <div class="event-desc">${event.description}</div>
                </div>
            `;
        });
    }
    
    islamicEventsEl.innerHTML = html;
    updateCollapsibleHeight(islamicEventsEl);
}

function updateCollapsibleHeight(element) {
    const section = element.closest('.collapsible-content');
    if (section) {
        // Force reflow to ensure correct scrollHeight
        void section.offsetHeight; // Trigger reflow
        if (section.previousElementSibling.querySelector('.collapse-icon').textContent === '-') {
            section.style.maxHeight = section.scrollHeight + "px";
        }
    }
}

function getIslamicEvents(startYear, endYear) {
    const events = [];
    const currentDate = new Date();
    
    const eventTemplates = [
        {
            name: "Ramadan",
            approximateStart: { month: 2, day: 1 }, // March 1
            duration: "1 Month",
            description: "Month of fasting, prayer, reflection and community"
        },
        {
            name: "Eid al-Fitr",
            approximateStart: { month: 2, day: 31 }, // March 31
            duration: "1-2 Days",
            description: "Festival of Breaking the Fast, marks the end of Ramadan"
        },
        {
            name: "Hajj",
            approximateStart: { month: 5, day: 5 }, // June 5
            duration: "5-6 Days",
            description: "Annual Islamic pilgrimage to Mecca"
        },
        {
            name: "Eid al-Adha",
            approximateStart: { month: 5, day: 10 }, // June 10
            duration: "3-4 Days",
            description: "Festival of Sacrifice, marks the end of Hajj"
        },
        {
            name: "Islamic New Year",
            approximateStart: { month: 5, day: 28 }, // June 28
            duration: "1 Day",
            description: "First day of Muharram, the first month in the Islamic calendar"
        },
        {
            name: "Ashura",
            approximateStart: { month: 6, day: 7 }, // July 7
            duration: "1 Day",
            description: "10th day of Muharram, a day of fasting for many Muslims"
        },
        {
            name: "Mawlid al-Nabi",
            approximateStart: { month: 8, day: 5 }, // September 5
            duration: "1 Day",
            description: "Observance of the birthday of Islamic prophet Muhammad"
        }
    ];
    
    // Include the next occurrence of each event
    eventTemplates.forEach(event => {
        let eventDate;
        let year = startYear;
        
        // Try current year
        eventDate = new Date(year, event.approximateStart.month, event.approximateStart.day);
        if (eventDate < currentDate) {
            // If past, try next year
            year = endYear;
            eventDate = new Date(year, event.approximateStart.month, event.approximateStart.day);
        }
        
        const dateStr = new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short'
        }).format(eventDate);
        
        events.push({
            name: event.name,
            date: dateStr,
            year: year,
            sortDate: eventDate,
            description: event.description
        });
    });
    
    return events;
}

function startPrayerTimeChecker() {
    if (prayerCheckInterval) {
        clearInterval(prayerCheckInterval);
    }
    
    prayerCheckInterval = setInterval(checkForPrayerTime, 60000);
    checkForPrayerTime();
}

function checkForPrayerTime() {
    const now = new Date();
    const currentTime = formatTime(now);
    
    for (const prayer in prayerTimings) {
        if (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(prayer)) {
            const prayerTime = prayerTimings[prayer];
            
            if (timesMatch(currentTime, prayerTime) && prayerTime !== "N/A") {
                showPrayerNotification(prayer, prayerTime);
                return;
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

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

window.addEventListener('beforeunload', () => {
    if (prayerCheckInterval) clearInterval(prayerCheckInterval);
});

window.addEventListener('load', init);
window.addEventListener('load', requestNotificationPermission);