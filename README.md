# Close Friends for Instagram - Chrome Extension

A Chrome extension to help manage your Instagram Close Friends list.

## Setup

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Backend Setup

The extension requires a backend server running on `http://localhost:3000`. Make sure to:

1. Start the backend server
2. Have the following endpoints available:
   - POST `/api/validatekey` - Validates access key and Instagram cookies
   - GET/POST `/api/saveprogress` - Manages user progress

## Usage

1. Log in to Instagram in your Chrome browser
2. Click the extension icon
3. Enter your access key
4. Use the controls to:
   - Start collecting followers
   - Pause the process
   - Continue from where you left off
   - Stop and reset the process

## Features

- Automatic follower collection
- Progress tracking
- Pause and resume functionality
- Proxy image loading
- Progress auto-saving

## Requirements

- Google Chrome browser
- Active Instagram account
- Valid access key
- Backend server running 