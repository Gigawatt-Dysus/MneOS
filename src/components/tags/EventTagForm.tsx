import React from 'react';
import type { EventTag } from '../../types';

interface EventTagFormProps {
    tag: EventTag;
    onMetadataChange: (metadata: any) => void;
}

const EventTagForm: React.FC<EventTagFormProps> = () => {
    return (
        <div className="text-center py-10 text-slate-500 italic">
            Event Tags organize your Timeline. No specific metadata required.
        </div>
    );
};
export default EventTagForm;