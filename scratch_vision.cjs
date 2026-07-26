const fs = require('fs');
const img = fs.readFileSync('C:/Users/artin/.gemini/antigravity/brain/cdff6619-730c-4859-a924-6448e44e9d32/media__1782442614408.jpg').toString('base64');
require('dotenv').config({path: '.env.local'});
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        contents:[{
            parts:[
                {text:'Describe the icons in this image EXACTLY. Are they faces/statues or hexagons? Does it say Calliope under them? Also describe the most recent uploaded image media__1782448448'},
                {inlineData:{mimeType:'image/jpeg', data:img}}
            ]
        }]
    })
})
.then(r=>r.json())
.then(console.log)
.catch(console.error);
