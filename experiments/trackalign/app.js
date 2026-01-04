
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
    activeSectorIndex: null, // If editing a sector
    highlightedCurbIndex: null, // Hover state
    highlightedSectorIndex: null, // Hover state
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

// Toast Helper
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');
    // slight delay to allow display:block to apply before opacity transition
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300); // match transition duration
    }, duration);
}

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
        setupCreationListeners();
        setupImportListeners();
        setupSettingsListeners();
        setupExportListener();
        setupSaveListener();

        // Filter Listener
        document.getElementById('filter-non-modified').addEventListener('change', () => {
            fetchTrackList(); // Refresh list on toggle
        });

        updateUIButtons(); // Initial State

    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

async function fetchTrackList() {
    if (!state.apiKey) return;
    try {
        const token = await generateJWT(state.apiKey);

        // Check filter
        const nonModified = document.getElementById('filter-non-modified')?.checked || false;
        const query = nonModified ? '?non_modified=true' : '';

        const res = await fetch(`${state.apiBase}/api-tracks-list${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch tracks");

        const list = (await res.json()).data;
        console.log("API Track List Sample:", list[0]); // DEBUG
        // List format: { id, venue, layout_name }
        // Map API 'id' to internal 'track_id' if needed
        state.tracks = list.map(t => {
            if (t.id && !t.track_id) t.track_id = t.id;
            // Ensure consistency if API uses 'id'
            return t;
        });
        state.venues = {}; // Reset

        state.tracks.forEach(t => {
            const group = t.track_name || t.venue || 'Unknown';
            t.venue = group; // Ensure venue property exists for logic
            if (!state.venues[group]) state.venues[group] = [];
            state.venues[group].push(t);
        });

        // Initialize Search (Clear it)
        setupVenueSearch();
        console.log(`Loaded ${state.tracks.length} tracks from API.`);

    } catch (e) {
        console.error("API Error", e);
        alert("Failed to fetch track list from API.");
    }
}

function setupVenueSearch(selectedGroup = null) {
    const input = document.getElementById('venue-search');
    if (selectedGroup) {
        input.value = selectedGroup;
        updateTrackSelect(selectedGroup);
    } else {
        input.value = '';
        updateTrackSelect(null);
    }
}

function updateTrackSelect(venue, selectedTrackId = null) {
    const sel = document.getElementById('track-select');
    sel.innerHTML = '<option value="">Select Track...</option>';
    sel.disabled = !venue;
    document.getElementById('btn-create-track').disabled = !venue; // Enable create track only if venue selected

    if (venue && state.venues[venue]) {
        state.venues[venue].forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t.track_id;
            opt.textContent = t.layout_name || t.track_id;
            if (t.track_id === selectedTrackId) opt.selected = true;
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
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(addr)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);

                    const countryCode = data[0].address?.country_code || "";
                    // Construct a street address if possible, or use display_name
                    // display_name is long. address parts: road, house_number, suburb, city...
                    // Let's use road + house_number if available, else first part of display_name
                    let streetAddr = data[0].address?.road || "";
                    if (data[0].address?.house_number) streetAddr = data[0].address.house_number + " " + streetAddr;
                    if (!streetAddr) streetAddr = data[0].display_name.split(',')[0];

                    state.venueLocations[name] = { lat, lon, country_code: countryCode, street_address: streetAddr };
                    console.log(`Geocoded '${addr}': ${lat}, ${lon}, ${countryCode}`);
                } else {
                    alert("Address not found. Venue created without coordinates.");
                }
            } catch (e) {
                console.error("Geocoding failed", e);
                alert("Geocoding failed. Check console.");
            }
        }

        venueModal.classList.add('hidden');
        venueModal.classList.add('hidden');
        setupVenueSearch(name); // Select it
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

        const venue = document.getElementById('venue-search').value;
        if (!venue) return alert("Select a venue first");

        // Resolve Center
        // Resolve Center & Metadata
        let center = { lat: 0, lon: 0 };
        let meta = { country_code: "", street_address: "" };

        if (state.venueLocations[venue]) {
            center = state.venueLocations[venue];
            meta.country_code = state.venueLocations[venue].country_code || "";
            meta.street_address = state.venueLocations[venue].street_address || "";
        } else {
            // Default to current map center if no venue location?
            // Or Keep 0,0
            const c = map.getCenter();
            center = { lat: c.lat, lon: c.lng };
        }

        // Generate specific ID schema: Track_Name__Track_Layout_Name
        // Sanitize: No special chars, underscores instead of spaces
        const sanitize = (str) => str.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        const trackId = `${sanitize(venue)}__${sanitize(name)}`;

        // Create Track Object
        const newTrack = {
            track_id: trackId, // Updated Schema
            venue: venue,
            track_name: venue, // Use the selected group as track_name
            layout_name: name,
            center: {
                geo_point: {
                    _latitude: center.lat,
                    _longitude: center.lon
                }
            },
            track_geometry: {
                polyline_geo: [
                    { _latitude: center.lat - 0.002, _longitude: center.lon },
                    { _latitude: center.lat + 0.002, _longitude: center.lon }
                ]
            },
            turns_and_straights: [],
            curbs: [],
            source_urls: { image: "" },
            country_code: meta.country_code,
            street_address: meta.street_address,
            isNew: true // Flag for API saving
        };

        state.tracks.push(newTrack);
        state.venues[venue].push(newTrack);

        trackModal.classList.add('hidden');
        updateTrackSelect(venue, newTrack.track_id);
        loadTrack(newTrack.track_id);
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

    // UI Loading State
    const loader = document.getElementById('track-loader');
    const select = document.getElementById('track-select');
    if (loader) loader.style.display = 'inline-block';
    if (select) select.disabled = true;

    // 1. Fetch Full Details
    // 1. Fetch Full Details
    try {
        // Find venue to get all sibling IDs
        let idsToFetch = [trackId];
        let venueName = null;

        // Find which venue group this track belongs to
        for (const [vName, tracks] of Object.entries(state.venues)) {
            if (tracks.find(t => t.track_id === trackId)) {
                venueName = vName;
                idsToFetch = tracks.map(t => t.track_id);
                break;
            }
        }

        // 1b. Check if track is NEW (local only)
        const currentLocal = state.tracks.find(t => t.track_id === trackId);
        if (currentLocal && currentLocal.isNew) {
            console.log("Track is new, skipping API fetch.");
            state.currentTrack = currentLocal;
        } else {
            const token = await generateJWT(state.apiKey);
            const res = await fetch(`${state.apiBase}/api-tracks-get`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: idsToFetch })
            });
            if (!res.ok) throw new Error("Failed to load track details");

            const responseData = await res.json();
            const data = responseData.data || responseData;
            const tracksData = Array.isArray(data) ? data : [data];

            if (!tracksData || tracksData.length === 0) throw new Error("Track not found in API response");

            // Update state.tracks with full details for ALL fetched tracks
            tracksData.forEach(fullTrack => {
                if (fullTrack.id && !fullTrack.track_id) fullTrack.track_id = fullTrack.id; // Map ID

                if (venueName) fullTrack.venue = venueName; // Preserve venue association
                const idx = state.tracks.findIndex(t => t.track_id === fullTrack.track_id);
                if (idx !== -1) {
                    state.tracks[idx] = fullTrack;
                } else {
                    // Should not happen if list is in sync, but maybe pushes
                    state.tracks.push(fullTrack);
                }
            });

            const apiTrack = tracksData.find(t => t.track_id === trackId);
            if (!apiTrack) throw new Error("Requested track ID not found in response");

            // Use API format directly
            state.currentTrack = apiTrack;
        }

        // Ensure arrays exist
        if (!state.currentTrack.turns_and_straights) state.currentTrack.turns_and_straights = [];
        if (!state.currentTrack.curbs) state.currentTrack.curbs = [];
        if (!state.currentTrack.sectors) state.currentTrack.sectors = [];

        // Ensure objects exist
        if (!state.currentTrack.start_finish) state.currentTrack.start_finish = { geo_point: null };
        if (!state.currentTrack.pit) state.currentTrack.pit = {
            entry: { geo_point: null },
            exit: { geo_point: null },
            polyline_geo: []
        };
        if (!state.currentTrack.pit.entry) state.currentTrack.pit.entry = { geo_point: null };
        if (!state.currentTrack.pit.exit) state.currentTrack.pit.exit = { geo_point: null };
        if (!state.currentTrack.pit.polyline_geo) state.currentTrack.pit.polyline_geo = [];

        // Ensure direction object exists (default to clockwise: true)
        if (!state.currentTrack.direction) {
            state.currentTrack.direction = { clockwise: true };
        } else if (state.currentTrack.direction.clockwise === undefined || state.currentTrack.direction.clockwise === null) {
            // If object exists but property is missing/null, default to true as per request
            state.currentTrack.direction.clockwise = true;
        }

        // Load Pit Lane Points for rendering/editing
        // Convert from API {_latitude, _longitude} to L.LatLng
        state.pitLanePoints = state.currentTrack.pit.polyline_geo.map(p => L.latLng(p._latitude, p._longitude));

        // Update the list entry in state.tracks with full data too?
        // Already done above for all siblings.
        // const idx = state.tracks.findIndex(t => t.id === trackId);
        // if (idx !== -1) state.tracks[idx] = apiTrack;

        // Enrich with Address if missing
        if ((!state.currentTrack.country_code || !state.currentTrack.street_address) && state.currentTrack.center?.geo_point?._latitude) {
            const lat = state.currentTrack.center.geo_point._latitude;
            const lon = state.currentTrack.center.geo_point._longitude;

            try {
                // Avoid redundant calls if 0,0
                if (Math.abs(lat) > 0.0001 && Math.abs(lon) > 0.0001) {
                    console.log(`Enriching track ${trackId} with address data...`);
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${lat},${lon}`);
                    // Search with coordinates often better done via 'reverse' endpoint, but 'search' with q=lat,lon also works or fails.
                    // Better to use reverse geocoding endpoint for coordinates:
                    // https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1
                    const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`);
                    const data = await reverseRes.json();

                    if (data && data.address) {
                        const countryCode = data.address.country_code || "";
                        let streetAddr = data.address.road || "";
                        if (data.address.house_number) streetAddr = data.address.house_number + " " + streetAddr;
                        if (!streetAddr) streetAddr = data.display_name ? data.display_name.split(',')[0] : "";

                        state.currentTrack.country_code = countryCode;
                        state.currentTrack.street_address = streetAddr;
                        console.log(`Enriched: ${streetAddr}, ${countryCode}`);
                    }
                }
            } catch (err) {
                console.warn("Auto-enrichment failed", err);
            }
        }

    } catch (e) {
        console.error("Load Track Error", e);
        alert("Failed to load track details.");
        return;
    } finally {
        if (loader) loader.style.display = 'none';
        if (select) select.disabled = false;
    }

    const track = state.currentTrack;

    // ensure curbs array exists
    if (!state.currentTrack.curbs) state.currentTrack.curbs = [];

    // state.pitLanePoints already loaded above from API structure
    // state.pitLanePoints = state.currentTrack._pit_path ? [...state.currentTrack._pit_path] : [];
    state.editingMode = null;
    state.selectedTrackPointIndex = null;

    // History Init
    if (state.currentTrack.track_geometry && state.currentTrack.track_geometry.polyline_geo) {
        state.originalTrackGeo = JSON.parse(JSON.stringify(state.currentTrack.track_geometry.polyline_geo));
    } else {
        // Handle empty geometry
        if (!state.currentTrack.track_geometry) state.currentTrack.track_geometry = { polyline_geo: [] };
    }
    state.trackHistory = [];

    updateUIButtons();

    console.log("Loaded Track:", track);

    // 1. Center Map
    if (track.center?.geo_point) {
        map.setView([track.center.geo_point._latitude, track.center.geo_point._longitude], 16);
    } else if (track.track_geometry?.polyline_geo && track.track_geometry.polyline_geo.length > 0) {
        const p = track.track_geometry.polyline_geo[0];
        map.setView([p._latitude, p._longitude], 16);
    }

    loadRefImage(track);

    // 2. Render OSM Track
    renderOSMTrack();

    // 3. Set Reference Image
    loadRefImage(track);

    // 4. Render Features
    renderFeatures();
    renderTrackWidth();

    updateFeatureList();
    updateFeatureList();
    updateCurbList();
    updateSectorList();


    // 5. Check for Imports
    checkForSiblingEdits(track);

    // 6. Update Location Inputs
    const addrInput = document.getElementById('track-address');
    const latInput = document.getElementById('center-lat');
    const lonInput = document.getElementById('center-lon');

    // Address
    let fullAddr = track.street_address || "";
    // If we have country code but it's not in address, maybe append? 
    // Usually street_address is enough. 
    addrInput.value = fullAddr;

    // Center
    if (track.center && track.center.geo_point) {
        latInput.value = track.center.geo_point._latitude.toFixed(6);
        lonInput.value = track.center.geo_point._longitude.toFixed(6);
    } else {
        latInput.value = '';
        lonInput.value = '';
    }
}

function checkForSiblingEdits(track) {
    if (!track.venue) return;

    const siblings = state.tracks.filter(t => t.venue === track.venue && t.track_id !== track.track_id);
    const updatedSiblings = siblings.filter(t => {
        // Check for specific flag or heuristic
        return t.has_been_updated === true ||
            (t.start_finish?.geo_point || t.pit?.entry?.geo_point || t.pit?.exit?.geo_point || (t.curbs && t.curbs.length > 0) || (t.sectors && t.sectors.length > 0) || (t.turns_and_straights && t.turns_and_straights.some(turn => turn.geo_point)));
    });

    if (updatedSiblings.length > 0) {
        const modal = document.getElementById('import-modal');
        const select = document.getElementById('import-source-select');
        select.innerHTML = '';

        updatedSiblings.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.track_id;
            opt.textContent = s.layout_name || s.track_id;
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

        console.log("import");

        const select = document.getElementById('import-source-select');
        const sourceId = select.value;
        const sourceTrack = state.tracks.find(t => String(t.track_id) === String(sourceId));

        if (!sourceTrack) {
            console.error("Import failed: Source track not found for ID", sourceId);
            return;
        }

        const target = state.currentTrack;

        if (document.getElementById('import-sf').checked) {
            target.start_finish = sourceTrack.start_finish ? JSON.parse(JSON.stringify(sourceTrack.start_finish)) : { geo_point: null };
        }
        if (document.getElementById('import-pit').checked) {
            // Deep copy pit object
            if (sourceTrack.pit) {
                target.pit = JSON.parse(JSON.stringify(sourceTrack.pit));
                // Update active points
                if (target.pit.polyline_geo) {
                    state.pitLanePoints = target.pit.polyline_geo.map(p => L.latLng(p._latitude, p._longitude));
                } else {
                    state.pitLanePoints = [];
                }
            }
        }
        if (document.getElementById('import-geo').checked) {
            if (sourceTrack.track_geometry?.polyline_geo) {
                saveTrackHistory();
                target.track_geometry.polyline_geo = JSON.parse(JSON.stringify(sourceTrack.track_geometry.polyline_geo));
            }
        }
        if (document.getElementById('import-turns').checked) {
            if (sourceTrack.turns_and_straights) {
                target.turns_and_straights = JSON.parse(JSON.stringify(sourceTrack.turns_and_straights));
            }
        }
        if (document.getElementById('import-curbs').checked) {
            if (sourceTrack.curbs) {
                target.curbs = JSON.parse(JSON.stringify(sourceTrack.curbs));
            }
        }
        if (document.getElementById('import-sectors')?.checked) { // Assuming UI checkbox exists or we autolink it?
            if (sourceTrack.sectors) {
                target.sectors = JSON.parse(JSON.stringify(sourceTrack.sectors));
            }
        }

        renderOSMTrack();
        renderFeatures();
        updateFeatureList();
        updateFeatureList();
        updateCurbList();
        updateSectorList();
        updateUIButtons();
        document.getElementById('import-modal').classList.add('hidden');
    });
}

function setupExportListener() {
    document.getElementById('export-btn').addEventListener('click', () => {


        console.log("export");


        if (!state.currentTrack) return;

        const exportData = JSON.parse(JSON.stringify(state.currentTrack));

        // Remove legacy internal fields if they exist
        delete exportData._pit_path;
        delete exportData.osm;
        delete exportData.source_urls;

        // Calculate and add length
        if (state.currentTrack.track_geometry?.polyline_geo) {
            exportData.length_km = calculateTrackLength(state.currentTrack.track_geometry.polyline_geo);
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (state.currentTrack.track_id || "track") + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
}

function setupSaveListener() {
    document.getElementById('save-btn').addEventListener('click', async () => {
        if (!state.currentTrack) return;

        const btn = document.getElementById('save-btn');
        const originalText = btn.textContent;
        btn.textContent = "Saving...";
        btn.disabled = true;

        try {
            const track = JSON.parse(JSON.stringify(state.currentTrack));

            // Cleanup internal fields
            delete track._pit_path;
            delete track._sf_point;
            delete track._pit_entry;
            delete track._pit_exit;
            delete track.venue;
            delete track.osm;
            delete track.source_urls;
            track.id = track.track_id;

            // Check if new or existing
            const isNew = !!track.isNew;
            delete track.isNew; // Don't send this flag to API

            track.has_been_updated = true;

            // Calculate length if geometry exists
            if (track.track_geometry && track.track_geometry.polyline_geo) {
                track.length_km = calculateTrackLength(track.track_geometry.polyline_geo);
                console.log("Calculated Length: " + track.length_km + " km");
            }

            const endpoint = isNew ? '/api-tracks-add' : '/api-tracks-update';
            const url = `${state.apiBase}${endpoint}`;

            console.log(`Saving track to ${url}...`);

            const token = await generateJWT(state.apiKey);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(track)
            });

            if (res.ok) {
                const updatedTrack = (await res.json()).data || track; // Use returned data if available
                state.currentTrack.has_been_updated = true;

                // If it was new, we might need to update ID or refresh list? 
                // Currently API returns the object. Ideally we update state.tracks[idx] with response.
                // But for now, just success.
                showToast("Track saved successfully!");
            } else {
                throw new Error("API responded with " + res.status);
            }

        } catch (e) {
            console.error("Save Error:", e);
            alert("Failed to save track: " + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

function loadRefImage(track) {
    if (!track?.source_urls?.saved_image_location) {
        document.getElementById('ref-window').classList.add('hidden');
        return;
    }

    let imgUrl = track.source_urls.saved_image_location;
    const refWindow = document.getElementById('ref-window');
    const img = document.getElementById('ref-img');

    if (imgUrl) {
        imgUrl = imgUrl.replace('Results_v2/Results/', 'assets/tracks/');
        img.src = imgUrl;
        refWindow.classList.remove('hidden');
    } else {
        refWindow.classList.add('hidden');
    }
}

function saveTrackHistory() {
    // Use correct path for history
    if (!state.currentTrack?.track_geometry?.polyline_geo) return;
    const geoCopy = JSON.parse(JSON.stringify(state.currentTrack.track_geometry.polyline_geo));
    state.trackHistory.push(geoCopy);
    if (state.trackHistory.length > 20) state.trackHistory.shift();
    updateUIButtons();
}

function renderOSMTrack() {
    if (state.layers.osm) map.removeLayer(state.layers.osm);

    if (!state.layers.trackPoints) state.layers.trackPoints = L.layerGroup().addTo(map);
    state.layers.trackPoints.clearLayers();

    // Use correct path
    const geoPoints = state.currentTrack?.track_geometry?.polyline_geo;
    if (!geoPoints || geoPoints.length === 0) return;

    // Map internal structure to Leaflet [lat, lon]
    const latLngs = geoPoints.map(p => [p._latitude, p._longitude]);

    state.layers.osm = L.polyline(latLngs, {
        color: '#ff3333',
        weight: 2,
        opacity: 0.8,
        interactive: false
    }).addTo(map);

    if (state.editingMode === 'EDIT_TRACK' || state.editingMode === 'DELETE_RANGE') {
        state.layers.trackPoints.addTo(map);

        geoPoints.forEach((p, i) => {
            const lat = p._latitude;
            const lon = p._longitude;

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
                }
            } else {
                if (!isSelected) {
                    if (isStart) color = '#00ff00'; // Green first
                    if (isEnd) color = '#ff0000';   // Red last
                }
            }

            // Visible point
            const visibleMarker = L.circleMarker([lat, lon], {
                color: color,
                fillColor: isSelected ? '#0088ff' : '#333',
                fillOpacity: 1,
                radius: isSelected ? 6 : 4,
                weight: 2,
                interactive: false,
                pane: 'trackPoints'
            }).addTo(state.layers.trackPoints);

            // Hit target
            const inputM = L.circleMarker([lat, lon], {
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
            const geo = state.currentTrack.track_geometry.polyline_geo;
            const segment = geo.slice(min, max + 1).map(p => [p._latitude, p._longitude]);

            const redLine = L.polyline(segment, { color: 'red', weight: 6, opacity: 0.8 }).addTo(map);

            setTimeout(() => {
                if (confirm(`Delete ${count} points from index ${min} to ${max}?`)) {
                    saveTrackHistory();
                    // Remove points.
                    // If we remove min to max inclusive:
                    state.currentTrack.track_geometry.polyline_geo.splice(min, count);

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
            const geo = state.currentTrack.track_geometry.polyline_geo;

            // Check for Loop Closure (Start <-> End)
            if (min === 0 && max === geo.length - 1) {
                const pStart = geo[min];
                const pEnd = geo[max];

                // Calculate distance (very rough, squares) to see if we should snap or append
                // Actually, safer to always append unless they are IDENTICAL.
                // If the user manually placed the last point ON TOP of the first, maybe they want to merge?
                // But usually, "Click" means "Add segment".

                // Check exact equality to prevent infinite stacking if user keeps clicking
                if (pStart._longitude === pEnd._longitude && pStart._latitude === pEnd._latitude) {
                    console.log("Loop already closed");
                    state.selectedTrackPointIndex = null; // Auto deselect
                } else {
                    // Append a new point closing the loop
                    geo.push({ _longitude: pStart._longitude, _latitude: pStart._latitude });
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
    const geo = state.currentTrack.track_geometry.polyline_geo;

    if (state.editingMode === 'DEFINE_CURB_START') {
        curb.start_index = index;

        // Determine Side: Left or Right?
        // We need the tangent at this point.
        // Approx: point[i+1] - point[i-1]
        const p = geo[index];
        const pNext = geo[Math.min(index + 1, geo.length - 1)];
        const pPrev = geo[Math.max(index - 1, 0)];

        // Vector of track
        let dx = pNext._longitude - pPrev._longitude;
        let dy = pNext._latitude - pPrev._latitude;
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

        const cLon = e.latlng.lng - p._longitude;
        const cLat = e.latlng.lat - p._latitude;

        const cross = dx * cLat - dy * cLon;

        curb.side = (cross > 0) ? 'left' : 'right';
        console.log(`Curb Start: ${index}, Side: ${curb.side}`);

        setMode('DEFINE_CURB_END', null, state.activeCurbIndex);
        updateCurbList();
    } else if (state.editingMode === 'DEFINE_CURB_END') {
        const curb = state.currentTrack.curbs[state.activeCurbIndex];
        // We do NOT swap min/max anymore, to allow wrap-around
        // Assume user clicks in order Direction of Travel
        curb.end_index = index;

        setMode(null);
        state.activeCurbIndex = null;
        updateCurbList();
        renderFeatures();
    }
}

function handleSectorClick(index, e) {
    if (state.activeSectorIndex === null) return;
    const sector = state.currentTrack.sectors[state.activeSectorIndex];

    if (state.editingMode === 'DEFINE_SECTOR_START') {
        sector.start_index = index;
        console.log(`Sector Start: ${index}`);

        setMode('DEFINE_SECTOR_END');
        updateSectorList();
    } else if (state.editingMode === 'DEFINE_SECTOR_END') {
        sector.end_index = index;

        setMode(null);
        state.activeSectorIndex = null;
        updateUIButtons();
        updateSectorList();
        renderFeatures();
    }
}


function deletePoint(index) {
    if (state.currentTrack.track_geometry.polyline_geo.length > 2) {
        saveTrackHistory();
        state.currentTrack.track_geometry.polyline_geo.splice(index, 1);
        state.selectedTrackPointIndex = null;
        renderOSMTrack();
        renderTrackWidth();
        updateUIButtons();
    }
}

function renderTrackWidth() {
    if (state.layers.trackWidth) map.removeLayer(state.layers.trackWidth);

    const geoPoints = state.currentTrack.track_geometry.polyline_geo;
    if (!geoPoints || geoPoints.length === 0) return;

    const latLngs = geoPoints.map(p => [p._latitude, p._longitude]);

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

    if (state.layers.preview) state.layers.preview.clearLayers();
    else state.layers.preview = L.layerGroup().addTo(map);

    if (state.layers.interaction) state.layers.interaction.clearLayers();
    else state.layers.interaction = L.layerGroup().addTo(map);

    if (state.layers.pitLane) state.layers.pitLane.clearLayers();
    else state.layers.pitLane = L.layerGroup().addTo(map);
    if (!state.currentTrack) return;

    // Projection Constants
    const centerLat = map.getCenter().lat;
    const metersPerDegreeLat = 111132.92;
    const metersPerDegreeLon = 111412.84 * Math.cos(centerLat * Math.PI / 180);
    const widthMeters = state.trackWidth / 2;

    if (state.currentTrack.start_finish?.geo_point) {
        // Find orientation
        const geo = state.currentTrack.track_geometry.polyline_geo;
        const sfLatLng = state.currentTrack.start_finish.geo_point;
        if (geo) {
            const info = getNearestSegmentIndex(L.latLng(sfLatLng._latitude, sfLatLng._longitude), geo);
            if (info.index !== -1) {
                const p1 = geo[info.index];
                const p2 = geo[info.index + 1];
                let dx = p2._longitude - p1._longitude;
                let dy = p2._latitude - p1._latitude;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    dx /= len; dy /= len;
                    // Normal
                    const nx = -dy;
                    const ny = dx;

                    const offLon = (nx * widthMeters) / metersPerDegreeLon;
                    const offLat = (ny * widthMeters) / metersPerDegreeLat;

                    const lineStart = [sfLatLng._latitude + offLat, sfLatLng._longitude + offLon];
                    const lineEnd = [sfLatLng._latitude - offLat, sfLatLng._longitude - offLon];

                    L.polyline([lineStart, lineEnd], { color: '#00ff00', weight: 4 }).addTo(state.layers.features).bindTooltip("Start/Finish Line");
                }
            }
        }
    }

    if (state.currentTrack.pit?.entry?.geo_point) {
        L.circleMarker([state.currentTrack.pit.entry.geo_point._latitude, state.currentTrack.pit.entry.geo_point._longitude], { color: 'magenta', radius: 5 }).addTo(state.layers.features).bindTooltip("Pit In");
    }
    if (state.currentTrack.pit?.exit?.geo_point) {
        L.circleMarker([state.currentTrack.pit.exit.geo_point._latitude, state.currentTrack.pit.exit.geo_point._longitude], { color: 'magenta', radius: 5 }).addTo(state.layers.features).bindTooltip("Pit Out");
    }

    if (state.currentTrack.curbs) {
        // Render Lines offset from track
        const geo = state.currentTrack.track_geometry.polyline_geo;

        state.currentTrack.curbs.forEach((c, i) => {
            if (typeof c.start_index === 'number' && typeof c.end_index === 'number') {
                const pts = [];

                const addSegment = (start, end) => {
                    for (let k = start; k <= end; k++) {
                        const p = geo[k];
                        // Calculate Normal
                        const pNext = geo[Math.min(k + 1, geo.length - 1)];
                        const pPrev = geo[Math.max(k - 1, 0)];
                        let dx = pNext._longitude - pPrev._longitude;
                        let dy = pNext._latitude - pPrev._latitude;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len === 0) continue;
                        dx /= len; dy /= len;
                        let nx = -dy; let ny = dx;
                        if (c.side === 'right') { nx = -nx; ny = -ny; }
                        const offLon = (nx * widthMeters) / metersPerDegreeLon;
                        const offLat = (ny * widthMeters) / metersPerDegreeLat;
                        pts.push([p._latitude + offLat, p._longitude + offLon]);
                    }
                };

                if (c.start_index <= c.end_index) {
                    addSegment(c.start_index, c.end_index);
                } else {
                    // Wrap around
                    addSegment(c.start_index, geo.length - 1);
                    addSegment(0, c.end_index);
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

    if (state.currentTrack.sectors) {
        // Render Sectors (Highlighted track segments)
        // Distinct color, slightly wider?
        const geo = state.currentTrack.track_geometry.polyline_geo;
        state.currentTrack.sectors.forEach((s, i) => {
            if (typeof s.start_index === 'number' && typeof s.end_index === 'number') {
                const pts = [];

                const addSegment = (start, end) => {
                    for (let k = start; k <= end; k++) {
                        const p = geo[k];
                        pts.push([p._latitude, p._longitude]);
                    }
                };

                if (s.start_index <= s.end_index) {
                    addSegment(s.start_index, s.end_index);
                } else {
                    // Wrap around
                    addSegment(s.start_index, geo.length - 1);
                    addSegment(0, s.end_index);
                }

                const isHighlighted = (i === state.highlightedSectorIndex);
                L.polyline(pts, {
                    color: isHighlighted ? 'cyan' : '#00ffff',
                    weight: isHighlighted ? 12 : 8,
                    opacity: isHighlighted ? 0.6 : 0.3,
                    interactive: false
                }).addTo(state.layers.features)
                    .bindTooltip(s.name || `Sector ${i + 1}`);
            }
        });
    }
    if (state.currentTrack.turns_and_straights) {
        state.currentTrack.turns_and_straights.forEach((t, i) => {
            if (t.geo_point) {
                const m = L.circleMarker([t.geo_point._latitude, t.geo_point._longitude], { color: 'yellow', radius: 4 }).addTo(state.layers.features);
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
// --- Helper Functions ---

function restoreTrackHistory() {
    if (state.trackHistory.length === 0) return;
    const prevGeo = state.trackHistory.pop();
    // Restore structure
    state.currentTrack.track_geometry.polyline_geo = prevGeo;
    renderOSMTrack();
    renderFeatures();
    updateUIButtons();
    updateFeatureList();
    updateFeatureList();
    updateCurbList();
    updateSectorList();
}

function findNearestPointOnPolyline(latlng, polyline) {
    let minDist = Infinity;
    let nearestPoint = null;
    let nearestIndex = -1;

    // Use internal structure
    const geoPoints = state.currentTrack.track_geometry.polyline_geo;
    if (!geoPoints) return null;

    // We can use built-in Leaflet utils if we map points, but manual is fine for exact points
    // Actually, we usually want closest point on SEGMENT.
    // L.GeometryUtil.closest(map, polyline, latlng) requires the layer.
    // We have state.layers.osm.

    if (state.layers.osm) {
        // This returns LatLng object
        const p = L.GeometryUtil.closest(map, state.layers.osm, latlng);
        if (p) {
            // Find segment index? Not easy.
            // Let's implement simple point check if we only snap to vertices (which we don't, we want segments).
            // But we accept the snapped point.
            // Return { lat: p.lat, lon: p.lng }
            return { lat: p.lat, lon: p.lng };
        }
    }
    return null;
}

function getNearestPointOnPolyline(latlng, polylineGeo) {
    let minDist = Infinity;
    let nearestLatLng = null;
    for (let i = 0; i < polylineGeo.length - 1; i++) {
        const lat1 = polylineGeo[i]._latitude;
        const lon1 = polylineGeo[i]._longitude;
        const lat2 = polylineGeo[i + 1]._latitude;
        const lon2 = polylineGeo[i + 1]._longitude;
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
// Helper to shift indices when a point is inserted
function adjustFeatureIndices(insertionIndex) {
    if (!state.currentTrack) return;

    // Shift Curbs
    if (state.currentTrack.curbs) {
        state.currentTrack.curbs.forEach(c => {
            if (typeof c.start_index === 'number' && c.start_index >= insertionIndex) c.start_index++;
            if (typeof c.end_index === 'number' && c.end_index >= insertionIndex) c.end_index++;
        });
    }

    // Shift Sectors
    if (state.currentTrack.sectors) {
        state.currentTrack.sectors.forEach(s => {
            if (typeof s.start_index === 'number' && s.start_index >= insertionIndex) s.start_index++;
            if (typeof s.end_index === 'number' && s.end_index >= insertionIndex) s.end_index++;
        });
    }

    // Shift Turns/Straights? (If used)
    if (state.currentTrack.turns_and_straights) {
        state.currentTrack.turns_and_straights.forEach(t => {
            if (typeof t.start_index === 'number' && t.start_index >= insertionIndex) t.start_index++;
            if (typeof t.end_index === 'number' && t.end_index >= insertionIndex) t.end_index++;
        });
    }
}

function getNearestSegmentIndex(latlng, polylineGeo) {
    let minDist = Infinity;
    let index = -1;
    let insertionPoint = null;
    for (let i = 0; i < polylineGeo.length - 1; i++) {
        const lat1 = polylineGeo[i]._latitude;
        const lon1 = polylineGeo[i]._longitude;
        const lat2 = polylineGeo[i + 1]._latitude;
        const lon2 = polylineGeo[i + 1]._longitude;
        const closest = getClosestPointOnSegment(latlng.lat, latlng.lng, lat1, lon1, lat2, lon2);
        const currentLatLng = L.latLng(closest.lat, closest.lng);
        const dist = latlng.distanceTo(currentLatLng);
        if (dist < minDist) { minDist = dist; index = i; insertionPoint = currentLatLng; }
    }
    return { index, point: insertionPoint };
}

function calculateTrackLength(polylineGeo) {
    if (!polylineGeo || polylineGeo.length < 2) return 0;
    let distMeters = 0;
    for (let i = 0; i < polylineGeo.length; i++) {
        // Loop? usually track is closed loop if index.html says so? 
        // Logic: Standard Open Loop for drawing, closed logic handled elsewhere?
        // App seems to treat polyline as open strip of points.
        // If it's a loop, first and last point should be same, or we imply it?
        // Let's assume sequential points.
        if (i < polylineGeo.length - 1) {
            const p1 = L.latLng(polylineGeo[i]._latitude, polylineGeo[i]._longitude);
            const p2 = L.latLng(polylineGeo[i + 1]._latitude, polylineGeo[i + 1]._longitude);
            distMeters += p1.distanceTo(p2);
        }
    }
    // Check if we should close the loop? 
    // Usually tracks are loops. If start != end, maybe add segment?
    // Let's stick to explicit geometry length for now.
    return parseFloat((distMeters / 1000).toFixed(3));
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
            state.currentTrack.track_geometry.polyline_geo[state.draggingTrackPointIndex] = { _longitude: e.latlng.lng, _latitude: e.latlng.lat };
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
            else if (state.currentTrack?.pit?.entry?.geo_point) startPoint = L.latLng(state.currentTrack.pit.entry.geo_point._latitude, state.currentTrack.pit.entry.geo_point._longitude);

            let targetPoint = e.latlng;
            const pitExit = state.currentTrack?.pit?.exit?.geo_point;
            if (pitExit) {
                const pitExitLatLng = L.latLng(pitExit._latitude, pitExit._longitude);
                const dist = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(pitExitLatLng));
                if (dist < 20) {
                    targetPoint = pitExitLatLng;
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
            const geo = state.currentTrack?.track_geometry?.polyline_geo;
            if (geo) {
                // 5a. If Selection Active: Rubber band
                if (state.selectedTrackPointIndex !== null) {
                    if (state.layers.interaction) state.layers.interaction.clearLayers();
                    else state.layers.interaction = L.layerGroup().addTo(map);

                    const p = geo[state.selectedTrackPointIndex];
                    const start = L.latLng(p._latitude, p._longitude);

                    L.polyline([start, e.latlng], { color: '#0088ff', weight: 1, dashArray: '4,4' }).addTo(state.layers.interaction);
                    return;
                }

                // 5b. Normal Ghost Insert Check
                const closeToPoint = geo.some(p => {
                    const pll = L.latLng(p._latitude, p._longitude);
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
        const geo = state.currentTrack?.track_geometry?.polyline_geo;
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

    // Live Preview Handler
    map.on('mousemove', (e) => {
        if (!state.currentTrack || !state.currentTrack.track_geometry?.polyline_geo) return;
        if (!state.layers.preview) return; // Guard

        // Only for END definition modes
        if (state.editingMode !== 'DEFINE_CURB_END' && state.editingMode !== 'DEFINE_SECTOR_END') {
            if (state.layers.preview.getLayers().length > 0) state.layers.preview.clearLayers();
            return;
        }

        const geo = state.currentTrack.track_geometry.polyline_geo;
        let startIndex = null;
        let style = {};

        // Get Start Index based on mode
        if (state.editingMode === 'DEFINE_CURB_END') {
            if (state.activeCurbIndex === null) return;
            const c = state.currentTrack.curbs[state.activeCurbIndex];
            if (!c || typeof c.start_index !== 'number') return;
            startIndex = c.start_index;
            style = { color: 'red', weight: 4, opacity: 0.6, dashArray: '5, 5' };
        } else if (state.editingMode === 'DEFINE_SECTOR_END') {
            if (state.activeSectorIndex === null) return;
            const s = state.currentTrack.sectors[state.activeSectorIndex];
            if (!s || typeof s.start_index !== 'number') return;
            startIndex = s.start_index;
            style = { color: 'cyan', weight: 6, opacity: 0.6 };
        }

        if (startIndex === null) return;

        // Calculate Project Point
        // We use the same 'clamped' logic as click
        const snapped = getNearestPointOnPolyline(e.latlng, geo);
        if (!snapped) return;

        // Find which segment this snapped point belongs to
        // We need the numeric index. getNearestPointOnPolyline doesn't return it directly, 
        // but we can look it up or use getNearestSegmentIndex logic.
        const segInfo = getNearestSegmentIndex(e.latlng, geo);
        if (segInfo.index === -1) return;

        // Build path: Start Point -> Intermediate Points -> Snapped Point
        // CAUTION: Direction? User might go backwards. 
        // For simplicity, we assume forward or handle loop?
        // Let's assume smallest path or just linear forward for now.
        // If end < start (wrap around?), logic gets complex. 
        // Simple linear implementation first:

        // Check for Offset Logic (Curbs)
        const isCurb = (state.editingMode === 'DEFINE_CURB_END');
        let curbSide = null;
        if (isCurb) {
            const c = state.currentTrack.curbs[state.activeCurbIndex];
            curbSide = c ? c.side : null;
        }

        // Projection Helper Vars
        const centerLat = map.getCenter().lat;
        const metersPerDegreeLat = 111132.92;
        const metersPerDegreeLon = 111412.84 * Math.cos(centerLat * Math.PI / 180);
        const widthMeters = state.trackWidth / 2;

        const getOffsetPoint = (p, pPrev, pNext) => {
            if (!isCurb || !curbSide) return L.latLng(p._latitude, p._longitude);

            let dx = pNext._longitude - pPrev._longitude;
            let dy = pNext._latitude - pPrev._latitude;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return L.latLng(p._latitude, p._longitude);

            dx /= len; dy /= len;
            let nx = -dy;
            let ny = dx;

            if (curbSide === 'right') { nx = -nx; ny = -ny; }

            const offLon = (nx * widthMeters) / metersPerDegreeLon;
            const offLat = (ny * widthMeters) / metersPerDegreeLat;

            return L.latLng(p._latitude + offLat, p._longitude + offLon);
        };

        let pathPts = [];

        // Build raw indices first 
        let rawIndices = [];
        if (segInfo.index >= startIndex) {
            // Forward
            for (let i = startIndex; i <= segInfo.index; i++) rawIndices.push(i);
        } else {
            // Loop
            for (let i = startIndex; i < geo.length; i++) rawIndices.push(i);
            for (let i = 0; i <= segInfo.index; i++) rawIndices.push(i);
        }

        // Convert to LatLngs (with offset if needed)
        // We need Context (Prev/Next) for offset normal
        // For the snapped point (last point), we use the segment orientation

        rawIndices.forEach((idx) => {
            const p = geo[idx];
            const pNext = geo[Math.min(idx + 1, geo.length - 1)]; // Or wrap?
            const pPrev = geo[Math.max(idx - 1, 0)]; // Or wrap?
            // Actually, best to use the segment vector [idx, idx+1] for standard block
            // But for vertex-based offset, taking average of prev/next segments is smoother?
            // renderFeatures uses standard "Next - Prev" tangent
            pathPts.push(getOffsetPoint(p, pPrev, pNext));
        });

        // Add Snapped Point
        // Calculate offset for snapped point using the CURRENT segment slope
        if (isCurb) {
            const p1 = geo[segInfo.index];
            const p2 = geo[segInfo.index + 1] || geo[0]; // Wrap logic if loop
            // Just use p1->p2 vector
            let dx = p2._longitude - p1._longitude;
            let dy = p2._latitude - p1._latitude;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                dx /= len; dy /= len;
                let nx = -dy; let ny = dx;
                if (curbSide === 'right') { nx = -nx; ny = -ny; }
                const offLon = (nx * widthMeters) / metersPerDegreeLon;
                const offLat = (ny * widthMeters) / metersPerDegreeLat;
                pathPts.push(L.latLng(snapped.lat + offLat, snapped.lng + offLon));
            } else {
                pathPts.push(snapped);
            }
        } else {
            pathPts.push(snapped);
        }

        state.layers.preview.clearLayers();
        L.polyline(pathPts, style).addTo(state.layers.preview);
    });

    map.on('click', async (e) => {
        // Clear preview immediately on click
        if (state.layers.preview) state.layers.preview.clearLayers();

        if (!state.editingMode) return;

        // Define Center
        if (state.editingMode === 'DEFINE_CENTER') {
            if (!state.currentTrack) return;

            // Update Center
            if (!state.currentTrack.center) state.currentTrack.center = {};
            state.currentTrack.center.geo_point = { _latitude: e.latlng.lat, _longitude: e.latlng.lng };

            // Update Inputs
            document.getElementById('center-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('center-lon').value = e.latlng.lng.toFixed(6);

            // Reverse Geocode
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&addressdetails=1`);
                const data = await res.json();
                if (data && data.address) {
                    const countryCode = data.address.country_code || "";
                    let streetAddr = data.address.road || "";
                    if (data.address.house_number) streetAddr = data.address.house_number + " " + streetAddr;
                    if (!streetAddr) streetAddr = data.display_name ? data.display_name.split(',')[0] : "";

                    state.currentTrack.country_code = countryCode;
                    state.currentTrack.street_address = streetAddr;
                    document.getElementById('track-address').value = streetAddr; // Update UI
                }
            } catch (err) {
                console.warn("Reverse geocode failed", err);
            }

            setMode(null); // Exit mode
            return;
        }

        // Edit Track
        if (state.editingMode === 'EDIT_TRACK') {
            const geo = state.currentTrack?.track_geometry?.polyline_geo;
            if (geo) {
                // 1. If Selected: Insert point connected to it (Trace)
                if (state.selectedTrackPointIndex !== null) {
                    // Check for snap to existing (LOOP CLOSURE or MERGE)
                    // Use the SNAPPED point to check distance to vertices
                    const clickedSnapped = getNearestPointOnPolyline(e.latlng, geo);
                    if (!clickedSnapped) return;

                    let nearestIdx = -1;
                    let minD = Infinity;
                    geo.forEach((p, i) => {
                        const d = clickedSnapped.distanceTo(L.latLng(p._latitude, p._longitude));
                        if (d < minD) { minD = d; nearestIdx = i; }
                    });

                    console.log(`[Snap Debug] Nearest Point Dist: ${minD.toFixed(2)}m (Idx: ${nearestIdx})`);

                    if (nearestIdx !== -1 && minD < 5) {
                        // User clicked very close to an existing point.
                        // Instead of inserting, maybe they want to select it?
                        // Or Connect? Use case: Tracing.
                        // If we are tracing, and click existing, usually implies closing loop or joining.
                        // For now, let's just SELECT that point to avoid duplicate
                        state.selectedTrackPointIndex = nearestIdx;
                        renderFeatures(); // Highlight selection
                    } else {
                        saveTrackHistory();
                        const idx = state.selectedTrackPointIndex;
                        geo.splice(idx + 1, 0, { _longitude: e.latlng.lng, _latitude: e.latlng.lat });
                        adjustFeatureIndices(idx + 1); // Shift indices
                        state.selectedTrackPointIndex = idx + 1; // Advance selection
                        renderOSMTrack();
                        renderTrackWidth();
                    }
                } else {
                    // 2. Normal Segment Insert
                    // Check snap first? If clicking ON a point, select it?
                    // Already handled by layer interactions?
                    // Snap Logic for Insert
                    const info = getNearestSegmentIndex(e.latlng, geo);
                    if (info.index !== -1 && info.point) {
                        saveTrackHistory();
                        geo.splice(info.index + 1, 0, { _longitude: info.point.lng, _latitude: info.point.lat });
                        adjustFeatureIndices(info.index + 1); // Shift indices
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
            const pitExit = state.currentTrack?.pit?.exit?.geo_point;
            if (pitExit) {
                const pitExitLatLng = L.latLng(pitExit._latitude, pitExit._longitude);
                const dist = map.latLngToLayerPoint(e.latlng).distanceTo(map.latLngToLayerPoint(pitExitLatLng));
                if (dist < 20) { pointToAdd = pitExitLatLng; shouldFinish = true; }
            }
            state.pitLanePoints.push(pointToAdd);

            // Allow Undo? Yes, it's just local state push
            // But we should sync to state.currentTrack.pit.polyline_geo ?
            // Let's do it on completion/click for robustness
            if (state.currentTrack.pit) {
                state.currentTrack.pit.polyline_geo.push({ _latitude: pointToAdd.lat, _longitude: pointToAdd.lng });
            }

            renderFeatures();
            updateUIButtons(); // Update Trace checkmark

            if (shouldFinish) {
                setMode(null);
                if (state.layers.interaction) state.layers.interaction.clearLayers();
            }
            return;
        }

        // Other Modes
        const geo = state.currentTrack.track_geometry.polyline_geo;
        if (!geo) return;
        const snapped = getNearestPointOnPolyline(e.latlng, geo);
        if (!snapped) return;

        let autoExit = false;
        if (state.editingMode === 'SF_LINE') {
            state.currentTrack.start_finish.geo_point = { _latitude: snapped.lat, _longitude: snapped.lng };
            autoExit = true;
        }
        else if (state.editingMode === 'PIT_ENTRY') {
            state.currentTrack.pit.entry.geo_point = { _latitude: snapped.lat, _longitude: snapped.lng };
            autoExit = true;
        }
        else if (state.editingMode === 'PIT_EXIT') {
            state.currentTrack.pit.exit.geo_point = { _latitude: snapped.lat, _longitude: snapped.lng };
            autoExit = true;
        }
        // ADD_CURB handled differently (via handleCurbClick in handlePointClick flow?) 
        // Actually, better to hook into handlePointClick for precision, but if they click map near point, we snap.
        // Let's use the explicit handlePointClick for precision, but if they click map near point, we snap.

        if (state.editingMode === 'DEFINE_CURB_START' || state.editingMode === 'DEFINE_CURB_END') {
            // 1. Try to snap to existing VERTEX first
            // Use the SNAPPED point (projection)
            const clickedSnapped = getNearestPointOnPolyline(e.latlng, geo);
            if (!clickedSnapped) return;

            let nearestIdx = -1;
            let minD = Infinity;
            geo.forEach((p, i) => {
                const pll = L.latLng(p._latitude, p._longitude);
                const d = clickedSnapped.distanceTo(pll);
                if (d < minD) { minD = d; nearestIdx = i; }
            });

            console.log(`[Snap Debug] Nearest Point Dist: ${minD.toFixed(2)}m (Idx: ${nearestIdx})`);

            // Snap Threshold: 5 meters
            if (nearestIdx !== -1 && minD < 5) {
                handleCurbClick(nearestIdx, e);
                return;
            }

            // 2. If not close to vertex, ALWAYS insert new point at projection on nearest segment
            const info = getNearestSegmentIndex(e.latlng, geo);
            if (info.point) {
                // Insert new point at the projected location
                saveTrackHistory();
                geo.splice(info.index + 1, 0, { _longitude: info.point.lng, _latitude: info.point.lat });
                const newPointIdx = info.index + 1;
                adjustFeatureIndices(newPointIdx); // Shift indices

                renderOSMTrack();
                renderTrackWidth();
                // Determine new index (it's info.index + 1)
                handleCurbClick(newPointIdx, e);
                return;
            }
        }

        if (state.editingMode === 'DEFINE_SECTOR_START' || state.editingMode === 'DEFINE_SECTOR_END') {
            // 1. Try to snap to existing VERTEX first
            const clickedSnapped = getNearestPointOnPolyline(e.latlng, geo);
            if (!clickedSnapped) return;

            let nearestIdx = -1;
            let minD = Infinity;
            geo.forEach((p, i) => {
                const pll = L.latLng(p._latitude, p._longitude);
                const d = clickedSnapped.distanceTo(pll);
                if (d < minD) { minD = d; nearestIdx = i; }
            });

            console.log(`[Snap Debug] Nearest Point Dist: ${minD.toFixed(2)}m (Idx: ${nearestIdx})`);

            // Snap Threshold: 5 meters
            if (nearestIdx !== -1 && minD < 5) {
                handleSectorClick(nearestIdx, e);
                return;
            }

            // 2. If not close to vertex, insert
            const info = getNearestSegmentIndex(e.latlng, geo);
            if (info.point) {
                saveTrackHistory();
                geo.splice(info.index + 1, 0, { _longitude: info.point.lng, _latitude: info.point.lat });
                const newPointIdx = info.index + 1;
                adjustFeatureIndices(newPointIdx); // Shift indices

                renderOSMTrack();
                renderTrackWidth();
                handleSectorClick(newPointIdx, e);
                return;
            }
        }

        else if (state.selectedTrackPointIndex === null && (state.editingMode === 'EDIT_TRACK' || state.editingMode === 'DELETE_RANGE')) {
            // 2. Else: Insert point on nearest segment (Split Segment)
            const info = getNearestSegmentIndex(e.latlng, geo);
            if (info.index !== -1 && info.point) {
                // Insert new point at the projected location
                saveTrackHistory();
                geo.splice(info.index + 1, 0, { _longitude: info.point.lng, _latitude: info.point.lat });
                renderOSMTrack();
                renderTrackWidth();
                // Determine new index (it's info.index + 1)
                state.selectedTrackPointIndex = info.index + 1;
            }
        }

        else if (state.editingMode === 'TURN_POINT' && state.activeTurnIndex !== null) {
            state.currentTrack.turns_and_straights[state.activeTurnIndex].geo_point = { _latitude: snapped.lat, _longitude: snapped.lng }; autoExit = true;
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
    // Sidebar Toggling
    document.querySelectorAll('.toggle-section-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent propagation if header has click events
            const h3 = btn.closest('h3');
            if (h3) {
                const groupContent = h3.nextElementSibling;
                if (groupContent && groupContent.classList.contains('group-content')) {
                    groupContent.classList.toggle('collapsed');
                    btn.classList.toggle('rotated');
                }
            }
        });
    });

    // Venue Search Typeahead
    const vInput = document.getElementById('venue-search');
    const vResults = document.getElementById('venue-results');

    const updateResults = () => {
        const val = vInput.value.toLowerCase();
        vResults.innerHTML = '';
        const matches = Object.keys(state.venues).filter(v => v.toLowerCase().includes(val)).sort();

        if (matches.length > 0) {
            matches.forEach(v => { // Show all matches
                const div = document.createElement('div');
                div.className = 'result-item';
                div.textContent = `${v} (${state.venues[v].length})`;
                div.onclick = () => {
                    vInput.value = v;
                    vResults.classList.add('hidden');
                    updateTrackSelect(v);
                };
                vResults.appendChild(div);
            });
            vResults.classList.remove('hidden');
        } else {
            vResults.classList.add('hidden');
        }
    };

    vInput.addEventListener('input', updateResults);
    vInput.addEventListener('focus', updateResults);

    // Blur with delay to allow click
    vInput.addEventListener('blur', () => {
        setTimeout(() => {
            vResults.classList.add('hidden');
        }, 200);
    });

    document.getElementById('track-select').addEventListener('change', (e) => {
        const val = e.target.value;
        const venue = document.getElementById('venue-search').value;
        let trackId = val;

        console.log(e);

        console.log("selected value: " + val);

        console.log("venue: " + venue);

        // User warning: val might be layout name. Ensure we get the ID.
        if (venue && state.venues[venue]) {
            // Try to find exact match on ID
            const tById = state.venues[venue].find(t => t.track_id === val);
            if (tById) {
                trackId = tById.track_id;
            } else {
                // Try to match by layout_name
                const tByName = state.venues[venue].find(t => t.layout_name === val);
                if (tByName) {
                    trackId = tByName.track_id;
                }
            }
        }

        if (trackId) loadTrack(trackId);
    });


    // Location Controls
    document.getElementById('track-address').addEventListener('change', (e) => {
        if (state.currentTrack) {
            state.currentTrack.street_address = e.target.value;
        }
    });

    document.getElementById('btn-geocode-address').addEventListener('click', async () => {
        const addr = document.getElementById('track-address').value;
        if (!addr || !state.currentTrack) return;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(addr)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);

                // Update Center
                if (!state.currentTrack.center) state.currentTrack.center = {};
                state.currentTrack.center.geo_point = { _latitude: lat, _longitude: lon };

                // Update UI
                document.getElementById('center-lat').value = lat.toFixed(6);
                document.getElementById('center-lon').value = lon.toFixed(6);

                // Pan map
                map.setView([lat, lon], 16);

                // Update Country Code if found
                if (data[0].address?.country_code) {
                    state.currentTrack.country_code = data[0].address.country_code;
                }
            } else {
                alert("Address not found.");
            }
        } catch (e) {
            console.error("Geocoding error", e);
            alert("Geocoding failed.");
        }
    });

    document.getElementById('btn-pick-center').addEventListener('click', () => setMode('DEFINE_CENTER'));
    document.getElementById('btn-center-map').addEventListener('click', () => {
        if (state.currentTrack?.center?.geo_point) {
            map.setView([state.currentTrack.center.geo_point._latitude, state.currentTrack.center.geo_point._longitude], 16);
        }
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

    document.getElementById('btn-add-sector').onclick = () => {
        if (!state.currentTrack) return;
        if (!state.currentTrack.sectors) state.currentTrack.sectors = [];

        const sectors = state.currentTrack.sectors;
        let newStart = null;
        let nextMode = 'DEFINE_SECTOR_START';

        // Auto-link to previous sector if exists
        if (sectors.length > 0) {
            const lastSector = sectors[sectors.length - 1];
            if (typeof lastSector.end_index === 'number') {
                newStart = lastSector.end_index;
                nextMode = 'DEFINE_SECTOR_END';
            }
        }

        state.currentTrack.sectors.push({
            name: `Sector ${sectors.length + 1}`,
            start_index: newStart,
            end_index: null
        });

        // Activate Mode for the new sector
        state.activeSectorIndex = sectors.length - 1;
        setMode(nextMode);

        updateSectorList();
        renderFeatures();
    };
    document.getElementById('btn-add-turn').addEventListener('click', () => {
        if (!state.currentTrack) return;
        if (!state.currentTrack.turns_and_straights) state.currentTrack.turns_and_straights = [];

        const newNum = state.currentTrack.turns_and_straights.length + 1;
        const newTurn = {
            name: `Turn ${newNum}`,
            geo_point: null
        };
        state.currentTrack.turns_and_straights.push(newTurn);
        updateFeatureList();

        // Auto-activate placement
        const idx = state.currentTrack.turns_and_straights.length - 1;
        setMode('TURN_POINT', idx);
        renderFeatures();
        updateUIButtons();
    });

    // Pit Lane Controls
    document.getElementById('btn-undo-pit').addEventListener('click', () => {
        if (state.pitLanePoints.length > 0) {
            state.pitLanePoints.pop();
            // Also remove from persistent storage
            if (state.currentTrack.pit && state.currentTrack.pit.polyline_geo.length > 0) {
                state.currentTrack.pit.polyline_geo.pop();
            }
            renderFeatures();
            updateUIButtons();
        }
    });

    document.getElementById('btn-reset-pit').addEventListener('click', () => {
        if (state.pitLanePoints.length > 0) {
            if (confirm("Reset pitlane?")) {
                state.pitLanePoints = [];
                if (state.currentTrack.pit) {
                    state.currentTrack.pit.polyline_geo = [];
                }
                renderFeatures();
                updateUIButtons();
            }
        }
    });

    // Track Edit Controls
    document.getElementById('btn-undo-track').addEventListener('click', () => {
        if (state.trackHistory.length > 0) {
            const prevGeo = state.trackHistory.pop();
            state.currentTrack.track_geometry.polyline_geo = prevGeo;
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
                state.currentTrack.track_geometry.polyline_geo = JSON.parse(JSON.stringify(state.originalTrackGeo));
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
            if (state.pitLanePoints.length === 0 && state.currentTrack && state.currentTrack.pit?.entry?.geo_point) {
                const entry = state.currentTrack.pit.entry.geo_point;
                state.pitLanePoints.push(L.latLng(entry._latitude, entry._longitude));

                // Also init the persistent array if empty?
                if (state.currentTrack.pit.polyline_geo.length === 0) {
                    state.currentTrack.pit.polyline_geo.push({ _latitude: entry._latitude, _longitude: entry._longitude });
                }

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
    if (state.editingMode === 'EDIT_TRACK') document.getElementById('btn-edit-trace').classList.add('active');
    if (state.editingMode === 'DEFINE_CENTER') document.getElementById('btn-pick-center').classList.add('active');

    updateStatusIcon('btn-sf-line', !!state.currentTrack?.start_finish?.geo_point);
    updateStatusIcon('btn-pit-entry', !!state.currentTrack?.pit?.entry?.geo_point);
    updateStatusIcon('btn-pit-exit', !!state.currentTrack?.pit?.exit?.geo_point);
    updateStatusIcon('btn-trace-pit', state.currentTrack?.pit?.polyline_geo?.length > 0);
    updateStatusIcon('btn-add-curb', state.currentTrack?.curbs?.length > 0);

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
        // RE-ENABLE EVERYTHING
        const allBtns = document.querySelectorAll('.control-group button');
        allBtns.forEach(b => b.disabled = false);

        const allInputs = document.querySelectorAll('.control-group input');
        allInputs.forEach(i => i.disabled = false);

        document.querySelectorAll('.control-group').forEach(g => {
            g.style.opacity = '1';
        });

        const canTracePit = !!t.pit?.entry?.geo_point && !!t.pit?.exit?.geo_point;
        document.getElementById('btn-trace-pit').disabled = !canTracePit;
        document.getElementById('btn-undo-pit').disabled = state.pitLanePoints.length === 0;
        document.getElementById('btn-undo-pit').disabled = state.pitLanePoints.length === 0;
        document.getElementById('btn-reset-pit').disabled = state.pitLanePoints.length === 0;

        document.getElementById('save-btn').disabled = false;
        document.getElementById('export-btn').disabled = false;

        document.getElementById('btn-trace-pit').title = !canTracePit ? "Set Pit Entry and Exit first" : "Draw pitlane path";

        const canSetPitWidth = state.pitLanePoints && state.pitLanePoints.length > 1;
        const pitWidthInput = document.getElementById('pit-width');
        pitWidthInput.disabled = !canSetPitWidth;
        pitWidthInput.parentElement.style.opacity = canSetPitWidth ? '1' : '0.5';

        // Track Edit Buttons
        document.getElementById('btn-undo-track').disabled = state.trackHistory.length === 0;
        document.getElementById('btn-delete-point').disabled = (state.selectedTrackPointIndex === null);

        // Enable Delete Range if track exists
        const hasTrack = state.currentTrack.track_geometry.polyline_geo && state.currentTrack.track_geometry.polyline_geo.length > 2;
        if (btnDeleteRange) btnDeleteRange.disabled = !hasTrack;

        document.getElementById('btn-reset-track').disabled = (!state.trackHistory.length && (!state.originalTrackGeo || JSON.stringify(state.originalTrackGeo) === JSON.stringify(state.currentTrack.track_geometry.polyline_geo)));

        // DIRECTION TOGGLE STATE
        const radios = document.getElementsByName('direction');
        radios.forEach(r => r.disabled = false);
        const isClockwise = t.direction && t.direction.clockwise !== false; // Default true if null/undefined treated as default above

        // Update UI
        document.querySelector('input[name="direction"][value="cw"]').checked = isClockwise;
        document.querySelector('input[name="direction"][value="ccw"]').checked = !isClockwise;

    } else {
        // Disable EVERYTHING in the sidebar tools if no track is selected
        const allBtns = document.querySelectorAll('.control-group button');
        allBtns.forEach(b => {
            // Exclude creation buttons or specific actions if needed
            if (b.id !== 'btn-create-venue' && b.id !== 'btn-create-track') {
                b.disabled = true;
            }
        });

        const radios = document.getElementsByName('direction');
        radios.forEach(r => r.disabled = true);

        const allInputs = document.querySelectorAll('.control-group input');
        allInputs.forEach(i => {
            // Exclude filter checkbox and venue search
            if (i.id !== 'filter-non-modified' && i.id !== 'venue-search') {
                i.disabled = true;
            }
        });

        document.getElementById('save-btn').disabled = true;
        document.getElementById('export-btn').disabled = true;

        // Clear Lists
        document.getElementById('feature-list').innerHTML = '<div class="feature-item" style="color: #666; font-style: italic;">No track selected</div>';
        document.getElementById('curb-list').innerHTML = '<div style="color: #666; font-style: italic; padding: 10px;">No track selected</div>';


        // Opacity for visual feedback
        document.querySelectorAll('.control-group').forEach(g => {
            // Don't fade the selection group
            if (!g.querySelector('#venue-search')) {
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

    if (!state.currentTrack || !state.currentTrack.turns_and_straights) return;

    state.currentTrack.turns_and_straights.forEach((turn, index) => {
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

function updateSectorList() {
    const list = document.getElementById('sector-list');
    list.innerHTML = '';

    if (!state.currentTrack || !state.currentTrack.sectors) return;

    state.currentTrack.sectors.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'feature-row'; // Use generic row class for consistency

        // Status Indicator
        const status = document.createElement('span');
        status.style.minWidth = '20px'; // consistent spacing
        status.style.textAlign = 'center';
        status.style.color = '#00ff00';
        status.textContent = (typeof s.start_index === 'number' && typeof s.end_index === 'number') ? '✓' : '';

        // Name Input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = s.name || `Sector ${i + 1}`;
        nameInput.onchange = (e) => {
            s.name = e.target.value;
            renderFeatures();
        };

        // Define/Target Button
        const targetBtn = document.createElement('button');
        targetBtn.className = 'icon-btn';
        targetBtn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
        targetBtn.title = 'Redefine Sector';
        if (state.activeSectorIndex === i && (state.editingMode === 'DEFINE_SECTOR_START' || state.editingMode === 'DEFINE_SECTOR_END')) {
            targetBtn.classList.add('active');
        }
        targetBtn.onclick = () => {
            if (state.activeSectorIndex === i) {
                // Cancel
                setMode(null);
                state.activeSectorIndex = null;
            } else {
                // Start Defining
                state.activeSectorIndex = i;
                setMode('DEFINE_SECTOR_START');
            }
            updateUIButtons();
            updateSectorList();
        };

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.title = 'Delete Sector';
        delBtn.onclick = () => {
            if (confirm("Are you sure you want to delete this sector?")) {
                state.currentTrack.sectors.splice(i, 1);
                if (state.activeSectorIndex === i) {
                    state.activeSectorIndex = null;
                    setMode(null);
                }
                updateSectorList();
                renderFeatures();
            }
        };

        div.appendChild(status);
        div.appendChild(nameInput);
        div.appendChild(targetBtn);
        div.appendChild(delBtn);

        // Hover Effect
        div.onmouseenter = () => {
            state.highlightedSectorIndex = i;
            renderFeatures();
        };
        div.onmouseleave = () => {
            state.highlightedSectorIndex = null;
            renderFeatures();
        };

        list.appendChild(div);
    });
}

function updateUIButtons() {
    if (!state.currentTrack) {
        // Disable everything EXCEPT create buttons and MODAL contents
        document.querySelectorAll('button:not(#btn-create-venue):not(#btn-create-track):not(#btn-settings)').forEach(b => {
            // If button is inside a modal, don't disable it
            if (!b.closest('.modal')) b.disabled = true;
        });

        document.querySelectorAll('input:not(#venue-search):not(#filter-non-modified)').forEach(i => {
            if (!i.closest('.modal')) i.disabled = true;
        });

        document.querySelectorAll('select:not(#track-select)').forEach(s => {
            if (!s.closest('.modal')) s.disabled = true;
        });
        return;
    }

    // Enable basic controls (Re-enable non-modals specifically? Or just all?)
    // Simpler to just enable all, but respect specific disabled states like undo
    document.querySelectorAll('button:not(#btn-undo-track):not(#btn-undo-pit):not(#btn-delete-point):not(#btn-delete-range):not(#btn-reset-track)').forEach(b => b.disabled = false);
    document.querySelectorAll('input').forEach(i => i.disabled = false);
    document.querySelectorAll('select').forEach(s => s.disabled = false);

    // Specific Mode States
    const setBtnState = (id, activeText) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const icon = btn.querySelector('.status-icon');
        if (state.editingMode === activeText) { // Logic misuse of param name, but works for mapping
            // But we match logic below
        }
    };

    // Helper
    const updateBtn = (id, mode) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const isActive = (state.editingMode === mode);
        if (isActive) {
            btn.classList.add('active');
            btn.innerHTML = `Cancel <span class="status-icon"><i class="fa-solid fa-ban"></i></span>`;
        } else {
            btn.classList.remove('active');
            // Reset text (Hardcoded for now or store original?)
            // We'll just reset based on ID
            if (id === 'btn-sf-line') btn.innerHTML = `Add Start/Finish Line <span class="status-icon"></span>`;
            if (id === 'btn-pit-entry') btn.innerHTML = `Add Pit Entry <span class="status-icon"></span>`;
            if (id === 'btn-pit-exit') btn.innerHTML = `Add Pit Exit <span class="status-icon"></span>`;
            if (id === 'btn-trace-pit') btn.innerHTML = `Trace Pitlane <span class="status-icon"></span>`;
            if (id === 'btn-add-turn') btn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
            if (id === 'btn-add-curb-entry') btn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
            if (id === 'btn-pick-center') btn.innerHTML = `<i class="fa-solid fa-map-pin"></i>`;
            if (id === 'btn-add-sector') btn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
        }
    };

    updateBtn('btn-sf-line', 'SF_LINE');
    updateBtn('btn-pit-entry', 'PIT_ENTRY');
    updateBtn('btn-pit-exit', 'PIT_EXIT');
    updateBtn('btn-trace-pit', 'TRACE_PIT');
    updateBtn('btn-pick-center', 'DEFINE_CENTER');

    // Turn Button State
    const btnTurn = document.getElementById('btn-add-turn');
    if (state.editingMode === 'TURN_POINT') {
        btnTurn.classList.add('active');
        btnTurn.innerHTML = `<i class="fa-solid fa-ban"></i>`;
    } else {
        btnTurn.classList.remove('active');
        btnTurn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
    }

    // Curb Button State
    const btnCurb = document.getElementById('btn-add-curb-entry');
    if (state.editingMode === 'DEFINE_CURB_START' || state.editingMode === 'DEFINE_CURB_END') {
        btnCurb.classList.add('active');
        btnCurb.innerHTML = (state.editingMode === 'DEFINE_CURB_START') ? 'Start...' : 'End...';
        if (state.editingMode === 'DEFINE_CURB_END') btnCurb.classList.add('flashing'); else btnCurb.classList.remove('flashing');
    } else {
        btnCurb.classList.remove('active');
        btnCurb.classList.remove('flashing');
        btnCurb.innerHTML = `<i class="fa-solid fa-plus"></i>`;
    }

    // Sector Button State
    const btnSector = document.getElementById('btn-add-sector');
    if (state.editingMode === 'DEFINE_SECTOR_START' || state.editingMode === 'DEFINE_SECTOR_END') {
        btnSector.classList.add('active');
        btnSector.innerHTML = (state.editingMode === 'DEFINE_SECTOR_START') ? 'Start...' : 'End...';
        if (state.editingMode === 'DEFINE_SECTOR_END') btnSector.classList.add('flashing'); else btnSector.classList.remove('flashing');
    } else {
        btnSector.classList.remove('active');
        btnSector.classList.remove('flashing');
        btnSector.innerHTML = `<i class="fa-solid fa-plus"></i>`;
    }

    // Edit Track Buttons
    const btnEdit = document.getElementById('btn-edit-trace');
    if (state.editingMode === 'EDIT_TRACK') {
        btnEdit.classList.add('active');
        btnEdit.textContent = "Exit Edit Mode";
        document.getElementById('btn-undo-track').disabled = false;
        document.getElementById('btn-delete-point').disabled = (state.selectedTrackPointIndex === null);
        document.getElementById('btn-delete-range').disabled = false;
    } else if (state.editingMode === 'DELETE_RANGE') {
        btnEdit.textContent = "Edit Track Geometry";
        btnEdit.disabled = true; // Cannot switch directly?
        document.getElementById('btn-delete-range').classList.add('active');
    } else {
        btnEdit.classList.remove('active');
        btnEdit.textContent = "Toggle Edit Track Geometry Mode"; // Fixed Label
        document.getElementById('btn-undo-track').disabled = true;
        document.getElementById('btn-delete-point').disabled = true;
        document.getElementById('btn-delete-range').disabled = true;
        document.getElementById('btn-delete-range').classList.remove('active');
    }
    // Always enable Reset if track exists
    document.getElementById('btn-reset-track').disabled = false;
}

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
