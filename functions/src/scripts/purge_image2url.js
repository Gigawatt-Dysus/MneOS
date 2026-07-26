
const admin = require('firebase-admin');
const serviceAccount = require('../../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function purgeLegacyUrls() {
    console.log("🚀 Starting Global image2url.com Purge...");
    const usersSnap = await db.collection('users').get();
    let totalUpdated = 0;

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const data = userDoc.data();
        let needsUpdate = false;
        let updateData = {};

        // 1. Check AI Companions
        if (data.aiCompanions && Array.isArray(data.aiCompanions)) {
            const newCompanions = data.aiCompanions.map(ai => {
                if (ai.avatarUrl && ai.avatarUrl.includes('image2url.com')) {
                    console.log(`   [AI] Purging legacy avatar for ${ai.name} in user ${userId}`);
                    needsUpdate = true;
                    return {
                        ...ai,
                        avatarUrl: `https://ui-avatars.com/api/?name=${ai.name}&background=0D8ABC&color=fff&size=256`
                    };
                }
                return ai;
            });
            if (needsUpdate) updateData.aiCompanions = newCompanions;
        }

        // 2. Check Profile Picture
        if (data.profilePictureUrl && data.profilePictureUrl.includes('image2url.com')) {
            console.log(`   [Profile] Purging legacy profile picture for user ${userId}`);
            updateData.profilePictureUrl = `https://ui-avatars.com/api/?name=${data.displayName || 'User'}&background=random&color=fff&size=256`;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await db.collection('users').doc(userId).update(updateData);
            totalUpdated++;
        }

        // 3. Check Tags
        const tagsSnap = await db.collection('users').doc(userId).collection('tags').get();
        for (const tagDoc of tagsSnap.docs) {
            const tag = tagDoc.data();
            if (tag.metadata && tag.metadata.profilePictureUrl && tag.metadata.profilePictureUrl.includes('image2url.com')) {
                console.log(`   [Tag] Purging legacy tag image for ${tag.name} in user ${userId}`);
                await tagDoc.ref.update({
                    'metadata.profilePictureUrl': `https://ui-avatars.com/api/?name=${tag.name}&background=random&color=fff&size=256`
                });
                totalUpdated++;
            }
        }
    }

    console.log(`\n✅ Purge Complete. Total records healed: ${totalUpdated}`);
}

purgeLegacyUrls().catch(console.error);
