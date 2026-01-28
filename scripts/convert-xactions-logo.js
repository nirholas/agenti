const sharp = require('sharp');

sharp('/workspaces/agenti/xactions.jpg')
  .resize(128, 128)
  .png()
  .toFile('/workspaces/agenti/awesome-openrouter-pr/apps/xactions/logo.png')
  .then(() => console.log('✅ Converted xactions.jpg to logo.png (128x128)'))
  .catch(e => console.error('Error:', e.message));
