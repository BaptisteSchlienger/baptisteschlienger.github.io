
// --- Constants & State ---
const state = {
    tracks: [],
    venues: {},
    venueLocations: {}, // Map<VenueName, {lat, lon}>
    currentTrack: null,
    apiKey: localStorage.getItem('trackalign_api_key') || '',
    apiBase: 'http://127.0.0.1:5001/oversteer-34a98/us-central1',

    // UI State
    refWindowCollapsed: false,
    editingMode: null, // 'SF_LINE', 'PIT_ENTRY', 'PIT_EXIT', 'TRACE_PIT', 'TURN_POINT', 'ADD_CURB', 'EDIT_TRACK'
    activeTurnIndex: null, // If editing a turn
    activeCurbIndex: null, // If editing a curb
    highlightedCurbIndex: null, // Hover state
    pitLanePoints: [], // For TRACE_PIT

    // Geometry State
    trackWidth: 12, // meters
    pitWidth: 5, // meters

    // Interaction State
    draggingPitPointIndex: null,

    // Advanced Drag/Click Discrimination State
    potentialDragIndex: null,      // Index of point we clicked but haven't dragged far enough yet
    draggingTrackPointIndex: null, // Index of point we are ACTIVELY dragging
    dragStartPoint: null,          // {x, y} screen coordinates where mousedown happened
    isDragging: false,             // Flag to distinguish click vs drag

    selectedTrackPointIndex: null, // For advanced editing
    deleteRangeStart: null,        // For DELETE_RANGE mode
    trackHistory: [],
    originalTrackGeo: null, // For reset

    // Layers
    layers: {
        osm: null,
        trackWidth: null, // Visual width layer
        pitWidth: null,   // Visual pit width layer
        features: null,
        pitLane: null,
        trackPoints: null, // Editable points for EDIT_TRACK
        interaction: null // For ghost markers, active clicks
    }
};

const map = L.map('map', {
    center: [0, 0],
    zoom: 2,
    background: '#111'
});

// Create Custom Panes for Layer Ordering
map.createPane('trackPoints');
map.getPane('trackPoints').style.zIndex = 600;

// Base Layers
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19
});

satelliteLayer.addTo(map);

L.control.layers({ "Satellite": satelliteLayer, "Dark Mode": darkLayer }).addTo(map);


// --- Initialization ---

