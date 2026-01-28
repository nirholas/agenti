import sharp from 'sharp';
import path from 'path';

async function convertNewsLogo() {
  const input = '/workspaces/agenti/news.jpg';
  const output = '/workspaces/agenti/awesome-openrouter-pr/apps/free-crypto-news/logo.png';
  
  try {
    await sharp(input)
      .resize(128, 128)
      .png()
      .toFile(output);
    console.log('✅ news.jpg → free-crypto-news/logo.png');
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
  }
}

convertNewsLogo();
