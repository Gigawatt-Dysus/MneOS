const axios = require('axios');

const b2Url = "https://media.gigiwatt.com/file/LifeOS-Media/users/9MPVGVTxE8dXvkCrl1XrWHQzCl23/uploads/1764160012431_RME_RennFair__1987_face_only2.jpg";
const firebaseStorageUrl = "https://firebasestorage.googleapis.com/v0/b/gigi-time-machine.firebasestorage.app/o/users%2F9MPVGVTxE8dXvkCrl1XrWHQzCl23%2Fuploads%2F1764160012431_RME_RennFair__1987_face_only2.jpg?alt=media&token=c0cdd782-8a3c-4615-9c0d-e68db44ac47b";

async function check() {
    try {
        console.log("Checking B2 URL...");
        const res = await axios.head(b2Url);
        console.log(`B2 URL response: ${res.status}`);
    } catch (e) {
        console.log(`B2 URL failed: ${e.message}`);
    }
    
    try {
        console.log("Checking Firebase URL...");
        const res = await axios.head(firebaseStorageUrl);
        console.log(`Firebase URL response: ${res.status}`);
    } catch (e) {
        console.log(`Firebase URL failed: ${e.message}`);
    }
}

check();
