#!/bin/bash

# Check if rsvg-convert is installed
if ! command -v rsvg-convert &> /dev/null; then
    echo "rsvg-convert is not installed. Please install librsvg2-bin package."
    exit 1
fi

# Convert standard icons
rsvg-convert -w 48 -h 48 icons/icon-48.png.svg -o icons/icon-48.png
rsvg-convert -w 96 -h 96 icons/icon-96.png.svg -o icons/icon-96.png

# Convert enabled icons
rsvg-convert -w 48 -h 48 icons/icon-enabled-48.png.svg -o icons/icon-enabled-48.png
rsvg-convert -w 96 -h 96 icons/icon-enabled-96.png.svg -o icons/icon-enabled-96.png

echo "Icons converted successfully!" 