# Prediction Live Extension

A Chrome extension enabling real-time prediction challenges for Twitch esports streams using Fan Tokens.

## The Problem It Solves

### Seamless Twitch Integration
- Make predictions directly on Twitch without leaving the platform
- Avoids streaming rights issues by not rebroadcasting content

### Secure and Fair Predictions
- Short, real-time predictions (e.g., "Who will score next?") reduce match manipulation risk
- No new collusion risks beyond existing esports protocols

### Real Utility for Fan Tokens
- Transforms Fan Tokens from collectibles into interactive tools
- Team performance directly influences token demand
- No arbitrary limitations or penalties for high engagement

## How It Works

During esports matches, users can participate in real-time predictions:

1. A prediction appears (e.g., "Which team will secure the next Baron?")
2. Users vote using team-specific Fan Tokens
3. When the outcome is determined, losing tokens are swapped to winning team tokens
4. This creates buying pressure on successful teams' tokens, making prices reflect performance

## Installation

1. Clone this repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Building the Extension

Create the `/dist` folder with:

```bash
npm run build
```

## Installing in Chrome

1. Go to `chrome://extensions`
2. Enable "Developer mode" (top-right switch)
3. Click "Load unpacked"
4. Select the `/dist` folder

## Development

For easier development, we recommend using the [Reload Extensions](https://chromewebstore.google.com/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) Chrome extension to quickly reload your extension after making changes.

## Project Structure

- `/src`: Extension source code
  - `/background`: Background scripts
  - `/content`: Scripts injected into Twitch pages
  - `/popup`: Popup UI interface
  - `/utils`: Utilities, including MetaMask integration

## Required Permissions

- Scripting
- ActiveTab
- Storage
- Tabs

## Compatibility

This extension works with:
- https://www.twitch.tv/*
- https://m.twitch.tv/*

## License

All rights reserved © Prediction Live 2025