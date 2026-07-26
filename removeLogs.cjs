const fs = require('fs');
const path = require('path');

const files = [
  'src/firebaseConfig.ts',
  'src/services/serviceManager.ts',
  'src/services/googlePhotosService.ts',
  'src/services/ai/azureVision.ts',
  'src/services/ai/grokVision.ts',
  'src/services/ai/mediaEnrichment.ts',
  'src/index.tsx',
  'src/utils/SecretsManager.ts',
  'src/services/onboardingService.ts',
  'src/services/sovereignEntities.ts',
  'src/hooks/useModelGateway.ts',
  'src/services/ai/modelRegistryManager.ts',
  'src/components/matrix/ComposerCard.tsx',
  'src/services/SovereignHealthService.ts',
  'src/services/LifePulseService.ts',
  'src/App.tsx'
];

files.forEach(f => {
  const fp = path.join(__dirname, f);
  if (fs.existsSync(fp)) {
    let content = fs.readFileSync(fp, 'utf8');
    
    // Replace logic
    content = content.replace(/console\.log\("🔥 Core Engine Initialized[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[System\] ATTEMPTING CLOUD CONNECTION..."\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[System\] CLOUD MODE ACTIVE"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[GooglePhotos\] Service v20[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[AzureVision\] Service loaded[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[GrokVision\] Service loaded[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[Enrichment\] Service loaded[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[System\] GIGI BOOT SEQUENCE INITIATED"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[System\] Env Check VITE_XAI_API_KEY: READY"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("🔥 \[SYSTEM\] ZEN CACHE BUST DEPLOYMENT:[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[SecretsManager\] Syncing from Cloud..."\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[SecretsManager\] No cloud configuration found[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`\[Onboarding\] 🛰️ Heartbeat:[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`\[getUserProfile\] 🔬 Network fetch:[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`\[Onboarding\] 📂 Profile Found\. Reconciling[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`\[Onboarding\] ⚖️ Identity Check:[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[ModelGateway\] Syncing AI Model Registry..."\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`⚡ Cache optimistically merged for[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[ModelRegistry\] 🧠 Neural Map Updated:.*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[ModelRegistry\] 🧠 Neural Map Updated:", [^\)]*\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[ComposerCard\] Physical location pre-loaded successfully:", [^\)]*\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\(`\[SovereignHealth\] 🩺 Starting geo health audit[^`]*`\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[GeoScrub\] ✅ No address anomalies detected\."\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[LifePulse\] 🛡️ Typesense deprecated[^"]*"\);?/g, '// [CLEARED]');
    content = content.replace(/console\.log\("\[App\] 🔍 Initializing Search Matrix..."\);?/g, '// [CLEARED]');

    fs.writeFileSync(fp, content, 'utf8');
    console.log('Processed:', f);
  } else {
    console.log('Missing:', f);
  }
});
