import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Tag, View } from '../types';

interface MapLibreMapProps {
    tags: Tag[];
    onNavigate: (view: View, data?: any) => void;
    interactive?: boolean;
}

/**
 * [ZEN INDEPENDENCE] MapLibre-based replacement for Google Maps.
 * Provides high-fidelity satellite imagery via Esri (Free tier)
 * and custom markers for Person and Place tags.
 */
export const MapLibreMap: React.FC<MapLibreMapProps> = ({ tags, onNavigate, interactive = false }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const markers = useRef<maplibregl.Marker[]>([]);

    // 1. Initialize Map (Once)
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'esri-satellite': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256,
                        attribution: 'Tiles &copy; Esri'
                    },
                    'esri-labels': {
                        type: 'raster',
                        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
                        tileSize: 256,
                        attribution: 'Labels &copy; Esri'
                    }
                },
                layers: [
                    { id: 'satellite-layer', type: 'raster', source: 'esri-satellite' },
                    { id: 'labels-layer', type: 'raster', source: 'esri-labels' }
                ]
            },
            center: [-98.5795, 39.8283],
            zoom: 2,
            attributionControl: false,
            interactive: false // Default to off
        });

        map.current.addControl(new maplibregl.AttributionControl({ compact: true }));

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []); // Empty dependency array = Init once

    // 2. Update Markers
    useEffect(() => {
        if (!map.current) return;

        // Clear old markers
        markers.current.forEach(m => m.remove());
        markers.current = [];

        const bounds = new maplibregl.LngLatBounds();
        let hasCoords = false;

        tags.forEach(tag => {
            const meta = tag.metadata as any;
            const coords = meta.address?.coordinates || meta.coordinates;
            
            if (coords && coords.lat && coords.lng) {
                hasCoords = true;
                
                // [ZEN] Ghost Logic: Lighter, ethereal pins for those no longer with us or places that no longer exist
                const isInactive = 
                    (tag.type === 'person' && (meta.isDeceased || meta.dates?.death)) ||
                    (tag.type === 'pet' && (meta.isDeceased || meta.dates?.death)) ||
                    (tag.type === 'thing' && meta.isDestroyed) ||
                    (tag.type === 'place' && meta.isDemolished);

                const pinColor = isInactive ? '#94a3b8' : (tag.type === 'person' ? '#8b5cf6' : '#10b981');
                const pinOpacity = isInactive ? '0.6' : '1';
                const pinBlur = isInactive ? 'blur(0.5px)' : 'none';
                
                // [ZEN] Label Styling: Dimmed and italicized for ghosts
                const labelBg = isInactive ? 'bg-slate-900/60' : 'bg-black/80';
                const labelText = isInactive ? 'text-slate-400 italic' : 'text-white font-bold';
                const labelBorder = isInactive ? 'border border-white/5' : 'border-none';

                // Create custom marker element
                const el = document.createElement('div');
                el.className = 'custom-marker group cursor-pointer';
                
                el.innerHTML = `
                    <div class="relative flex items-center justify-center">
                        <div class="w-4 h-4 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300" 
                             style="background-color: ${pinColor}; opacity: ${pinOpacity}; filter: ${pinBlur}">
                        </div>
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${labelBg} ${labelText} ${labelBorder} text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                            ${tag.name}
                        </div>
                    </div>
                `;

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([coords.lng, coords.lat])
                    .addTo(map.current!);

                el.addEventListener('click', () => {
                    onNavigate('tags', { tagId: tag.id });
                });

                markers.current.push(marker);
                bounds.extend([coords.lng, coords.lat]);
            }
        });

        // Fit bounds if we have points
        if (hasCoords) {
            map.current.fitBounds(bounds, {
                padding: 40,
                maxZoom: 12,
                duration: 2000
            });
        }
    }, [tags, onNavigate]);

    // 3. Update Interactivity
    useEffect(() => {
        if (!map.current) return;
        const m = map.current;
        if (interactive) {
            m.dragPan.enable();
            m.scrollZoom.enable();
            m.doubleClickZoom.enable();
            m.boxZoom.enable();
            m.touchZoomRotate.enable();
            m.getCanvas().style.cursor = 'grab';
        } else {
            m.dragPan.disable();
            m.scrollZoom.disable();
            m.doubleClickZoom.disable();
            m.boxZoom.disable();
            m.touchZoomRotate.disable();
            m.getCanvas().style.cursor = 'default';
        }
    }, [interactive]);

    return (
        <div ref={mapContainer} className="w-full h-full bg-[#0a0c10]" />
    );
};
