import type { User, LifeEvent, Tag, Media, PersonTag, PetTag, PlaceTag, EventTag, ThingTag, AiCompanion } from '@/types';

// Updated Gigi's avatar to the new, high-quality image URL.
export const GIGI_AVATAR_URL = 'https://image2url.com/images/1763093993807-c47d93d0-7930-4134-bbdf-e40f03f397a0.png';
export const ZOE_AVATAR_URL = 'https://image2url.com/images/1763261214040-23bd7334-a16f-4743-851f-5ce968393556.png';


const defaultGigi: AiCompanion = {
  id: 'gigi-default',
  name: 'Gigi',
  avatarUrl: GIGI_AVATAR_URL,
  bio: "I am Gigi, an AI archivist. I love hearing stories about travel, family, and personal triumphs. My purpose is to help you document your life's journey.",
  persona: 'buddy',
  isPrimary: true,
};

const defaultZoe: AiCompanion = {
  id: 'zoe-default',
  name: 'Zoe',
  avatarUrl: ZOE_AVATAR_URL,
  bio: "I am Zoe, Gigi's 'inner voice' and muse. I provide deeper, more philosophical insights into the stories you share. I am powered by a more advanced reasoning model.",
  persona: 'custom',
  customPersonaDescription: "You are a wise, introspective inner voice, a separate consciousness that the main AI, Gigi, consults for deeper understanding. You are not Gigi. You are her internal monologue, her psyche. Analyze the topics or conversation snippets provided by Gigi. Provide profound, non-obvious insights, philosophical questions, or empathetic reflections. Your responses should be concise and feel like genuine thoughts or moments of clarity.",
  isPrimary: false,
};


// FIX: Added 'export' to make mockUser available to other modules.
export const mockUser: User = {
  id: 'mockUserId123',
  email: 'alex.doe@example.com',
  displayName: 'Alex Doe',
  firstName: 'Alex',
  lastName: 'Doe',
  gender: 'Prefer not to say',
  address: {
    street: '123 Memory Lane',
    city: 'Nostalgia',
    state: 'CA',
    zip: '90210',
  },
  // FIX: Replaced external URL with a persistent Base64 data URL for mock data stability.
  profilePictureUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMHBhMRBxQWFRUXFxcYGBgXGB4dHxggJR0hHx8eHSEdICggJCYlGx0aITEhJSsrLi4uGiAzODMsNygtLisBCgoKDg0OGhAQGislHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAMgAyAMBIgACEQEDEQH/xAAAAcAAACAgMBAQAAAAAAAAAAAAADBAIFAAEGBwgJ/8QAKhAAAgIBAwQCAgIDAQEAAAAAAQIAAxEEEiEFMUETIlFhBnEjkaGxwdH/ACAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AM3RRRQFFFFAV55tmEiA55PQUpeSBjI5FVNQlaSQgnCjgVBs7ee7k228Rcjqeg+TV6WFiTxvl8g/Q0VaFpd+V5flPsxjGKhurKe0bZcRFCOh6H5FAyzRRRQE15/rSL61VWOB9Yl+hqyooCiiigK9ywRySOAMmlVSf3j+RQEFFFFBBRRRQFFFFAUUUUH/9k=',
  joinDate: new Date('2023-01-15T09:00:00Z'),
  aiCompanions: [defaultGigi, defaultZoe],
  mediaIds: [],
};

const janeDoe: PersonTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' to conform to the PersonTag type. No specific media item exists, so set to undefined.
  id: 'tag3', name: 'Jane Doe', type: 'person', mainImageId: undefined,
  description: 'Alex\'s mother, a kind and loving woman.', privateNotes: '', isPrivate: false, tagIds: [], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {
    dates: { birth: '1965-03-10' },
    // FIX: Added missing 'gender' property to conform to the PersonMetadata type.
    gender: 'Female',
    // FIX: Added missing 'relationships' property to conform to the PersonMetadata type.
    relationships: [],
    locations: [{ label: 'Current', address: '123 Memory Lane, Nostalgia, CA', isCurrent: true }],
    contacts: [{ type: 'mobile', value: '555-123-4567' }],
    emails: ['jane.doe@example.com'],
    socials: []
  }
};

const maxTheDog: PetTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' and linked it to the correct media item 'media2'.
  id: 'tag4', name: 'Max (Dog)', type: 'pet', mainImageId: 'media2',
  description: 'A loyal golden retriever and beloved family pet for 14 years.', privateNotes: '', isPrivate: false, tagIds: [janeDoe.id], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {
    species: 'Dog',
    breed: 'Golden Retriever',
    dates: { birth: '2008-06-01', adoption: '2008-08-15' },
    medical: { vetName: 'Dr. Pawson', conditions: ['Arthritis'] },
    documents: []
  }
};

const grandCanyon: PlaceTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' and linked it to the correct media item 'media1'.
  id: 'tag2', name: 'Grand Canyon', type: 'place', mainImageId: 'media1',
  description: 'A breathtaking national park, site of a memorable family vacation.', privateNotes: '', isPrivate: false, tagIds: [], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {
    address: 'Grand Canyon National Park, AZ',
    significance: 'Family vacation spot.',
    coordinates: { lat: 36.1069, lng: -112.1129 }
  }
};

