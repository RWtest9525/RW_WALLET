import fs from 'fs';
import https from 'https';

const url = 'https://chatgpt.com/backend-api/estuary/public_content/enc/eyJpZCI6Im1fNmEzNTVkZjVjZWQ0ODE5MTg4NjljYTFiZWQwYWY1ZmE6ZmlsZV8wMDAwMDAwMDNlODQ3MWZhYjQyZjcyZTE4NDgzYWNjOSIsInRzIjoiMjA2MjMiLCJwIjoicHlpIiwiY2lkIjoiMSIsInNpZyI6IjQyMjA1ODRiMDUwYjAxNjU0ZWM4ZmZjZTRiYjI5NGVhYjFlNWFhYjM1ODJjNDMzMGMwOTU1NmU5NmIzYTBmNmQiLCJ2IjoiMCIsImdpem1vX2lkIjpudWxsLCJjcyI6bnVsbCwiY2RuIjpudWxsLCJmbiI6bnVsbCwiY2QiOm51bGwsImNwIjpudWxsLCJtYSI6bnVsbH0=';
const file = fs.createWriteStream('scratch/avatars.png');

https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Download complete.');
    });
}).on('error', (err) => {
    console.error('Download failed:', err);
});
