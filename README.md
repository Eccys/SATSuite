# SATSuite Question Bank Answer Hider

A browser extension that hides answers and explanations on the SAT Question Bank website (https://satsuitequestionbank.collegeboard.org) until you're ready to see them.

![Extension Preview](https://raw.githubusercontent.com/username/SATSuite/main/screenshots/preview.png)

## Features

- Automatically hides answers and explanations on question pages
- Adds Show/Hide buttons that match the Add to PDF/Cancel button style
- Smooth fade-in animation when revealing answers (optional)
- Buttons positioned at the top-right of answer container
- Works on the digital results page at https://satsuitequestionbank.collegeboard.org/digital/results
- Intelligently handles navigation between questions without page reloads
- Fixes scrolling-related button issues
- Toggle animations on/off by clicking the extension icon in the toolbar (disabled by default)

## Installation

### Firefox

#### Temporary Installation (for development)

1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to this project folder and select the `manifest.json` file
5. The extension will be loaded temporarily and will be removed when Firefox is closed

#### Permanent Installation

To create a permanent installation:

1. Zip the contents of this project folder
2. Open Firefox and navigate to `about:addons`
3. Click on the gear icon and select "Install Add-on From File..."
4. Select the zip file you created
5. Follow the prompts to complete installation

### Chrome / Edge

This extension also supports Chromium-based browsers:

1. For Chrome compatibility, rename `manifest.v3.json` to `manifest.json` (or keep both files if you want to maintain compatibility with both browsers)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer Mode" in the top-right corner
4. Click "Load unpacked" and select this project folder
5. The extension will be installed in development mode

## Usage

1. Visit the SAT Question Bank website
2. Navigate to a question
3. The answer and explanation will be hidden by default
4. Click the "Show Answer" button when you're ready to see the answer
5. Click the "Hide Answer" button to hide the answer again
6. To toggle animations on/off, click the extension icon in the browser toolbar:
   - Blue icon: Animations disabled (default)
   - Green icon: Animations enabled

## Development

This extension uses:
- JavaScript for the content script logic
- CSS for styling the toggle button and hiding answers
- Firefox WebExtensions API

## License

MIT License - See [LICENSE](LICENSE) file for details.

Version: 1.3.1 