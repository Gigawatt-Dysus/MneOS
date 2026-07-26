export interface Vaccination {
    id: string;
    name: string;
    date: string;
    expires?: string;
}

export interface MedicalRecord {
    vetName: string;
    vetPhone?: string;
    vetAddress?: string;
    insuranceProvider?: string;
    insurancePolicy?: string;
    chipId?: string;
    conditions: string[];
    vaccinations: Vaccination[];
}

export interface DietInfo {
    foodBrand: string;
    feedingSchedule: string;
    allergies: string[];
    likes: string[];
    dislikes: string[];
}

export interface PetMetadata {
    species: string;
    breed?: string;
    color?: string;
    gender?: 'Male' | 'Female' | 'Unknown';
    dates: {
        birth?: string;
        adoption?: string;
        passing?: string;
    };
    isDeceased?: boolean;
    medical: MedicalRecord;
    diet: DietInfo;
}

export const ensurePetMetadata = (data: any): PetMetadata => ({
    species: data?.species || '',
    breed: data?.breed || '',
    color: data?.color || '',
    gender: data?.gender || 'Unknown',
    dates: {
        birth: data?.dates?.birth || '',
        adoption: data?.dates?.adoption || '',
        passing: data?.dates?.passing || data?.dates?.death || '', // Handle legacy 'death' key
    },
    isDeceased: !!data?.isDeceased,
    medical: {
        vetName: data?.medical?.vetName || '',
        vetPhone: data?.medical?.vetPhone || '',
        vetAddress: data?.medical?.vetAddress || '',
        insuranceProvider: data?.medical?.insuranceProvider || '',
        insurancePolicy: data?.medical?.insurancePolicy || '',
        chipId: data?.medical?.chipId || '',
        conditions: Array.isArray(data?.medical?.conditions) ? data.medical.conditions : [],
        vaccinations: Array.isArray(data?.medical?.vaccinations) ? data.medical.vaccinations : [],
    },
    diet: {
        foodBrand: data?.diet?.foodBrand || '',
        feedingSchedule: data?.diet?.feedingSchedule || '',
        allergies: Array.isArray(data?.diet?.allergies) ? data.diet.allergies : [],
        likes: Array.isArray(data?.diet?.likes) ? data.diet.likes : [],
        dislikes: Array.isArray(data?.diet?.dislikes) ? data.diet.dislikes : [],
    }
});