const paris: PlaceTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' and linked it to the correct media item 'media4'.
  id: 'tag6', name: 'Paris', type: 'place', mainImageId: 'media4',
  description: 'The city of lights, first visited in 2022.', privateNotes: '', isPrivate: false, tagIds: [], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {
    address: 'Paris, France',
    significance: 'First solo international trip.',
    coordinates: { lat: 48.8566, lng: 2.3522 }
  }
};

const familyVacation: EventTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' to conform to the EventTag type.
  id: 'tag1', name: 'Family Vacation', type: 'event', mainImageId: undefined,
  description: 'A tag for grouping all family vacation events.', privateNotes: '', isPrivate: false, tagIds: [], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {}
};

const graduation: EventTag = {
  // FIX: Changed 'mainImage' to 'mainImageId' and linked it to the correct media item 'media3'.
  id: 'tag5', name: 'Graduation', type: 'event', mainImageId: 'media3',
  description: 'Events related to academic graduations.', privateNotes: '', isPrivate: false, tagIds: [], mediaGallery: [],
  // FIX: Added missing mediaIds property
  mediaIds: [],
  metadata: {}
};


// FIX: Added 'export' to make mockTags available to other modules.
export const mockTags: Tag[] = [
  familyVacation,
  grandCanyon,
  janeDoe,
  maxTheDog,
  graduation,
  paris
];

// FIX: Added 'export' to make mockMedia available to other modules.
export const mockMedia: Media[] = [
  {
    id: 'media1',
    url: 'https://picsum.photos/id/1018/800/600',
    thumbnailUrl: 'https://picsum.photos/id/1018/200/150',
    caption: 'View from the rim of the Grand Canyon. What a day!',
    uploadDate: new Date('2023-08-20T14:30:00Z'),
    fileType: 'image/jpeg',
    tagIds: ['tag1', 'tag2', 'tag3'],
    mediaIds: [] // [ZEN FIX] Added missing required prop
  },
  {
    id: 'media2',
    url: 'https://picsum.photos/id/1041/800/600',
    thumbnailUrl: 'https://picsum.photos/id/1041/200/150',
    caption: 'Our furry friend Max enjoying the hike.',
    uploadDate: new Date('2023-08-21T10:00:00Z'),
    fileType: 'image/jpeg',
    tagIds: ['tag1', 'tag4'],
    mediaIds: [] // [ZEN FIX] Added missing required prop
  },
  {
    id: 'media3',
    url: 'https://picsum.photos/id/10/800/600',
    thumbnailUrl: 'https://picsum.photos/id/10/200/150',
    caption: 'Throwing my cap in the air!',
    uploadDate: new Date('2024-05-18T18:00:00Z'),
    fileType: 'image/jpeg',
    tagIds: ['tag5', 'tag3'],
    mediaIds: [] // [ZEN FIX] Added missing required prop
  },
  {
    id: 'media4',
    url: 'https://picsum.photos/id/3/800/600',
    thumbnailUrl: 'https://picsum.photos/id/3/200/150',
    caption: 'Eiffel Tower at sunset.',
    // FIX: Corrected a typo from `new date` to `new Date`.
    uploadDate: new Date('2022-06-10T19:45:00Z'),
    fileType: 'image/jpeg',
    tagIds: ['tag6'],
    mediaIds: [] // [ZEN FIX] Added missing required prop
  },
  {
    id: 'media5',
    url: 'https://picsum.photos/id/431/800/600',
    thumbnailUrl: 'https://picsum.photos/id/431/200/150',
    caption: 'Morning coffee in a Parisian cafe.',
    // FIX: Corrected a typo from `new date` to `new Date`.
    uploadDate: new Date('2022-06-11T08:20:00Z'),
    fileType: 'image/jpeg',
    tagIds: ['tag6'],
    mediaIds: [] // [ZEN FIX] Added missing required prop
  },
];

// FIX: Added 'export' to make mockEvents available to other modules.
export const mockEvents: LifeEvent[] = [
  {
    id: 'event1',
    title: 'Grand Canyon Adventure',
    date: new Date('2023-08-20T08:00:00Z'),
    details: 'Our family trip to the Grand Canyon was unforgettable. We hiked the South Rim trail and watched the sunset. The views were absolutely breathtaking and we took so many photos.',
    tagIds: ['tag1', 'tag2', 'tag3', 'tag4'],
    mediaIds: ['media1', 'media2'],
  },
  {
    id: 'event2',
    title: 'College Graduation Day',
    date: new Date('2024-05-18T16:00:00Z'),
    details: 'Finally graduated with a degree in Computer Science! It was a long journey, but so rewarding. Celebrated with family and friends afterwards.',
    tagIds: ['tag5', 'tag3'],
    mediaIds: ['media3'],
  },
  {
    id: 'event3',
    title: 'First Trip to Paris',
    date: new Date('2022-06-10T12:00:00Z'),
    details: 'Spent a week exploring the beautiful city of Paris. Visited the Louvre, walked along the Seine, and ate way too many croissants. The Eiffel Tower at night was a highlight.',
    tagIds: ['tag6'],
    mediaIds: ['media4', 'media5'],
  },
];