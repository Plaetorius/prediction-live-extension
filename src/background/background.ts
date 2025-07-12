// Background script for the extension
console.log('Background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Message received:', message);
  
  if (message.type === 'PREDICTION_UPDATE') {
    // Handle prediction updates
    console.log('Prediction update:', message.data);
  }
  
  sendResponse({ success: true });
}); 