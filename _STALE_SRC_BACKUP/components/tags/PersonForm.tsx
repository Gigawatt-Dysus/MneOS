import React from 'react';
import type { PersonTag, Tag, Settings, AiCompanion } from '@/types';

// Import New Sub-Components
import PersonIdentity from './person/PersonIdentity';
import PersonContact from './person/PersonContact';
import PersonLife from './person/PersonLife';
import PersonBio from './person/PersonBio';
import PersonConnections from './person/PersonConnections';

interface PersonFormProps {
    tag: PersonTag;
    activeTab: string;
    allTags: Tag[];
    onMetadataChange: (metadata: any) => void;
    // [ZEN FIX] Explicitly accepting onRootChange to avoid compiler errors
    onRootChange: (field: keyof Tag, value: any) => void;
    settings?: Settings; 
    onEnrollFace: () => void;
    isEnrolling: boolean;
    primaryCompanion: AiCompanion;
}

const PersonForm: React.FC<PersonFormProps> = ({ 
    tag, 
    activeTab, 
    allTags, 
    onMetadataChange, 
    onRootChange, 
    settings, 
    onEnrollFace, 
    isEnrolling, 
    primaryCompanion 
}) => {
    const meta = tag.metadata;
    const isEnrolled = !!meta.faceDescriptor;

    // Helper for updating metadata
    const handleMetaChange = (path: string, value: any) => {
        const newMeta = JSON.parse(JSON.stringify(meta));
        if (!path.includes('.')) {
            newMeta[path] = value;
        } else {
            const keys = path.split('.');
            let current = newMeta;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        }
        onMetadataChange(newMeta);
    };

    switch (activeTab) {
        case 'identity':
            return (
                <PersonIdentity 
                    tag={tag} 
                    meta={meta} 
                    handleChange={handleMetaChange} 
                    onEnrollFace={onEnrollFace} 
                    isEnrolling={isEnrolling} 
                    isEnrolled={isEnrolled}
                />
            );
        case 'contact':
            return <PersonContact meta={meta} handleChange={handleMetaChange} />;
        case 'life':
            return <PersonLife meta={meta} handleChange={handleMetaChange} settings={settings} />;
        case 'bio':
            return <PersonBio meta={meta} handleChange={handleMetaChange} />;
        case 'connections':
            return (
                <PersonConnections 
                    tag={tag} 
                    allTags={allTags} 
                    meta={meta} 
                    handleChange={handleMetaChange} 
                    primaryCompanion={primaryCompanion} 
                />
            );
        default:
            return null;
    }
};

export default PersonForm;