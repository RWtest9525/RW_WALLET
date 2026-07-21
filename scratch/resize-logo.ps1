$url = "https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg"
$dest192 = "c:\Users\Yash Vishal\Desktop\rw wallet june 26\public\logo_192.png"
$dest512 = "c:\Users\Yash Vishal\Desktop\rw wallet june 26\public\logo_512.png"

# Download the image bytes
$webclient = New-Object System.Net.WebClient
$imageBytes = $webclient.DownloadData($url)
$ms = New-Object System.IO.MemoryStream
$ms.Write($imageBytes, 0, $imageBytes.Length)
$ms.Position = 0

# Load into drawing image
Add-Type -AssemblyName System.Drawing
$srcImage = [System.Drawing.Image]::FromStream($ms)

# Helper function to resize and save as PNG
function Resize-Image($image, $newWidth, $newHeight, $outputPath) {
    $newImage = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newImage)
    
    # Set high quality settings
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)
    
    # Save as PNG
    $newImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Dispose
    $graphics.Dispose()
    $newImage.Dispose()
}

# Resize to 192x192
Resize-Image $srcImage 192 192 $dest192
Write-Output "Saved 192x192 logo to $dest192"

# Resize to 512x512
Resize-Image $srcImage 512 512 $dest512
Write-Output "Saved 512x512 logo to $dest512"

# Dispose source
$srcImage.Dispose()
$ms.Close()
$ms.Dispose()
