// Project GIGI: Unified Map Styles
// Theme: Midnight Green (Land) & Deep Azure (Water)

export const DARK_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#001a00" }] }, // Deep Midnight Green Land
    { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#a3e635" }] }, // Lime/Green Text for visibility
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#002800" }] }, 
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#0f390f" }] }, // Dark Green Roads
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#001a00" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#14532d" }] }, 
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#001a00" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#002133" }] }, // Deep Azure Water
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#0ea5e9" }] }, // Sky Blue Water Labels
];

// Crash-proof SVG Pin for Legacy Markers (Person/Place/Generic)
// Sanitized to remove compressed relative commands that crash the Legacy Parser
export const getPinIcon = (color: string) => ({
    path: "M 12,2 C 8.13,2 5,5.13 5,9 C 5,14.25 12,22 12,22 C 12,22 19,14.25 19,9 C 19,5.13 15.87,2 12,2 z M 12,11.5 C 10.62,11.5 9.5,10.38 9.5,9 C 9.5,7.62 10.62,6.5 12,6.5 C 13.38,6.5 14.5,7.62 14.5,9 C 14.5,10.38 13.38,11.5 12,11.5 z",
    fillColor: color,
    fillOpacity: 1,
    strokeWeight: 1.5,
    strokeColor: "#ffffff",
    rotation: 0,
    scale: 1.5,
    anchor: { x: 12, y: 22 } // Explicit object for Legacy Marker compatibility
});