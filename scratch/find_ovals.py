import os
from PIL import Image

def main():
    img_path = 'public/avatars_sheet.png'
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found.")
        return

    img = Image.open(img_path)
    # Convert to RGB if not already
    img = img.convert('RGB')
    w, h = img.size
    pixels = img.load()

    # We will find connected components of non-black pixels
    # Since background is pure black, any pixel with sum of R,G,B > 30 is non-black
    visited = set()
    components = []

    # To avoid recursion limits and speed up, we will do a simple scanline / grid check
    # Since ovals are large, we can scan every 2 pixels to find seeds
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if (x, y) in visited:
                continue
            
            r, g, b = pixels[x, y]
            if r > 10 or g > 10 or b > 10:
                # Found seed of a non-black region, do BFS to find bounding box
                q = [(x, y)]
                visited.add((x, y))
                min_x, max_x = x, x
                min_y, max_y = y, y
                
                while q:
                    cx, cy = q.pop(0)
                    # Check 4-neighbors with a step of 2 to be fast
                    for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                            nr, ng, nb = pixels[nx, ny]
                            if nr > 10 or ng > 10 or nb > 10:
                                visited.add((nx, ny))
                                q.append((nx, ny))
                                if nx < min_x: min_x = nx
                                if nx > max_x: max_x = nx
                                if ny < min_y: min_y = ny
                                if ny > max_y: max_y = ny
                
                # Check if it's a valid size oval
                if (max_x - min_x) > 50 and (max_y - min_y) > 50:
                    components.append({
                        'min_x': min_x,
                        'max_x': max_x,
                        'min_y': min_y,
                        'max_y': max_y,
                        'w': max_x - min_x,
                        'h': max_y - min_y,
                        'cx': (min_x + max_x) / 2,
                        'cy': (min_y + max_y) / 2
                    })

    print(f"Total components found: {len(components)}")
    if len(components) != 10:
        # If we didn't find exactly 10, print details and exit
        for idx, c in enumerate(components):
            print(f"Comp {idx}: bbox=[{c['min_x']}, {c['min_y']}, {c['max_x']}, {c['max_y']}], w={c['w']}, h={c['h']}")
        return

    # Sort components:
    # 1. Split into two rows based on centerY (since rows are vertically separated)
    components.sort(key=lambda c: c['cy'])
    row1 = components[:5]
    row2 = components[5:]
    
    # 2. Sort each row by centerX (left to right)
    row1.sort(key=lambda c: c['cx'])
    row2.sort(key=lambda c: c['cx'])
    
    sorted_components = row1 + row2
    
    print("\nSorted Avatars coordinates:")
    for idx, c in enumerate(sorted_components):
        row = idx // 5
        col = idx % 5
        # Calculate square crop bounds centered on the oval
        # Since they are vertical ovals, the head is centered horizontally, but vertically
        # the face is in the upper middle area. Let's shift the vertical center slightly up by 5% of oval height.
        oval_h = c['h']
        target_cy = c['cy'] - (oval_h * 0.05)
        
        # Crop size equal to the width of the oval
        crop_size = c['w']
        sx = c['cx'] - crop_size / 2
        sy = target_cy - crop_size / 2
        
        print(f"Row {row}, Col {col}: sx={sx:.1f}, sy={sy:.1f}, size={crop_size:.1f} (bbox: [{c['min_x']}, {c['min_y']}, {c['max_x']}, {c['max_y']}])")

if __name__ == '__main__':
    main()