async function init() {
    try {
        // Load API Key from Settings
        const keyInput = document.getElementById('settings-api-key');
        if (keyInput) keyInput.value = state.apiKey;

        if (!state.apiKey) {
            alert("No API Key found. Please set it in Settings.");
            document.getElementById('settings-modal').classList.remove('hidden');
        } else {
            await fetchTrackList();
        }

        setupEventListeners();
        setupMapInteractions();
        setupKeyboardControls();
        setupImportListeners();
        setupCreationListeners();
        setupSettingsListeners();

    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

async function fetchTrackList() {
    if (!state.apiKey) return;
    try {
        const token = await generateJWT(state.apiKey);
        const res = await fetch(`${state.apiBase}/api-tracks-list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch tracks");

        const list = (await res.json()).data;
        console.log("API Track List Sample:", list[0]); // DEBUG
        // List format: { id, venue, layout_name } ?
        // Assuming list is array of lightweight track objects
        state.tracks = list;
        state.venues = {}; // Reset

        state.tracks.forEach(t => {
            const group = t.track_name || t.venue || 'Unknown';
            if (!state.venues[group]) state.venues[group] = [];
            state.venues[group].push(t);
        });

        populateVenueSelect();
        console.log(`Loaded ${state.tracks.length} tracks from API.`);

    } catch (e) {
        console.error("API Error", e);
        alert("Failed to fetch track list from API.");
    }
}

function populateVenueSelect(selectedGroup = null) {
    const sel = document.getElementById('venue-select');
    sel.innerHTML = '<option value="">Select Track Name...</option>';

    Object.keys(state.venues).sort().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = `${v} (${state.venues[v].length})`;
        if (v === selectedGroup) opt.selected = true;
        sel.appendChild(opt);
    });

    // Enable Create Venue button? Always enabled.
}

function updateTrackSelect(venue, selectedTrackId = null) {
    const sel = document.getElementById('track-select');
    sel.innerHTML = '<option value="">Select Track...</option>';
    sel.disabled = !venue;
    document.getElementById('btn-create-track').disabled = !venue; // Enable create track only if venue selected

    if (venue && state.venues[venue]) {
        state.venues[venue].forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.layout_name || t.id;
            if (t.id === selectedTrackId) opt.selected = true;
            sel.appendChild(opt);
        });
    }
}

function setupCreationListeners() {
    // Venue Creation
    const venueModal = document.getElementById('create-venue-modal');
    document.getElementById('btn-create-venue').addEventListener('click', () => {
        document.getElementById('new-venue-name').value = '';
        document.getElementById('new-venue-address').value = '';
        venueModal.classList.remove('hidden');
    });
    document.getElementById('btn-create-venue-cancel').addEventListener('click', () => {
        venueModal.classList.add('hidden');
    });
    document.getElementById('btn-create-venue-confirm').addEventListener('click', async () => {
        const name = document.getElementById('new-venue-name').value.trim();
        const addr = document.getElementById('new-venue-address').value.trim();
        if (!name) return alert("Venue name required");

        if (state.venues[name]) return alert("Venue already exists");

        // Create new venue entry
        state.venues[name] = [];

        // Geocode Address
        if (addr) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    state.venueLocations[name] = { lat, lon };
                    console.log(`Geocoded '${addr}': ${lat}, ${lon}`);
                } else {
                    alert("Address not found. Venue created without coordinates.");
                }
            } catch (e) {
                console.error("Geocoding failed", e);
                alert("Geocoding failed. Check console.");
            }
        }

        venueModal.classList.add('hidden');
        populateVenueSelect(name); // Select it
        updateTrackSelect(name); // Refresh track list (empty)

        // Trigger change to update global state?
        // We simulate selecting it.
        // document.getElementById('venue-select').value = name; // Already set by populate param
        // But need to trigger updateTrackSelect? Added above.
    });

    // Track Creation
    const trackModal = document.getElementById('create-track-modal');
    document.getElementById('btn-create-track').addEventListener('click', () => {
        document.getElementById('new-track-name').value = '';
        trackModal.classList.remove('hidden');
    });
    document.getElementById('btn-create-track-cancel').addEventListener('click', () => {
        trackModal.classList.add('hidden');
    });
    document.getElementById('btn-create-track-confirm').addEventListener('click', () => {
        const name = document.getElementById('new-track-name').value.trim();
        if (!name) return alert("Track Name required");

        const venue = document.getElementById('venue-select').value;
        if (!venue) return alert("Select a venue first");

        // Resolve Center
        let center = { lat: 0, lon: 0 };
        if (state.venueLocations[venue]) {
            center = state.venueLocations[venue];
        } else {
            // Default to current map center if no venue location?
            // Or Keep 0,0
            const c = map.getCenter();
            center = { lat: c.lat, lon: c.lng };
        }

        // Create Track Object
        const newTrack = {
            id: Date.now().toString(), // Simple ID
            venue: venue,
            track_name: venue, // Use the selected group as track_name
            layout_name: name,
            center: center,
            geometry: {
                main: {
                    polyline_geo: [
                        [center.lon - 0.002, center.lat],
                        [center.lon + 0.002, center.lat]
                    ]
                }
            },
            turns: [],
            curbs: [],
            source_urls: { image: "" } // No image yet
        };

        state.tracks.push(newTrack);
        state.venues[venue].push(newTrack);

        trackModal.classList.add('hidden');
        updateTrackSelect(venue, newTrack.id);
        loadTrack(newTrack.id);
    });
}

function setupSettingsListeners() {
    const modal = document.getElementById('settings-modal');
    const input = document.getElementById('settings-api-key');

    document.getElementById('btn-settings').addEventListener('click', () => {
        input.value = state.apiKey || '';
        modal.classList.remove('hidden');
    });

    document.getElementById('btn-settings-close').addEventListener('click', async () => {
        const newKey = input.value.trim();
        if (newKey !== state.apiKey) {
            state.apiKey = newKey;
            localStorage.setItem('trackalign_api_key', newKey);
            if (newKey) {
                alert("API Key saved. Fetching tracks...");
                await fetchTrackList();
            }
        }
        modal.classList.add('hidden');
    });
}


// --- Logic ---

async function loadTrack(trackId) {
    console.log("Trying to load track: " + trackId);
    // 1. Fetch Full Details
    try {
        const token = await generateJWT(state.apiKey);
        const res = await fetch(`${state.apiBase}/api-tracks-get`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: [trackId] })
        });
        if (!res.ok) throw new Error("Failed to load track details");

        const responseData = await res.json();
        // Expected response structure might be { data: [track] } or just [track]
        // Previous fix for list used .data, let's assume consistent wrapper or check.
        // If the user didn't specify return format change, I will handle both or just data.
        // Usually API wrappers are consistent.
        // Previous user edit step 7653: `const list = (await res.json()).data;` for list.
        // So likely `responseData.data` is the array.

        const data = responseData.data || responseData;

        const fullTrack = Array.isArray(data) ? data[0] : data;

        if (!fullTrack) throw new Error("Track not found in API response");

        // Merge into state or replace?
        // Replace currentTrack
        state.currentTrack = fullTrack;

        // Update the list entry in state.tracks with full data too?
        const idx = state.tracks.findIndex(t => t.id === trackId);
        if (idx !== -1) state.tracks[idx] = fullTrack;

    } catch (e) {
        console.error("Load Track Error", e);
        alert("Failed to load track details.");
        return;
    }

    const track = state.currentTrack;

    // ensure curbs array exists
    if (!state.currentTrack.curbs) state.currentTrack.curbs = [];

    state.pitLanePoints = state.currentTrack._pit_path ? [...state.currentTrack._pit_path] : [];
    state.editingMode = null;
    state.selectedTrackPointIndex = null;

    // History Init
    if (state.currentTrack.geometry && state.currentTrack.geometry.main && state.currentTrack.geometry.main.polyline_geo) {
        state.originalTrackGeo = JSON.parse(JSON.stringify(state.currentTrack.geometry.main.polyline_geo));
    } else {
        // Handle empty geometry
        if (!state.currentTrack.geometry) state.currentTrack.geometry = { main: { polyline_geo: [] } };
    }
    state.trackHistory = [];

    updateUIButtons();

    console.log("Loaded Track:", track);

    // 1. Center Map
    if (track.center) {
        map.setView([track.center.lat, track.center.lon], 16);
    } else if (track.geometry.main.polyline_geo && track.geometry.main.polyline_geo.length > 0) {
        const p = track.geometry.main.polyline_geo[0];
        map.setView([p[1], p[0]], 16);
    }

    // 2. Render OSM Track
    renderOSMTrack();

    // 3. Set Reference Image
    loadRefImage(track);

    // 4. Render Features
    renderFeatures();
    renderTrackWidth();

    updateFeatureList();
    updateCurbList();

    // 5. Check for Imports
    checkForSiblingEdits(track);
}
function checkForSiblingEdits(track) {
    if (!track.venue) return;

    const siblings = state.tracks.filter(t => t.venue === track.venue && t.id !== track.id);
    const updatedSiblings = siblings.filter(t => {
        // Simple heuristic for "edited"
        return (t._sf_point || t._pit_entry || t._pit_exit || (t.curbs && t.curbs.length > 0) || (t.turns && t.turns.some(turn => turn.geo_point)));
    });

    if (updatedSiblings.length > 0) {
        const modal = document.getElementById('import-modal');
        const select = document.getElementById('import-source-select');
        select.innerHTML = '';

        updatedSiblings.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.layout_name || s.id;
            select.appendChild(opt);
        });

        modal.classList.remove('hidden');
    }
}

function setupImportListeners() {
    document.getElementById('btn-import-cancel').addEventListener('click', () => {
        document.getElementById('import-modal').classList.add('hidden');
    });

    document.getElementById('btn-import-confirm').addEventListener('click', () => {
        const select = document.getElementById('import-source-select');
        const sourceId = select.value;
        const sourceTrack = state.tracks.find(t => t.id === sourceId);

        if (!sourceTrack) return;

        const target = state.currentTrack;

        if (document.getElementById('import-sf').checked) {
            target._sf_point = sourceTrack._sf_point ? { ...sourceTrack._sf_point } : undefined;
        }
        if (document.getElementById('import-pit').checked) {
            target._pit_entry = sourceTrack._pit_entry ? { ...sourceTrack._pit_entry } : undefined;
            target._pit_exit = sourceTrack._pit_exit ? { ...sourceTrack._pit_exit } : undefined;
            if (sourceTrack._pit_path) {
                target._pit_path = [...sourceTrack._pit_path];
                state.pitLanePoints = [...target._pit_path]; // Immediate update
            }
        }
        if (document.getElementById('import-geo').checked) {
            if (sourceTrack.geometry && sourceTrack.geometry.main && sourceTrack.geometry.main.polyline_geo) {
                saveTrackHistory();
                target.geometry.main.polyline_geo = JSON.parse(JSON.stringify(sourceTrack.geometry.main.polyline_geo));
            }
        }
        if (document.getElementById('import-turns').checked) {
            if (sourceTrack.turns) {
                target.turns = JSON.parse(JSON.stringify(sourceTrack.turns));
            }
        }
        if (document.getElementById('import-curbs').checked) {
            if (sourceTrack.curbs) {
                target.curbs = JSON.parse(JSON.stringify(sourceTrack.curbs));
            }
        }

        renderOSMTrack();
        renderFeatures();
        updateFeatureList();
        updateCurbList();
        updateUIButtons();
        document.getElementById('import-modal').classList.add('hidden');
    });
}

function loadRefImage(track) {
    let imgUrl = track.source_urls.image;
    const refWindow = document.getElementById('ref-window');
    const img = document.getElementById('ref-img');

    if (imgUrl) {
        imgUrl = imgUrl.replace('Results_v2/Results', 'assets/tracks');
        img.src = imgUrl;
        refWindow.classList.remove('hidden');
    } else {
        refWindow.classList.add('hidden');
    }
}

function saveTrackHistory() {
    if (!state.currentTrack?.geometry?.main?.polyline_geo) return;
    const geoCopy = JSON.parse(JSON.stringify(state.currentTrack.geometry.main.polyline_geo));
    state.trackHistory.push(geoCopy);
    if (state.trackHistory.length > 20) state.trackHistory.shift();
    updateUIButtons();
}

function renderOSMTrack() {
    if (state.layers.osm) map.removeLayer(state.layers.osm);

    if (!state.layers.trackPoints) state.layers.trackPoints = L.layerGroup().addTo(map);
    state.layers.trackPoints.clearLayers();

    const geoPoints = state.currentTrack.geometry.main.polyline_geo;
    if (!geoPoints || geoPoints.length === 0) return;

    const latLngs = geoPoints.map(p => [p[1], p[0]]);

    state.layers.osm = L.polyline(latLngs, {
        color: '#ff3333',
        weight: 2,
        opacity: 0.8,
        interactive: false
    }).addTo(map);

    if (state.editingMode === 'EDIT_TRACK' || state.editingMode === 'DELETE_RANGE') {
        state.layers.trackPoints.addTo(map);

        geoPoints.forEach((p, i) => {
            const isSelected = (i === state.selectedTrackPointIndex);
            const isStart = (i === 0);
            const isEnd = (i === geoPoints.length - 1);

            let color = isSelected ? '#0088ff' : '#fff';

            // Delete Range Visuals
            if (state.editingMode === 'DELETE_RANGE') {
                if (state.deleteRangeStart !== null) {
                    if (i === state.deleteRangeStart) {
                        color = 'orange'; // Start point
                    }
                    // No preview of range here, handled in move/interaction? 
                    // Or we could preview if we knew the end point (hover).
                    // For now, just highlight Start.
                }
            } else {
                if (!isSelected) {
                    if (isStart) color = '#00ff00'; // Green first
                    if (isEnd) color = '#ff0000';   // Red last
                }
            }

            // Visible point
            const visibleMarker = L.circleMarker([p[1], p[0]], {
                color: color,
                fillColor: isSelected ? '#0088ff' : '#333',
                fillOpacity: 1,
                radius: isSelected ? 6 : 4,
                weight: 2,
                interactive: false,
                pane: 'trackPoints'
            }).addTo(state.layers.trackPoints);

            // Hit target
            const inputM = L.circleMarker([p[1], p[0]], {
                color: 'transparent',
                fillColor: 'transparent',
                radius: 12, // Large hit area
                weight: 0,
                className: 'draggable-track-point',
                interactive: true,
                pane: 'trackPoints'
            }).addTo(state.layers.trackPoints);

            // INTERACTION LOGIC START
            inputM.on('mouseover', () => {
                visibleMarker.setStyle({ radius: 8, weight: 3 });
            });
            inputM.on('mouseout', () => {
                const isSel = (i === state.selectedTrackPointIndex);
                let r = isSel ? 6 : 4;
                if (state.editingMode === 'DELETE_RANGE' && i === state.deleteRangeStart) r = 6;
                visibleMarker.setStyle({ radius: r, weight: 2 });
            });

            inputM.on('mousedown', (e) => {
                // Stop Leaflet Propagation (No Map Drag)
                L.DomEvent.stopPropagation(e);
                // L.DomEvent.preventDefault(e); // Removed to allow Click generation

                state.potentialDragIndex = i;
                state.dragStartPoint = map.mouseEventToContainerPoint(e.originalEvent);
                state.isDragging = false; // Reset drag flag

                // Disable Map Dragging immediately
                map.dragging.disable();
            });

            inputM.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                // If we were dragging, ignore click
                if (state.isDragging) return;

                // Otherwise this is a Clean Click
                console.log("Clean Click on Point:", i);
                handlePointClick(i);
            });

            // If in Curb Mode, show different cursor or highlight?
            if (state.editingMode === 'DEFINE_CURB_START' || state.editingMode === 'DEFINE_CURB_END') {
                inputM.on('mouseover', () => {
                    // Highlight?
                    visibleMarker.setStyle({ color: 'orange', radius: 6 });
                });
                inputM.on('mouseout', () => {
                    visibleMarker.setStyle({ color: color, radius: isSelected ? 6 : 4 });
                });
            }

            inputM.on('contextmenu', (e) => {
                L.DomEvent.stopPropagation(e);
                deletePoint(i);
            });
        });
    }
}

function handlePointClick(index) {
    if (state.editingMode === 'DELETE_RANGE') {
        if (state.deleteRangeStart === null) {
            // Select Start
            state.deleteRangeStart = index;
            console.log("Delete Range Start:", index);
            renderOSMTrack();
            updateUIButtons();
        } else {
            // Select End & Confirm
            const i = state.deleteRangeStart;
            const j = index;
            if (i === j) {
                // Deselect if clicking same point
                state.deleteRangeStart = null;
                renderOSMTrack();
                updateUIButtons();
                return;
            }

            const min = Math.min(i, j);
            const max = Math.max(i, j);
            const count = max - min + 1; // It's inclusive usually? 
            // "Remove big chunks" -> User selects start and end. We remove everything IN BETWEEN? 
            // Or inclusive of start/end?
            // "Choose starting point, and ending point, and see them all turn red"
            // Usually implies inclusive deletion of the segment.

            // VISUALIZE RED SEGMENT first?
            // The user asked for "Confirmation alert".
            // So we can highlight red, then alert.

            // Let's create a temporary red polyline to show what will be deleted
            const geo = state.currentTrack.geometry.main.polyline_geo;
            const segment = geo.slice(min, max + 1).map(p => [p[1], p[0]]);

            const redLine = L.polyline(segment, { color: 'red', weight: 6, opacity: 0.8 }).addTo(map);

            setTimeout(() => {
                if (confirm(`Delete ${count} points from index ${min} to ${max}?`)) {
                    saveTrackHistory();
                    // Remove points.
                    // If we remove min to max inclusive:
                    state.currentTrack.geometry.main.polyline_geo.splice(min, count);

                    // Reset
                    state.deleteRangeStart = null;
                    map.removeLayer(redLine);
                    renderOSMTrack();
                    renderTrackWidth();
                    updateUIButtons();
                } else {
                    // Cancel
                    map.removeLayer(redLine);
                    state.deleteRangeStart = null;
                    renderOSMTrack();
                    updateUIButtons();
                }
            }, 50); // Small timeout to allow render
        }
        return;
    }

    if (state.selectedTrackPointIndex === index) {
        // Deselect
        state.selectedTrackPointIndex = null;
    } else if (state.selectedTrackPointIndex !== null) {
        // Link Logic
        const i = state.selectedTrackPointIndex;
        const j = index;

        if (i !== j && Math.abs(i - j) > 1) {
            saveTrackHistory();
            const min = Math.min(i, j);
            const max = Math.max(i, j);
            const geo = state.currentTrack.geometry.main.polyline_geo;

            // Check for Loop Closure (Start <-> End)
            if (min === 0 && max === geo.length - 1) {
                const pStart = geo[min];
                const pEnd = geo[max];

                // Calculate distance (very rough, squares) to see if we should snap or append
                // Actually, safer to always append unless they are IDENTICAL.
                // If the user manually placed the last point ON TOP of the first, maybe they want to merge?
                // But usually, "Click" means "Add segment".

                // Check exact equality to prevent infinite stacking if user keeps clicking
                if (pStart[0] === pEnd[0] && pStart[1] === pEnd[1]) {
                    console.log("Loop already closed");
                    state.selectedTrackPointIndex = null; // Auto deselect
                } else {
                    // Append a new point closing the loop
                    geo.push([pStart[0], pStart[1]]);
                    state.selectedTrackPointIndex = null; // Auto deselect
                    console.log("Closed Loop (Appended Point)");
                }
            } else {
                // Normal "Short Circuit" Link
                // Removing intermediate points
                const countToRemove = max - min - 1;
                // If we are deleting > 50% of the track, safety check (unless small track)
                if (geo.length > 20 && countToRemove > geo.length / 2) {
                    if (!confirm(`This will delete ${countToRemove} points (shortcut). Continue?`)) {
                        return; // Abort
                    }
                }

                geo.splice(min + 1, countToRemove);
                // Selection update
                state.selectedTrackPointIndex = (i < j) ? i + 1 : j;
            }

            renderOSMTrack();
            renderTrackWidth();
        } else {
            state.selectedTrackPointIndex = index;
        }
        // Just Select
        // state.selectedTrackPointIndex = index; // This was wrong / redundant
    } else {
        // Initial Selection
        state.selectedTrackPointIndex = index;
    }
    renderOSMTrack();
    updateUIButtons();
}

function handleCurbClick(index, e) {
    if (state.activeCurbIndex === null) return;
    const curb = state.currentTrack.curbs[state.activeCurbIndex];
    const geo = state.currentTrack.geometry.main.polyline_geo;

    if (state.editingMode === 'DEFINE_CURB_START') {
        curb.start_index = index;

        // Determine Side: Left or Right?
        // We need the tangent at this point.
        // Approx: point[i+1] - point[i-1]
        const p = geo[index];
        const pNext = geo[Math.min(index + 1, geo.length - 1)];
        const pPrev = geo[Math.max(index - 1, 0)];

        // Vector of track
        let dx = pNext[0] - pPrev[0];
        let dy = pNext[1] - pPrev[1];
        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len; dy /= len;

        // Normal vector (Left) is (-dy, dx)
        const nx = -dy;
        const ny = dx;

        // Click position (Projected to lat/lon then normalized?)
        // Easiest: Compare click LatLng to Point LatLng
        // But map projection distorts.
        // Let's use screen points for "Left/Right" check if we can?
        // Or simpler: Cross product of (TrackVector, ClickVector)

        // Track Vector T = (dx, dy)
        // Click Vector C = (ClickLon - PointLon, ClickLat - PointLat)
        // Cross product Z = dx*cy - dy*cx
        // If Z > 0 => Left, Z < 0 => Right (Coordinate system dependent)

        const cLon = e.latlng.lng - p[0];
        const cLat = e.latlng.lat - p[1];

        const cross = dx * cLat - dy * cLon;

        curb.side = (cross > 0) ? 'left' : 'right';
        console.log(`Curb Start: ${index}, Side: ${curb.side}`);

        state.editingMode = 'DEFINE_CURB_END';
        updateUIButtons();
        updateCurbList();
    } else if (state.editingMode === 'DEFINE_CURB_END') {
        curb.end_index = index;
        // Fix order if reversed
        if (curb.end_index < curb.start_index) {
            const temp = curb.start_index;
            curb.start_index = curb.end_index;
            curb.end_index = temp;
        }

        state.editingMode = null;
        state.activeCurbIndex = null;
        updateUIButtons();
        updateCurbList();
        renderFeatures();
    }
}

function deletePoint(index) {
    if (state.currentTrack.geometry.main.polyline_geo.length > 2) {
        saveTrackHistory();
        state.currentTrack.geometry.main.polyline_geo.splice(index, 1);
        state.selectedTrackPointIndex = null;
        renderOSMTrack();
        renderTrackWidth();
        updateUIButtons();
    }
}

function renderTrackWidth() {
    if (state.layers.trackWidth) map.removeLayer(state.layers.trackWidth);

    const geoPoints = state.currentTrack.geometry.main.polyline_geo;
    if (!geoPoints || geoPoints.length === 0) return;

    const latLngs = geoPoints.map(p => [p[1], p[0]]);

    const centerLat = map.getCenter().lat;
    const zoom = map.getZoom();
    const metersPerPixel = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
    const pixelWeight = state.trackWidth / metersPerPixel;

    state.layers.trackWidth = L.polyline(latLngs, {
        color: '#ff0000',
        weight: pixelWeight,
        opacity: 0.3,
        interactive: false
    }).addTo(map);

    state.layers.trackWidth.bringToBack();
}

function renderPitWidth() {
    if (state.layers.pitWidth) map.removeLayer(state.layers.pitWidth);

    if (!state.pitLanePoints || state.pitLanePoints.length < 2) return;

    const centerLat = map.getCenter().lat;
    const zoom = map.getZoom();
    const metersPerPixel = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
    const pixelWeight = state.pitWidth / metersPerPixel;

    state.layers.pitWidth = L.polyline(state.pitLanePoints, {
        color: 'magenta',
        weight: pixelWeight,
        opacity: 0.3,
        interactive: false
    }).addTo(map);

    state.layers.pitWidth.bringToBack();
}

function renderFeatures() {
    if (state.layers.features) state.layers.features.clearLayers();
    else state.layers.features = L.layerGroup().addTo(map);
    if (state.layers.pitLane) state.layers.pitLane.clearLayers();
    else state.layers.pitLane = L.layerGroup().addTo(map);
    if (!state.currentTrack) return;

    // Projection Constants
    const centerLat = map.getCenter().lat;
    const metersPerDegreeLat = 111132.92;
    const metersPerDegreeLon = 111412.84 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = state.trackWidth / 2;

    if (state.currentTrack._sf_point) {
        // Find orientation
        const geo = state.currentTrack.geometry.main.polyline_geo;
        const sfLatLng = state.currentTrack._sf_point;
        if (geo) {
            const info = getNearestSegmentIndex(sfLatLng, geo);
            if (info.index !== -1) {
                const p1 = geo[info.index];
                const p2 = geo[info.index + 1];
                let dx = p2[0] - p1[0];
                let dy = p2[1] - p1[1];
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    dx /= len; dy /= len;
                    // Normal
                    const nx = -dy;
                    const ny = dx;

                    const offLon = (nx * widthMeters) / metersPerDegreeLon;
                    const offLat = (ny * widthMeters) / metersPerDegreeLat;

                    const lineStart = [sfLatLng.lat + offLat, sfLatLng.lng + offLon];
                    const lineEnd = [sfLatLng.lat - offLat, sfLatLng.lng - offLon];

                    L.polyline([lineStart, lineEnd], { color: '#00ff00', weight: 4 }).addTo(state.layers.features).bindTooltip("Start/Finish Line");
                }
            }
        }
    }

    if (state.currentTrack._pit_entry) {
        L.circleMarker(state.currentTrack._pit_entry, { color: 'magenta', radius: 5 }).addTo(state.layers.features).bindTooltip("Pit In");
    }
    if (state.currentTrack._pit_exit) {
        L.circleMarker(state.currentTrack._pit_exit, { color: 'magenta', radius: 5 }).addTo(state.layers.features).bindTooltip("Pit Out");
    }

    if (state.currentTrack.curbs) {
        // Render Lines offset from track
        const geo = state.currentTrack.geometry.main.polyline_geo;

        state.currentTrack.curbs.forEach((c, i) => {
            if (typeof c.start_index === 'number' && typeof c.end_index === 'number') {
                const pts = [];
                for (let k = c.start_index; k <= c.end_index; k++) {
                    const p = geo[k];
                    // Calculate Normal
                    const pNext = geo[Math.min(k + 1, geo.length - 1)];
                    const pPrev = geo[Math.max(k - 1, 0)];
                    let dx = pNext[0] - pPrev[0];
                    let dy = pNext[1] - pPrev[1];
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len === 0) continue;
                    dx /= len; dy /= len;

                    // Normal (Left)
                    let nx = -dy;
                    let ny = dx;

                    if (c.side === 'right') {
                        nx = -nx;
                        ny = -ny;
                    }

                    // Offset
                    const offLon = (nx * widthMeters) / metersPerDegreeLon;
                    const offLat = (ny * widthMeters) / metersPerDegreeLat;

                    pts.push([p[1] + offLat, p[0] + offLon]);
                }

                const isHighlighted = (i === state.highlightedCurbIndex);
                L.polyline(pts, {
                    color: isHighlighted ? 'white' : 'red',
                    weight: isHighlighted ? 6 : 4,
                    dashArray: '5,5',
                    opacity: isHighlighted ? 1 : 0.8,
                    interactive: false
                }).addTo(state.layers.features)
                    .bindTooltip(c.name || `Curb ${i + 1}`);
            }
        });
    }
    if (state.currentTrack.turns) {
        state.currentTrack.turns.forEach((t, i) => {
            if (t.geo_point) {
                const m = L.circleMarker(t.geo_point, { color: 'yellow', radius: 4 }).addTo(state.layers.features);
                m.bindTooltip(`${i + 1}: ${t.name || ''}`);
            }
        });
    }
    if (state.pitLanePoints.length > 0) {
        L.polyline(state.pitLanePoints, { color: 'magenta', dashArray: '4,4' }).addTo(state.layers.pitLane);
        state.pitLanePoints.forEach((p, index) => {
            const m = L.circleMarker(p, {
                radius: 4, color: 'magenta', fillOpacity: 1, className: 'draggable-marker'
            }).addTo(state.layers.pitLane);
            if (state.editingMode === 'TRACE_PIT') {
                m.setStyle({ color: '#fff', fillColor: 'magenta' });
                m.on('mousedown', (e) => {
                    L.DomEvent.stopPropagation(e);
                    state.draggingPitPointIndex = index;
                    map.dragging.disable();
                });
            }
        });
    }
    renderPitWidth();
    // Sync Pit Path to Track Object
    if (state.currentTrack) {
        state.currentTrack._pit_path = state.pitLanePoints; // Reference copy
    }
}

// --- Geometry Utils ---
function getNearestPointOnPolyline(latlng, polylineGeo) {
    let minDist = Infinity;
    let nearestLatLng = null;
    for (let i = 0; i < polylineGeo.length - 1; i++) {
        const lat1 = polylineGeo[i][1];
        const lon1 = polylineGeo[i][0];
        const lat2 = polylineGeo[i + 1][1];
        const lon2 = polylineGeo[i + 1][0];
        const closest = getClosestPointOnSegment(latlng.lat, latlng.lng, lat1, lon1, lat2, lon2);
        const currentLatLng = L.latLng(closest.lat, closest.lng);
        const dist = latlng.distanceTo(currentLatLng);
        if (dist < minDist) { minDist = dist; nearestLatLng = currentLatLng; }
    }
    return nearestLatLng;
}
function getClosestPointOnSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
    const x = pLon, y = pLat;
    const x1 = aLon, y1 = aLat;
    const x2 = bLon, y2 = bLat;
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return { lat: yy, lng: xx };
}
function getNearestSegmentIndex(latlng, polylineGeo) {
    let minDist = Infinity;
    let index = -1;
    let insertionPoint = null;
    for (let i = 0; i < polylineGeo.length - 1; i++) {
        const lat1 = polylineGeo[i][1];
        const lon1 = polylineGeo[i][0];
        const lat2 = polylineGeo[i + 1][1];
        const lon2 = polylineGeo[i + 1][0];
        const closest = getClosestPointOnSegment(latlng.lat, latlng.lng, lat1, lon1, lat2, lon2);
        const currentLatLng = L.latLng(closest.lat, closest.lng);
        const dist = latlng.distanceTo(currentLatLng);
        if (dist < minDist) { minDist = dist; index = i; insertionPoint = currentLatLng; }
    }
    return { index, point: insertionPoint };
}


// --- Interactions ---

function setupMapInteractions() {
    map.on('zoomend', () => {
        if (state.currentTrack) {
            renderTrackWidth();
            renderPitWidth();
        }
    });

    map.on('mousemove', (e) => {
        // 1. Handle Potential Drag -> Real Drag Promotion
        if (state.potentialDragIndex !== null) {
            const currentPoint = map.mouseEventToContainerPoint(e.originalEvent);
            const dist = currentPoint.distanceTo(state.dragStartPoint);

            // Threshold: 5 pixels
            if (dist > 5) {
                console.log("Starting Drag");
                state.isDragging = true; // Mark as dragging
                saveTrackHistory(); // Save BEFORE modifying
                state.draggingTrackPointIndex = state.potentialDragIndex;
                state.potentialDragIndex = null;
            }
        }

        // 2. Handle Real Track Drag
        if (state.draggingTrackPointIndex !== null && state.editingMode === 'EDIT_TRACK') {
            state.currentTrack.geometry.main.polyline_geo[state.draggingTrackPointIndex] = [e.latlng.lng, e.latlng.lat];
            renderOSMTrack();
            renderTrackWidth();
            return;
        }

        // 3. Handle Pit Point Drag (Simple for now)
        if (state.draggingPitPointIndex !== null && state.editingMode === 'TRACE_PIT') {
            state.pitLanePoints[state.draggingPitPointIndex] = e.latlng;
            renderFeatures();
            return;
        }

        // 4. Trace Pit Ghost
        if (state.editingMode === 'TRACE_PIT') {
            if (state.layers.interaction) state.layers.interaction.clearLayers();
            else state.layers.interaction = L.layerGroup().addTo(map);

            let startPoint = null;
            if (state.pitLanePoints.length > 0) startPoint = state.pitLanePoints[state.pitLanePoints.length - 1];
            else if (state.currentTrack?._pit_entry) startPoint = state.currentTrack._pit_entry;

            let targetPoint = e.latlng;
            const pitExit = state.currentTrack?._pit_exit;
            if (pitExit) {
                const dist = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(pitExit));
                if (dist < 20) {
                    targetPoint = pitExit;
                    L.circleMarker(targetPoint, { radius: 8, color: '#00ff00', fill: false }).addTo(state.layers.interaction);
                }
            }
            if (startPoint) {
                L.polyline([startPoint, targetPoint], { color: 'magenta', weight: 1, dashArray: '4,4' }).addTo(state.layers.interaction);
            }
            return;
        }

        // 5. Edit Track Ghosts
        if (state.editingMode === 'EDIT_TRACK') {
            const geo = state.currentTrack?.geometry?.main?.polyline_geo;
            if (geo) {
                // 5a. If Selection Active: Rubber band
                if (state.selectedTrackPointIndex !== null) {
                    if (state.layers.interaction) state.layers.interaction.clearLayers();
                    else state.layers.interaction = L.layerGroup().addTo(map);

                    const p = geo[state.selectedTrackPointIndex];
                    const start = L.latLng(p[1], p[0]);

                    L.polyline([start, e.latlng], { color: '#0088ff', weight: 1, dashArray: '4,4' }).addTo(state.layers.interaction);
                    return;
                }

                // 5b. Normal Ghost Insert Check
                const closeToPoint = geo.some(p => {
                    const pll = L.latLng(p[1], p[0]);
                    const pt = map.latLngToLayerPoint(pll);
                    const mousePt = map.latLngToLayerPoint(e.latlng);
                    return pt.distanceTo(mousePt) < 10;
                });

                if (closeToPoint) {
                    if (state.layers.interaction) state.layers.interaction.clearLayers();
                    return;
                }

                const info = getNearestSegmentIndex(e.latlng, geo);
                if (info.point) {
                    if (state.layers.interaction) state.layers.interaction.clearLayers();
                    else state.layers.interaction = L.layerGroup().addTo(map);
                    L.circleMarker(info.point, { radius: 4, color: '#fff', dashArray: '2,2', fillOpacity: 0.5 }).addTo(state.layers.interaction);
                }
            }
            return;
        }

        if (!state.editingMode || state.editingMode === 'DELETE_RANGE') {
            if (state.layers.interaction) state.layers.interaction.clearLayers();
            return;
        }

        // Standard Click Snap
        const geo = state.currentTrack?.geometry?.main?.polyline_geo;
        if (!geo) return;
        const snapped = getNearestPointOnPolyline(e.latlng, geo);
        if (state.layers.interaction) state.layers.interaction.clearLayers();
        else state.layers.interaction = L.layerGroup().addTo(map);
        if (snapped) {
            L.polyline([e.latlng, snapped], { color: 'white', weight: 1, dashArray: '2,2' }).addTo(state.layers.interaction);
            L.circleMarker(snapped, { radius: 6, color: '#fff', weight: 2, fillColor: 'transparent', fillOpacity: 0 }).addTo(state.layers.interaction);
            L.circleMarker(snapped, { radius: 3, color: 'cyan', fillOpacity: 1, stroke: false }).addTo(state.layers.interaction);
        }
    });

    map.on('mouseup', (e) => {
        // 1. Active Pit Drag End
        if (state.draggingPitPointIndex !== null) {
            state.draggingPitPointIndex = null;
            map.dragging.enable();
            return;
        }

        // 2. Active Track Drag End
        if (state.draggingTrackPointIndex !== null) {
            console.log("Drag End");
            state.draggingTrackPointIndex = null;
            map.dragging.enable();
            renderOSMTrack(); // Redraw proper radius
            return;
        }

        // 3. Potential Drag -> MouseUp (End without drag)
        if (state.potentialDragIndex !== null) {
            // We just released without dragging far enough.
            // The CLICK event on the marker will fire next.
            // We just need to cleanup.
            state.potentialDragIndex = null;
            map.dragging.enable();
            return;
        }
    });

    map.on('click', (e) => {
        // If we are handling internal clicks (via mouseup), prevent map click logic?
        // Leaflet click fires on mouseup. 
        // We need to be careful not to trigger "Insert Point" immediately after "Select Point".
        // Luckily, we stopped propagation on mousedown/mouseup on markers?
        // Actually, we process marker-mouseup logic above.
        // If that logic runs, does the map still receive 'click'?
        // If we didn't stop prop on mouseup chain, yes.
        // But we handle it.

        if (!state.editingMode) return;

        // Edit Track
        if (state.editingMode === 'EDIT_TRACK') {
            // Only process Map Clicks (Insert) if we didn't just click a marker.
            // We can check if `potentialDragIndex` was set recently?
            // Or rely on the fact that Mousedown stopped propagation.
            // If propagation stopped, `map.click` won't fire. 
            // Correct.

            const geo = state.currentTrack?.geometry?.main?.polyline_geo;
            if (geo) {
                // 1. If Selected: Insert point connected to it (Trace)
                if (state.selectedTrackPointIndex !== null) {
                    saveTrackHistory();
                    const idx = state.selectedTrackPointIndex;
                    geo.splice(idx + 1, 0, [e.latlng.lng, e.latlng.lat]);
                    state.selectedTrackPointIndex = idx + 1; // Advance selection
                    renderOSMTrack();
                    renderTrackWidth();
                } else {
                    // 2. Normal Segment Insert
                    const info = getNearestSegmentIndex(e.latlng, geo);
                    if (info.index !== -1 && info.point) {
                        saveTrackHistory();
                        geo.splice(info.index + 1, 0, [info.point.lng, info.point.lat]);
                        renderOSMTrack();
                        renderTrackWidth();
                    }
                }
            }
            return;
        }

        // Trace Pit
        if (state.editingMode === 'TRACE_PIT') {
            let pointToAdd = e.latlng;
            let shouldFinish = false;
            const pitExit = state.currentTrack?._pit_exit;
            if (pitExit) {
                const dist = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(pitExit));
                if (dist < 20) { pointToAdd = pitExit; shouldFinish = true; }
            }
            state.pitLanePoints.push(pointToAdd);
            renderFeatures();
            updateUIButtons();
            if (shouldFinish) { setMode(null); if (state.layers.interaction) state.layers.interaction.clearLayers(); }
            return;
        }

        // Other Modes
        const geo = state.currentTrack.geometry.main.polyline_geo;
        if (!geo) return;
        const snapped = getNearestPointOnPolyline(e.latlng, geo);
        if (!snapped) return;

        let autoExit = false;
        if (state.editingMode === 'SF_LINE') { state.currentTrack._sf_point = snapped; autoExit = true; }
        else if (state.editingMode === 'PIT_ENTRY') { state.currentTrack._pit_entry = snapped; autoExit = true; }
        else if (state.editingMode === 'PIT_EXIT') { state.currentTrack._pit_exit = snapped; autoExit = true; }
        // ADD_CURB handled differently (via handleCurbClick in handlePointClick flow?) 
        // Actually, better to hook into handlePointClick for precision, but if they click map near point, we snap.
        // Let's use the explicit handlePointClick for precision, but if they click map near point, we snap.

        if (state.editingMode === 'DEFINE_CURB_START' || state.editingMode === 'DEFINE_CURB_END') {
            // 1. Try to snap to existing VERTEX first
            let nearestIdx = -1;
            let minD = Infinity;
            geo.forEach((p, i) => {
                const pll = L.latLng(p[1], p[0]);
                const d = e.latlng.distanceTo(pll);
                if (d < minD) { minD = d; nearestIdx = i; }
            });

            // If very close to a vertex, use it
            const vertexSnapDist = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(L.latLng(geo[nearestIdx][1], geo[nearestIdx][0])));

            if (nearestIdx !== -1 && vertexSnapDist < 15) {
                handleCurbClick(nearestIdx, e);
                return;
            }

            // 2. If not close to vertex, ALWAYS insert new point at projection on nearest segment
            const info = getNearestSegmentIndex(e.latlng, geo);
            if (info.point) {
                // Insert new point at the projected location
                saveTrackHistory();
                geo.splice(info.index + 1, 0, [info.point.lng, info.point.lat]);
                renderOSMTrack();
                renderTrackWidth();
                // Determine new index (it's info.index + 1)
                handleCurbClick(info.index + 1, e);
                return;
            }
        }

        else if (state.editingMode === 'TURN_POINT' && state.activeTurnIndex !== null) {
            state.currentTrack.turns[state.activeTurnIndex].geo_point = snapped; autoExit = true;
        }

        renderFeatures();
        if (autoExit) {
            state.editingMode = null;
            state.activeTurnIndex = null;
            if (state.layers.interaction) state.layers.interaction.clearLayers();
        }
        updateUIButtons();
    });
}
function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (state.editingMode === 'EDIT_TRACK' && state.selectedTrackPointIndex !== null) {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                deletePoint(state.selectedTrackPointIndex);
            }
            if (e.key === 'Escape') {
                state.selectedTrackPointIndex = null;
                renderOSMTrack();
                updateUIButtons();
            }
        }
    });
}


// --- UI & Events ---

function setupEventListeners() {
    document.getElementById('venue-select').addEventListener('change', (e) => updateTrackSelect(e.target.value));
    document.getElementById('track-select').addEventListener('change', (e) => {
        const val = e.target.value;
        const venue = document.getElementById('venue-select').value;
        let trackId = val;

        console.log(e);

        console.log("selected value: " + val);

        console.log("venue: " + venue);

        // User warning: val might be layout name. Ensure we get the ID.
        if (venue && state.venues[venue]) {
            // Try to find exact match on ID
            const tById = state.venues[venue].find(t => t.id === val);
            if (tById) {
                trackId = tById.id;
            } else {
                // Try to match by layout_name
                const tByName = state.venues[venue].find(t => t.layout_name === val);
                if (tByName) {
                    trackId = tByName.id;
                }
            }
        }

        if (trackId) loadTrack(trackId);
    });

    document.getElementById('btn-sf-line').addEventListener('click', () => setMode('SF_LINE'));
    document.getElementById('btn-pit-entry').addEventListener('click', () => setMode('PIT_ENTRY'));
    document.getElementById('btn-pit-exit').addEventListener('click', () => setMode('PIT_EXIT'));
    document.getElementById('btn-trace-pit').addEventListener('click', () => setMode('TRACE_PIT'));
    document.getElementById('btn-edit-trace').addEventListener('click', () => {
        setMode('EDIT_TRACK');
    });

    document.getElementById('btn-add-curb-entry').addEventListener('click', () => {
        if (!state.currentTrack.curbs) state.currentTrack.curbs = [];
        const newCurb = { name: `Curb ${state.currentTrack.curbs.length + 1}`, start_index: null, end_index: null, side: null };
        state.currentTrack.curbs.push(newCurb);

        // Auto-Start defining the new curb
        const newIndex = state.currentTrack.curbs.length - 1;
        setMode('DEFINE_CURB_START', null, newIndex);
    });

    // Pit Lane Controls
    document.getElementById('btn-undo-pit').addEventListener('click', () => {
        if (state.pitLanePoints.length > 0) {
            state.pitLanePoints.pop();
            renderFeatures();
            updateUIButtons();
        }
    });

    document.getElementById('btn-reset-pit').addEventListener('click', () => {
        if (state.pitLanePoints.length > 0) {
            if (confirm("Reset pitlane?")) { state.pitLanePoints = []; renderFeatures(); updateUIButtons(); }
        }
    });

    // Track Edit Controls
    document.getElementById('btn-undo-track').addEventListener('click', () => {
        if (state.trackHistory.length > 0) {
            const prevGeo = state.trackHistory.pop();
            state.currentTrack.geometry.main.polyline_geo = prevGeo;
            // Restore selection if valid? Maybe clear to be safe.
            state.selectedTrackPointIndex = null;
            renderOSMTrack();
            renderTrackWidth();
            updateUIButtons();
        }
    });

    document.getElementById('btn-delete-point').addEventListener('click', () => {
        if (state.selectedTrackPointIndex !== null) {
            deletePoint(state.selectedTrackPointIndex);
        }
    });

    const btnDeleteRange = document.getElementById('btn-delete-range');
    if (btnDeleteRange) {
        btnDeleteRange.addEventListener('click', () => {
            if (state.editingMode === 'DELETE_RANGE') {
                setMode(null);
                state.deleteRangeStart = null;
            } else {
                setMode('DELETE_RANGE');
                state.deleteRangeStart = null;
            }
            renderOSMTrack();
        });
    }

    document.getElementById('btn-reset-track').addEventListener('click', () => {
        if (state.originalTrackGeo) {
            if (confirm("Reset track geometry to original?")) {
                state.currentTrack.geometry.main.polyline_geo = JSON.parse(JSON.stringify(state.originalTrackGeo));
                state.trackHistory = [];
                state.selectedTrackPointIndex = null;
                renderOSMTrack();
                renderTrackWidth();
                updateUIButtons();
            }
        }
    });

    document.getElementById('track-width').addEventListener('input', (e) => {
        state.trackWidth = parseFloat(e.target.value);
        document.getElementById('track-width-val').textContent = state.trackWidth + 'm';
        renderTrackWidth();
    });

    document.getElementById('pit-width').addEventListener('input', (e) => {
        state.pitWidth = parseFloat(e.target.value);
        document.getElementById('pit-width-val').textContent = state.pitWidth + 'm';
        renderPitWidth();
    });

    document.getElementById('toggle-ref').addEventListener('click', () => {
        const win = document.getElementById('ref-window');
        win.classList.toggle('collapsed');
        document.getElementById('toggle-ref').textContent = win.classList.contains('collapsed') ? '+' : '-';
    });
    document.getElementById('maximize-ref').addEventListener('click', () => {
        document.getElementById('ref-window').classList.toggle('maximized');
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        if (!state.currentTrack) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tracks, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "updated_tracks.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
}

function setMode(mode, turnIndex = null, curbIndex = null) {
    console.log(`Setting mode: ${mode}, Turn: ${turnIndex}, Curb: ${curbIndex}`);

    // Toggle Logic
    if (state.editingMode === mode && state.activeTurnIndex === turnIndex && state.activeCurbIndex === curbIndex) {
        state.editingMode = null;
        state.activeTurnIndex = null;
        state.activeCurbIndex = null;
    } else {
        state.editingMode = mode;
        state.activeTurnIndex = turnIndex;
        state.activeCurbIndex = curbIndex;

        // Auto-Start Pit Trace
        if (mode === 'TRACE_PIT') {
            if (state.pitLanePoints.length === 0 && state.currentTrack && state.currentTrack._pit_entry) {
                state.pitLanePoints.push(state.currentTrack._pit_entry);
                renderFeatures();
            }
        }
    }

    // Reset specific states if not needed
    if (mode !== 'TURN_POINT') state.activeTurnIndex = null;
    if (mode !== 'DEFINE_CURB_START' && mode !== 'DEFINE_CURB_END') state.activeCurbIndex = (mode && mode.startsWith('DEFINE_CURB')) ? curbIndex : null;

    // Re-assign correctly
    if (curbIndex !== null) state.activeCurbIndex = curbIndex;
    if (turnIndex !== null) state.activeTurnIndex = turnIndex;

    // Always re-render OSM Track to update point visibility based on mode
    renderOSMTrack();

    updateUIButtons();
    updateCurbList(); // Visual active state
}

function updateUIButtons() {
    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));

    if (state.editingMode === 'SF_LINE') document.getElementById('btn-sf-line').classList.add('active');
    if (state.editingMode === 'PIT_ENTRY') document.getElementById('btn-pit-entry').classList.add('active');
    if (state.editingMode === 'PIT_EXIT') document.getElementById('btn-pit-exit').classList.add('active');
    if (state.editingMode === 'TRACE_PIT') document.getElementById('btn-trace-pit').classList.add('active');
    if (state.editingMode === 'TRACE_PIT') document.getElementById('btn-trace-pit').classList.add('active');
    if (state.editingMode === 'EDIT_TRACK') document.getElementById('btn-edit-trace').classList.add('active');

    updateStatusIcon('btn-sf-line', !!state.currentTrack?._sf_point);
    updateStatusIcon('btn-pit-entry', !!state.currentTrack?._pit_entry);
    updateStatusIcon('btn-pit-exit', !!state.currentTrack?._pit_exit);
    updateStatusIcon('btn-trace-pit', state.pitLanePoints.length > 0);
    // updateStatusIcon('btn-add-curb', state.currentTrack?.curbs?.length > 0); // Removed button

    // Status for Delete Range (Active mode only)
    const btnDeleteRange = document.getElementById('btn-delete-range');
    if (state.editingMode === 'DELETE_RANGE') {
        btnDeleteRange.classList.add('active');
        // Maybe change icon or color if start point selected
        if (state.deleteRangeStart !== null) {
            btnDeleteRange.style.borderColor = 'orange';
        } else {
            btnDeleteRange.style.borderColor = '';
        }
    } else {
        if (btnDeleteRange) btnDeleteRange.style.borderColor = '';
    }

    const t = state.currentTrack;
    if (t) {
        const canTracePit = !!t._pit_entry && !!t._pit_exit;
        document.getElementById('btn-trace-pit').disabled = !canTracePit;
        document.getElementById('btn-undo-pit').disabled = state.pitLanePoints.length === 0;
        document.getElementById('btn-reset-pit').disabled = state.pitLanePoints.length === 0;

        document.getElementById('btn-trace-pit').title = !canTracePit ? "Set Pit Entry and Exit first" : "Draw pitlane path";

        const canSetPitWidth = state.pitLanePoints && state.pitLanePoints.length > 1;
        const pitWidthInput = document.getElementById('pit-width');
        pitWidthInput.disabled = !canSetPitWidth;
        pitWidthInput.parentElement.style.opacity = canSetPitWidth ? '1' : '0.5';

        // Track Edit Buttons
        document.getElementById('btn-undo-track').disabled = state.trackHistory.length === 0;
        document.getElementById('btn-delete-point').disabled = (state.selectedTrackPointIndex === null);

        // Enable Delete Range if track exists
        const hasTrack = state.currentTrack.geometry.main.polyline_geo && state.currentTrack.geometry.main.polyline_geo.length > 2;
        if (btnDeleteRange) btnDeleteRange.disabled = !hasTrack;

        document.getElementById('btn-reset-track').disabled = (!state.trackHistory.length && (!state.originalTrackGeo || JSON.stringify(state.originalTrackGeo) === JSON.stringify(state.currentTrack.geometry.main.polyline_geo)));

    } else {
        // Disable EVERYTHING in the sidebar tools if no track is selected
        const allBtns = document.querySelectorAll('.control-group button');
        allBtns.forEach(b => b.disabled = true);

        const allInputs = document.querySelectorAll('.control-group input');
        allInputs.forEach(i => i.disabled = true);

        // Opacity for visual feedback
        document.querySelectorAll('.control-group').forEach(g => {
            // Don't fade the selection group
            if (!g.querySelector('#venue-select')) {
                g.style.opacity = '0.5';
            }
        });
    }

    updateFeatureList();
}

function updateStatusIcon(btnId, complete) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const icon = btn.querySelector('.status-icon');
    if (icon) icon.textContent = complete ? '✓' : '';
}

function updateFeatureList() {
    const list = document.getElementById('feature-list');
    list.innerHTML = '';
    if (!state.currentTrack) return;
    const turns = state.currentTrack.turns || [];
    turns.forEach((turn, index) => {
        const div = document.createElement('div');
        div.className = 'feature-row';

        // Status Indicator
        const status = document.createElement('span');
        status.style.width = '20px';
        status.style.textAlign = 'center';
        status.style.color = '#00ff00';
        status.textContent = turn.geo_point ? '✓' : '';

        // Editable Name Input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = turn.name || `Turn ${index + 1}`;
        input.onchange = (e) => { turn.name = e.target.value; };

        // Placement Button
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>'; // Icon for placement
        btn.className = 'icon-btn';
        btn.title = 'Place on map';

        if (state.activeTurnIndex === index) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            // Toggle
            if (state.editingMode === 'TURN_POINT' && state.activeTurnIndex === index) {
                // Deselect
                state.editingMode = null;
                state.activeTurnIndex = null;
            } else {
                setMode('TURN_POINT', index);
            }
            renderFeatures(); // Highlight selected
            updateUIButtons(); // Refresh UI state
        });

        div.appendChild(status);
        div.appendChild(input);
        div.appendChild(btn);
        list.appendChild(div);
    });
}

// Start
init();

function updateCurbList() {
    const list = document.getElementById('curb-list');
    if (!list) return;
    list.innerHTML = '';

    if (!state.currentTrack || !state.currentTrack.curbs) return;

    state.currentTrack.curbs.forEach((c, index) => {
        const div = document.createElement('div');
        div.className = 'feature-row';
        div.style.display = 'grid';
        div.style.gridTemplateColumns = '20px 1fr auto auto';
        div.style.gap = '5px';
        div.style.alignItems = 'center';
        div.style.padding = '5px';
        div.style.borderRadius = '4px';
        div.style.cursor = 'default';

        div.onmouseenter = () => {
            state.highlightedCurbIndex = index;
            renderFeatures();
            div.style.backgroundColor = '#333';
        };
        div.onmouseleave = () => {
            state.highlightedCurbIndex = null;
            renderFeatures();
            div.style.backgroundColor = 'transparent';
        };

        const status = document.createElement('span');
        status.style.color = '#00ff00';
        status.style.fontSize = '12px';
        const isComplete = (c.start_index !== null && c.end_index !== null);
        status.textContent = isComplete ? '✓' : '•';
        status.style.color = isComplete ? '#00ff00' : '#666';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = c.name || `Curb ${index + 1}`;
        input.style.width = '100%';
        input.onchange = (e) => { c.name = e.target.value; renderFeatures(); };

        const btnPlace = document.createElement('button');
        btnPlace.className = 'icon-btn';
        btnPlace.title = 'Set Start/End';
        btnPlace.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
        if (state.activeCurbIndex === index && (state.editingMode === 'DEFINE_CURB_START' || state.editingMode === 'DEFINE_CURB_END')) {
            btnPlace.classList.add('active');
            if (state.editingMode === 'DEFINE_CURB_START') btnPlace.style.borderColor = 'orange';
            if (state.editingMode === 'DEFINE_CURB_END') btnPlace.style.borderColor = 'cyan';
        }
        btnPlace.onclick = () => {
            // If already active, cancel?
            if (state.activeCurbIndex === index) {
                setMode(null);
            } else {
                setMode('DEFINE_CURB_START', null, index); // Start defining this curb
            }
        };

        const btnDel = document.createElement('button');
        btnDel.className = 'icon-btn';
        btnDel.title = 'Remove Curb';
        btnDel.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btnDel.onclick = () => {
            if (confirm("Delete this curb?")) {
                state.currentTrack.curbs.splice(index, 1);
                updateCurbList();
                renderFeatures();
            }
        };

        div.appendChild(status);
        div.appendChild(input);
        div.appendChild(btnPlace);
        div.appendChild(btnDel);
        list.appendChild(div);
    });
}

// --- API / JWT Utils ---

function base64UrlEncode(data) {
    let str = "";
    if (typeof data === "string") {
        str = btoa(data);
    } else {
        str = btoa(String.fromCharCode(...data));
    }
    return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateJWT(secret) {
    if (!secret) return null;
    const encoder = new TextEncoder();
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        scope: "api_access"
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    try {
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(`${encodedHeader}.${encodedPayload}`)
        );

        const encodedSignature = base64UrlEncode(new Uint8Array(signature));
        return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    } catch (e) {
        console.error("JWT Generation Error", e);
        return null;
    }
}
