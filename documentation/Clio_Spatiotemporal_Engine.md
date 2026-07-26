# The Clio Spatiotemporal Engine ("The Ghost Map")

## Architectural Concept
A Palantir-level spatiotemporal analytics engine designed to identify physical and temporal intersections between disparate individuals across the "fullness of time." This is a manifestation of the core "Solving for I" directive—mapping invisible threads of heritage and timeline collisions.

## The Query Structure
- **Entity A:** (e.g., The Commander)
- **Entity B:** (e.g., Unknown Family Member)
- **Spatial Constraint (`d`):** <= `n` miles (e.g., 5 miles)
- **Temporal Constraint (`t`):** <= `n` time units (e.g., 24 hours)
- **Goal:** Render a visual "Heat Map" identifying moments where Entity A and Entity B occupied the same space at the same time.

## Execution Strategy
1. **The Swarm Pipeline:** Standard databases choke on $O(N^2)$ Cartesian queries. The MneOS Genesis Swarm will execute an Aggregation Pipeline that loads targeted timelines into memory and utilizes KD-Tree spatial indexing or spatiotemporal bounding boxes to calculate collision moments efficiently.
2. **MongoDB Geospatial Integration:** Leveraging native `$geoNear` and `$geoIntersects` queries on the `location.coordinates` indexed field.

## The Facebook Geodata Problem & AI Solution
Social platforms (like Facebook) ruthlessly strip EXIF GPS data from uploaded photos to protect privacy. If media is scraped from these platforms, the binary `.jpg` will lack native coordinates.

**The Workaround Pipeline:**
1. **Metadata Inferencing:** If a scrape captures text (e.g., check-ins, captions like "At Busch Gardens, Summer '98"), pass the text to an LLM to automatically generate synthetic `geoData` (Lat/Lng) and inject it into the Sovereign DB.
2. **Visual Geolocation:** For raw media with zero text metadata, route the image to `GrokVision` or `AzureVision`. Request the AI to analyze landmarks, street signs, architecture, and vehicle models to output an "Estimated Spatial Bounding Box" and "Estimated Temporal Bounding Box."

## UI/UX: The Ghost Map Interface
- Two or more timelines rendered simultaneously on the interactive map module (`GoogleMap.tsx` / `InteractiveMap.tsx`).
- Adjustable "Collision Tolerance" sliders for Distance and Time.
- Visual flaring of intersection points.
- Clicking an intersection opens a React Portal (via `MatrixStudio.tsx`), displaying the collision media side-by-side.

## Status
*Ideation Phase.* Logged during Genesis Cluster Brainstorm Session (June 21, 2026). Dependent on completion of the MneOS "plasmic interface" (frontend Matrix UI stabilization).
