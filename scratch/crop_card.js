const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcPath = 'C:\\Users\\Yash Vishal\\.gemini\\antigravity-ide\\brain\\8c2b7fd4-828b-4cca-bfe1-4dac5020b3a4\\media__1784575534951.png';
const destPath = path.join(__dirname, '..', 'public', 'profile_card_bg.png');

console.log('Source Image:', srcPath);
console.log('Destination Image:', destPath);

// Let's use PowerShell via ScriptBlock in a script file
const psScript = `
Add-Type -AssemblyName System.Drawing
$imgPath = '${srcPath.replace(/\\/g, '\\\\')}'
$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)

$minX = $bmp.Width
$maxX = 0
$minY = $bmp.Height
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        if (!($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240)) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1
Write-Host "Cropping box: X=$minX Y=$minY W=$cropW H=$cropH"

$rect = New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)
$cropped = $bmp.Clone($rect, $bmp.PixelFormat)
$cropped.Save('${destPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$cropped.Dispose()
Write-Host "CROPPED CARD SAVED SUCCESSFULLY"
`;

const psPath = path.join(__dirname, 'crop.ps1');
fs.writeFileSync(psPath, psScript);

try {
    const out = execSync(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, { encoding: 'utf8' });
    console.log('PowerShell output:\n', out);
} catch(e) {
    console.error('PowerShell error:\n', e.message, e.stdout, e.stderr);
}
