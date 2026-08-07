<#
.SYNOPSIS
  Regenerates Station's PWA/home-screen icon set from the pattern data below
  and writes the shipped sizes straight into public/.

.DESCRIPTION
  The icon is drawn with GDI+ (System.Drawing), not exported from the design
  tool that produced the original reference artwork - the grid geometry and
  every lit cell's colour were measured pixel-by-pixel from that reference
  (a 1024x1024 PNG the user supplied) and are reproduced here as plain data,
  so the icon can be regenerated at any resolution with crisp edges instead
  of being resized from one fixed bitmap. See docs/DECISIONS.md DEC-028 for
  the full rationale (grid size, the flat/edge-to-edge convention, colours).

  Run from anywhere; paths below are resolved relative to this script's own
  location, which is expected to stay at tools/icon/build-icon.ps1.

.EXAMPLE
  powershell -File tools/icon/build-icon.ps1
#>

Add-Type -AssemblyName System.Drawing

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $toolsDir)
$publicDir = Join-Path $repoRoot "public"
$master = 1024

function HexToColor($hex) {
    $hex = $hex.TrimStart('#')
    $r = [Convert]::ToInt32($hex.Substring(0,2), 16)
    $g = [Convert]::ToInt32($hex.Substring(2,2), 16)
    $b = [Convert]::ToInt32($hex.Substring(4,2), 16)
    return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

# ---- Exact geometry, measured pixel-by-pixel from the user's reference PNG
#      (1024x1024) - not eyeballed. Grid is 16x16, origin 96px, pitch 52px
#      (46px cell + 6px gap), centred: 96 + 16*52 + 96 = 1024. ----
$gridSize = 16
$origin = 96.0
$pitch = 52.0
$cell = 46.0
$cellRadius = 10.0
$unlitColor = HexToColor "#1d1b27"

# Exact per-row lit column ranges + colour (each row is one flat colour, not
# a per-cell gradient - confirmed by sampling every cell centre). Rows 0 and
# 15 are fully empty in the source and are simply absent here.
$rows = @(
    @{ r=1;  c0=5;  c1=11; hex="#c87060" },
    @{ r=2;  c0=4;  c1=12; hex="#c16865" },
    @{ r=3;  c0=3;  c1=12; hex="#b85f6c" },
    @{ r=4;  c0=3;  c1=6;  hex="#a15e7d" },
    @{ r=5;  c0=3;  c1=5;  hex="#8b5e8e" },
    @{ r=6;  c0=3;  c1=7;  hex="#766998" },
    @{ r=7;  c0=4;  c1=10; hex="#6373a1" },
    @{ r=8;  c0=5;  c1=11; hex="#567ba2" },
    @{ r=9;  c0=8;  c1=12; hex="#4e8a99" },
    @{ r=10; c0=10; c1=12; hex="#567c94" },
    @{ r=11; c0=9;  c1=12; hex="#656291" },
    @{ r=12; c0=3;  c1=12; hex="#736086" },
    @{ r=13; c0=3;  c1=11; hex="#816378" },
    @{ r=14; c0=4;  c1=10; hex="#8e6f64" }
)

function RoundedRectPath($x, $y, $w, $h, $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function DrawIcon($bmp, [bool]$showUnlit) {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $size = $bmp.Width
    $scale = $size / $master

    # Flat, edge-to-edge, alpha-free square - iOS (and Android adaptive
    # icons) apply their own corner mask on top of whatever is shipped here.
    # A pre-rounded or transparent source reads as "a square inside a
    # square" once that mask lands - see DEC-028.
    $bg = HexToColor "#0b0c14"
    $g.Clear($bg)

    $depthRect = New-Object System.Drawing.Rectangle -ArgumentList @(0, 0, $size, [int]($size * 0.65))
    $depthColorTop = [System.Drawing.Color]::FromArgb(36, 130, 110, 170)
    $depthColorBottom = [System.Drawing.Color]::FromArgb(0, 130, 110, 170)
    $depthBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList @(
        $depthRect, $depthColorTop, $depthColorBottom, [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($depthBrush, $depthRect)
    $depthBrush.Dispose()

    # Thin double ring, echoing the reference artwork's own frame - well
    # inside the true canvas edge so it never competes with the OS mask.
    # Two plain scalar blocks rather than looping a config array: a
    # hashtable-in-array here previously handed a boxed [object[]] out
    # through a property read instead of a plain double, and `2 * <that>`
    # failed looking for op_Multiply on System.Object[] - simplest fix is
    # not to box the value at all.
    $ringColor = [System.Drawing.Color]::FromArgb(150, 200, 111, 80)

    $ring1Width = [Math]::Max(1.0, 3.0 * $scale)
    $ringPen1 = New-Object System.Drawing.Pen -ArgumentList @($ringColor, $ring1Width)
    $r1 = 42.0 * $scale
    $path1 = RoundedRectPath $r1 $r1 ($size - 2.0*$r1) ($size - 2.0*$r1) (85.0 * $scale)
    $g.DrawPath($ringPen1, $path1)
    $path1.Dispose(); $ringPen1.Dispose()

    $ring2Width = [Math]::Max(1.0, 6.0 * $scale)
    $ringPen2 = New-Object System.Drawing.Pen -ArgumentList @($ringColor, $ring2Width)
    $r2 = 55.0 * $scale
    $path2 = RoundedRectPath $r2 $r2 ($size - 2.0*$r2) ($size - 2.0*$r2) (85.0 * $scale)
    $g.DrawPath($ringPen2, $path2)
    $path2.Dispose(); $ringPen2.Dispose()

    # Unlit cells first (so lit cells always paint cleanly on top even if a
    # row entry and an unlit cell ever overlapped at a boundary).
    if ($showUnlit) {
        $unlitBrush = New-Object System.Drawing.SolidBrush($unlitColor)
        for ($row = 0; $row -lt $gridSize; $row++) {
            for ($col = 0; $col -lt $gridSize; $col++) {
                $x = ($origin + $col * $pitch) * $scale
                $y = ($origin + $row * $pitch) * $scale
                $path = RoundedRectPath $x $y ($cell*$scale) ($cell*$scale) ($cellRadius*$scale)
                $g.FillPath($unlitBrush, $path)
                $path.Dispose()
            }
        }
        $unlitBrush.Dispose()
    }

    foreach ($row in $rows) {
        $brush = New-Object System.Drawing.SolidBrush((HexToColor $row.hex))
        for ($col = $row.c0; $col -le $row.c1; $col++) {
            $x = ($origin + $col * $pitch) * $scale
            $y = ($origin + $row.r * $pitch) * $scale
            $path = RoundedRectPath $x $y ($cell*$scale) ($cell*$scale) ($cellRadius*$scale)
            $g.FillPath($brush, $path)
            $path.Dispose()
        }
        $brush.Dispose()
    }
    $g.Dispose()
}

function ResizeSave($srcBmp, $targetSize, $path) {
    $dst = New-Object System.Drawing.Bitmap -ArgumentList @($targetSize, $targetSize)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $targetSize, $targetSize)
    $g.Dispose()
    $dst.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
}

$masterBmp = New-Object System.Drawing.Bitmap -ArgumentList @($master, $master)
DrawIcon $masterBmp $true
$masterBmp.Save((Join-Path $toolsDir "icon-master-1024.png"), [System.Drawing.Imaging.ImageFormat]::Png)

ResizeSave $masterBmp 512 (Join-Path $publicDir "icons\icon-512.png")
ResizeSave $masterBmp 192 (Join-Path $publicDir "icons\icon-192.png")
ResizeSave $masterBmp 180 (Join-Path $publicDir "apple-touch-icon.png")
ResizeSave $masterBmp 32  (Join-Path $publicDir "favicon-32.png")
$masterBmp.Dispose()

Write-Output "Icon set regenerated in $publicDir (and tools/icon/icon-master-1024.png for reference)."
