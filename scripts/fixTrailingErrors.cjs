const fs = require('fs');
const path = require('path');

const replacements = [
    {
        file: '../src/components/AccessioningGateway/useStagingProcessor.ts',
        from: '../../services/firebase/backup',
        to: '../../services/sovereignBackup'
    },
    {
        file: '../src/components/subviews/CommunicationsOverlay.tsx',
        from: '../../services/firebase/chat',
        to: '../../services/sovereignChat'
    },
    {
        file: '../src/hooks/useGigiData.ts',
        from: '../services/firebase/chat',
        to: '../services/sovereignChat'
    },
    {
        file: '../src/services/sovereignChat.ts',
        from: '../searchService',
        to: './searchService'
    }
];

replacements.forEach(rep => {
    const filePath = path.join(__dirname, rep.file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(rep.from, rep.to);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', rep.file);
});
