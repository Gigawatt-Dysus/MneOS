const fs = require('fs');

const filePath = "C:/MneOS/rescue_data_admin/users.json";
const userId = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const users = JSON.parse(raw);
    const user = users.find(u => u.id === userId || u._id === userId);
    
    if (!user) {
        console.log("User not found!");
    } else {
        const comps = user.aiCompanions || [];
        console.log(`Found ${comps.length} companions.`);
        comps.forEach((c, index) => {
            console.log(`\n=================== COMPANION ${index + 1}: ${c.name} (ID: ${c.id}) ===================`);
            console.log(`Bio: ${c.bio || 'None'}`);
            console.log(`Persona: ${c.persona || 'None'}`);
            console.log(`Is Primary: ${c.isPrimary}`);
            console.log(`Preferred Model: ${c.preferredModel || 'None'}`);
            console.log(`Avatar URL: ${c.avatarUrl || 'None'}`);
            console.log(`Voice Settings: ${JSON.stringify(c.voiceSettings || {})}`);
            console.log(`Custom Persona Description Length: ${c.customPersonaDescription ? c.customPersonaDescription.length : 0}`);
            if (c.customPersonaDescription) {
                console.log(`Custom Persona Description (first 300 chars): ${c.customPersonaDescription.substring(0, 300)}...`);
            }
        });
    }
} catch (e) {
    console.error(e);
}
