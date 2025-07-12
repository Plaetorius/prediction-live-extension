// Background script for the extension
console.log('Background script loaded');

// Store wallet connection state
let walletState = {
  isConnected: false,
  address: '',
  signClient: null as any
};

let pendingTransactionChoice: 'accept' | 'reject' | null = null;

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  console.log('Message received:', message);
  
  try {
    switch (message.action) {
      case 'getWalletStatus':
        // Return current wallet status
        sendResponse({
          isConnected: walletState.isConnected,
          address: walletState.address
        });
        break;
        
      case 'setWalletStatus':
        // Update wallet status from popup
        walletState = {
          isConnected: message.isConnected,
          address: message.address,
          signClient: message.signClient
        };
        
        // Notify all content scripts about the wallet status change
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.id) {
              await chrome.tabs.sendMessage(tab.id, {
                action: 'walletStatusChanged',
                isConnected: message.isConnected,
                address: message.address
              }).catch(() => {
                // Ignore errors for tabs that don't have our content script
              });
            }
          }
        } catch (error) {
          console.error('Error notifying content scripts:', error);
        }
        
        sendResponse({ success: true });
        break;
        
      case 'sendTransaction':
        // Handle transaction request from content script
        if (!walletState.isConnected || !walletState.signClient) {
          sendResponse({ 
            success: false, 
            error: 'Wallet not connected' 
          });
          return;
        }
        
        try {
          const result = await walletState.signClient.request({
            topic: walletState.signClient.session.getAll()[0].topic,
            request: {
              method: 'eth_sendTransaction',
              params: [message.transaction]
            },
            chainId: 'eip155:1'
          });
          
          sendResponse({ 
            success: true, 
            result: result 
          });
        } catch (error) {
          sendResponse({ 
            success: false, 
            error: (error as Error).message 
          });
        }
        break;
        
      case 'openPopup':
        // Open the extension popup
        chrome.action.openPopup();
        sendResponse({ success: true });
        break;
      case 'openPopupForTransaction':
        pendingTransactionChoice = message.choice;
        chrome.action.openPopup();
        sendResponse({ success: true });
        break;
      case 'getPendingTransactionChoice':
        sendResponse({ choice: pendingTransactionChoice });
        pendingTransactionChoice = null;
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: (error as Error).message });
  }
  
  return true; // Keep message channel open for async response
}); 