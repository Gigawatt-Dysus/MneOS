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
        fs.writeFileSync("C:/MneOS/functions/companions_backup.json", JSON.stringify(comps, null, 2));
        console.log(`Saved ${comps.length} companions to companions_backup.json`);
    }
} catch (e) {
    console.error(e);
}
