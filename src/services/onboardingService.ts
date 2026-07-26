import { appDataService } from './serviceManager';
import { SecretsManager } from '../utils/SecretsManager';
import type { User } from '../types';
import type { Tag, PersonTag } from '../types/tags';
import { GIGI_AVATAR_URL } from '../mockData';
import { v4 as uuidv4 } from 'uuid';
import { isRootUser } from '../utils/rbac';

let skeletonCached: any = null;

async function getSkeleton() {
    if (skeletonCached) return skeletonCached;
    try {
        // Construct path dynamically to prevent Rollup/Vite from statically analyzing and resolving it at build time
        const path = "../gigi-skeleton" + "-key.json";
        const module = await import(/* @vite-ignore */ path);
        skeletonCached = module.default || module;
    } catch (e) {
        console.warn("[Onboarding] gigi-skeleton-key.json not found. Falling back to environment variables.");
        skeletonCached = {
            keys: {
                fireworks: import.meta.env.VITE_FIREBASE_API_KEY || '',
                xai: import.meta.env.VITE_XAI_API_KEY || '',
                typesense_host: '',
                typesense_key: ''
            }
        };
    }
    return skeletonCached;
}


const ROOT_EMAILS = ['artin', 'eric', 'dysus', 'dysys', 'dysus2024@gmail.com']; // Eric's master account identifiers (Master substrings)

