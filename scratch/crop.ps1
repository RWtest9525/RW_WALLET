Add-Type -AssemblyName System.Drawing
$imgPath = 'C:\Users\Yash Vishal\.gemini\antigravity-ide\brain\8c2b7fd4-828b-4cca-bfe1-4dac5020b3a4\media__1784576260150.png'
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
Write-Host "Cropping box: X=$minX Y=$minY W=$cropW H=$cropH (Image Size: $($bmp.Width)x$($bmp.Height))"

$rect = New-Object System.Drawing.Rectangle($minX, $minY, $cropW, $cropH)
$cropped = $bmp.Clone($rect, $bmp.PixelFormat)
$outPath = 'c:\Users\Yash Vishal\Desktop\rw wallet june 26\public\profile_card_bg.png'
$cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$cropped.Dispose()
Write-Host "CROPPED CARD BACKGROUND SAVED SUCCESSFULLY"
