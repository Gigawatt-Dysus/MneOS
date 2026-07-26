export interface Patient {
    id: string;
    originalName: string;
    currentDate: any; 
    proposedDate: string | null;
    url: string;
    status: 'pending' | 'fixed' | 'skipped' | 'deleted' | 'unfixable' | 'verified';
}

export interface ChronoMedicProps {
    userId: string;
    onClose?: () => void;
}