export const OnboardingService = {
    /**
     * The "House Keys" protocol.
     * Ensures new users are born with valid API keys and a clean profile.
     */
    async provisionUser(userId: string, email: string, isNewUser: boolean = false, forceHouseKeys: boolean = false): Promise<User | null> {
        console.log(`%c[Onboarding] 🛰️ Heartbeat: userId=${userId} | email=${email}`, 'background: #3b82f6; color: #fff; padding: 2px;');
        let profile = await appDataService.getUserProfile(userId);

        if (!profile) {
            console.log(`%c[Onboarding] 🔍 No exactly named document for ${userId}. Scanning Shadow Lattice...`, 'color: #f59e0b;');

            try {
                const allProfiles = await appDataService.getAllUserProfiles();
                const shadowProfile = allProfiles.find(p => p.id?.toLowerCase() === userId.toLowerCase());

                if (shadowProfile && shadowProfile.id !== userId) {
                    console.log(`%c[Onboarding] ⚡ Shadow Identity Locked: ${shadowProfile.id} -> ${userId}`, 'color: #3b82f6; font-weight: bold;');

                    const migratedProfile: User = {
                        ...shadowProfile,
                        id: userId,
                        email: email || shadowProfile.email
                    };

                    await appDataService.updateUserProfile(userId, migratedProfile);
                    await appDataService.deleteUserProfile(shadowProfile.id);

                    profile = migratedProfile;
                    console.log(`%c[Onboarding] ✨ Migration Protocol Successful.`, 'color: #00ff00; font-weight: bold;');
                }
            } catch (e) {
                console.error("[Onboarding] Shadow Lattice scan failed", e);
            }
        }

        if (!profile) {
            console.log(`%c[Onboarding] 🆕 Provisioning new archivist: ${userId} (${email})`, 'color: #00ff00; font-weight: bold;');

            // Basic RBAC detection
            const isRoot = email && ROOT_EMAILS.some(e => email.toLowerCase().includes(e.toLowerCase()));

            // Generate a unique ID for the user's Person Tag
            const personTagId = uuidv4();

            // 1. Create Default Profile
            const newUser: User = {
                id: userId,
                email: email || '',
                displayName: email ? email.split('@')[0] : 'New Archivist',
                firstName: email ? email.split('@')[0] : 'New',
                lastName: 'Archivist',
                gender: 'Prefer not to say',
                address: { street: '', city: '', state: '', zip: '' },
                profilePictureUrl: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${userId}`,
                joinDate: new Date(),
                role: isRoot ? 'root' : 'user',
                personTagId: personTagId,
                privacy: {
                    visibility: 'public', // Default to public so they can find each other initially
                    autoShareTag: true    // Default to sharing their identity with new Verts
                },
                vertCount: 0,
                aiCompanions: [{
                    id: 'gigi-default',
                    name: 'Gigi',
                    avatarUrl: GIGI_AVATAR_URL,
                    bio: "I am Gigi, an AI archivist. I am here to help you document your story.",
                    persona: 'buddy',
                    isPrimary: true,
                    preferredModel: 'accounts/fireworks/models/qwen3-vl-30b-a3b-instruct'
                }],
                mediaIds: [],
            };

            // 2. Create the associated Person Tag (Self-Identity)
            const selfTag: PersonTag = {
                id: personTagId,
                type: 'person',
                name: newUser.displayName,
                description: `Digital shadow of ${newUser.displayName}`,
                privateNotes: 'Auto-generated onboarding tag.',
                isPrivate: false,
                tagIds: [],
                mediaIds: [],
                mediaGallery: [],
                metadata: {
                    givenName: newUser.firstName,
                    familyName: newUser.lastName,
                    gender: newUser.gender || 'Prefer not to say',
                    dates: { birth: '' },
                    emails: [newUser.email],
                    relationships: [],
                    socials: [],
                    locations: [],
                    contacts: []
                }
            };

            // Save both the user profile and their self-tag
            await appDataService.updateUserProfile(userId, newUser);
            await appDataService.saveTag(userId, selfTag);

            profile = newUser;
        } else {
            console.log(`%c[Onboarding] 📂 Profile Found. Reconciling metadata for ${userId}...`, 'color: #3b82f6;');
            // [ZEN FIX] Legacy User Healing: 
            // If they exist but lack social data (fields), provision them now.
            let needsUpdate = false;
            const updateData: any = {};

            if (!profile.personTagId) {
                console.log("[Onboarding] 🩹 Adding missing personTagId...");
                updateData.personTagId = uuidv4();
                needsUpdate = true;

                // Create the tag as well
                const selfTag: PersonTag = {
                    id: updateData.personTagId,
                    type: 'person',
                    name: profile.displayName || profile.firstName || 'Legacy Archivist',
                    description: `Digital shadow of ${profile.displayName}`,
                    privateNotes: 'Auto-generated during legacy healing.',
                    isPrivate: false,
                    tagIds: [],
                    mediaIds: [],
                    mediaGallery: [],
                    metadata: {
                        givenName: profile.firstName || '',
                        familyName: profile.lastName || '',
                        gender: profile.gender || 'Prefer not to say',
                        dates: { birth: '' },
                        emails: [profile.email],
                        relationships: [],
                        socials: [],
                        locations: [],
                        contacts: []
                    }
                };
                await appDataService.saveTag(userId, selfTag);
            }

            if (!profile.privacy) {
                console.log("[Onboarding] 🩹 Initializing privacy settings...");
                updateData.privacy = { visibility: 'public', autoShareTag: true };
                needsUpdate = true;
            }

            // [ZEN FIX] Identity Sync:
            // If the Cloud database email is different from the Auth email, update it.
            // [CLEARED]
            if (email && profile.email !== email) {
                console.log(`%c[Onboarding] 🔄 IDENTITY SYNC TRIGGERED: ${profile.email} -> ${email}`, 'background: #f43f5e; color: #fff; padding: 2px;');
                updateData.email = email;
                needsUpdate = true;

                // Also update the Self-Tag email if it exists
                if (profile.personTagId) {
                    try {
                        const selfTag = await appDataService.getTag(userId, profile.personTagId) as PersonTag;
                        if (selfTag && selfTag.metadata) {
                            selfTag.metadata.emails = [email];
                            await appDataService.saveTag(userId, selfTag);
                            console.log(`%c[Onboarding] 🏷️ Self-Tag Email Synced.`, 'color: #3b82f6;');
                        }
                    } catch (e) {
                        console.error("[Onboarding] Failed to sync Self-Tag email", e);
                    }
                }
            }

            // [ZEN FIX] Role Reconciliation:
            // Use centralized RBAC utility for promotion
            if (email || profile.email) {
                const checkUser = { ...profile, email: email || profile.email } as User;
                if (isRootUser(checkUser) && profile.role !== 'root') {
                    console.log(`%c[Onboarding] 👑 ROLE PROMOTION: ${profile.role} -> root`, 'background: #9333ea; color: #fff; padding: 2px;');
                    updateData.role = 'root';
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                console.log(`%c[Onboarding] 🩹 Applying persistent healing to Cloud...`, 'color: #3b82f6; font-weight: bold;');
                await appDataService.updateUserProfile(userId, updateData);
                profile = { ...profile, ...updateData };
            }
        }

        if (profile) {
            // 3. "House Keys" Propagation
            // We check if they have keys in their cloud secrets. If not, we push the House Keys.
            try {
                // Sync first to see what they have
                await SecretsManager.sync(userId);

                const hasKeys = !!SecretsManager.get('fireworks') || !!SecretsManager.get('xai');

                if (!hasKeys || forceHouseKeys) {
                    if (forceHouseKeys) {
                        console.log(`%c[Onboarding] 🛠️ FORCING House Keys synchronization for user: ${userId}`, 'background: #f59e0b; color: #000; font-weight: bold;');
                    } else {
                        console.log(`%c[Onboarding] 🔑 Granting House Keys to user: ${userId}`, 'color: #f0db4f; font-weight: bold;');
                    }

                    const skeleton = await getSkeleton();
                    const houseKeys = {
                        fireworksKey: skeleton?.keys?.fireworks || '',
                        grokKey: skeleton?.keys?.xai || '',
                        typesenseHost: skeleton?.keys?.typesense_host || '',
                        typesenseKey: skeleton?.keys?.typesense_key || '',
                        modelFireworks: 'accounts/fireworks/models/qwen3-vl-30b-a3b-instruct',
                        modelReserve: 'grok-4.20-0309-non-reasoning',
                        modelXAI: 'grok-4.3'
                    };

                    await SecretsManager.saveToCloud(userId, houseKeys);
                }
            } catch (e) {
                console.error("[Onboarding] Failed to propagate House Keys", e);
            }
        }

        return profile;
    }
};
