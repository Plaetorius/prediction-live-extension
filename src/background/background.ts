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
    // Handle both 'action' and 'type' message formats
    const action = message.action || message.type;
    
    switch (action) {
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
          // Use WalletConnect to send transaction on Chiliz testnet
          const result = await walletState.signClient.request({
            topic: walletState.signClient.session.getAll()[0].topic,
            request: {
              method: 'eth_sendTransaction',
              params: [message.transaction]
            },
            chainId: 'eip155:88882' // Chiliz testnet
          });
          
          console.log('Transaction sent successfully:', result);
          sendResponse({ 
            success: true, 
            result: result,
            transactionHash: result
          });
        } catch (error) {
          console.error('Transaction failed:', error);
          sendResponse({ 
            success: false, 
            error: (error as Error).message 
          });
        }
        break;


        
              case 'injectMetaMaskTransaction':
          // Handle MetaMask transaction injection
          console.log('Received injectMetaMaskTransaction request:', message);
          try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('Active tab found:', tab);
            if (!tab.id) {
              console.error('No active tab found');
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }

            console.log('Injecting MetaMask utility script...');
            // First, inject the MetaMask utility script
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['metamask-injection.js']
              });
              console.log('MetaMask utility script injected successfully');
            } catch (injectionError) {
              console.error('Failed to inject MetaMask utility script:', injectionError);
              sendResponse({ success: false, error: 'Failed to inject MetaMask script' });
              return;
            }

            console.log('Executing MetaMask transaction...');
            // Then execute the transaction
            const result = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: async (message) => {
                try {
                  console.log('Calling MetaMask transaction function with amount:', message.amount);
                  
                  // Check if the function exists
                  if (typeof (window as any).metaMaskTransaction !== 'function') {
                    console.error('metaMaskTransaction function not found');
                    return { success: false, error: 'MetaMask transaction function not available' };
                  }
                  
                  const response = await (window as any).metaMaskTransaction(message.amount);
                  console.log('MetaMask transaction response:', response);
                  return response;
                } catch (error: any) {
                  console.error('Error calling MetaMask transaction:', error);
                  return { success: false, error: error.message || 'Transaction failed' };
                }
              },
              args: [message]
            });

            console.log('Script execution result:', result);
            if (result && result[0] && result[0].result) {
              console.log('Transaction result:', result[0].result);
              sendResponse(result[0].result);
            } else {
              console.error('No result from injected script, result:', result);
              sendResponse({ success: false, error: 'Failed to execute transaction - no result' });
            }
          } catch (error) {
            console.error('MetaMask injection failed:', error);
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
        
      case 'EXECUTE_METAMASK_TRANSACTION':
        // Handle MetaMask transaction via background script
        console.log('Received EXECUTE_METAMASK_TRANSACTION request:', message);
        try {
          // Get the sender's tab ID
          const tabId = _sender.tab?.id;
          console.log('Sender tab ID:', tabId);
          if (!tabId) {
            console.error('No sender tab ID found');
            sendResponse({ success: false, error: 'No sender tab ID found' });
            return;
          }

          console.log('Injecting MetaMask transaction script...');
          // Inject and execute the MetaMask transaction in the main world
          const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: async (amount, team) => {
              try {
                console.log('🔗 Checking for MetaMask...');
                console.log('Window object:', typeof window);
                console.log('Ethereum object:', typeof (window as any).ethereum);
                console.log('Ethereum available:', (window as any).ethereum);
                
                // Check if MetaMask is installed with retry
                let ethereum = (window as any).ethereum;
                let retryCount = 0;
                const maxRetries = 10;
                
                while (typeof ethereum === 'undefined' && retryCount < maxRetries) {
                  console.log(`Retry ${retryCount + 1}/${maxRetries} - waiting for MetaMask...`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  ethereum = (window as any).ethereum;
                  retryCount++;
                }
                
                if (typeof ethereum === 'undefined') {
                  console.error('❌ MetaMask not found after retries');
                  return { success: false, error: 'MetaMask not installed' };
                }
                
                console.log('✅ MetaMask found, checking connection...');
                
                // Request account access
                const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
                if (!accounts || accounts.length === 0) {
                  console.error('❌ No accounts found');
                  return { success: false, error: 'No accounts found' };
                }
                
                const account = accounts[0];
                console.log('✅ Connected account:', account);
                
                // Check if we're on the correct network (Chiliz testnet)
                const chainId = await ethereum.request({ method: 'eth_chainId' });
                console.log('🔗 Current chain ID:', chainId);
                
                // Chiliz testnet chain ID is 0x15b32 (88882)
                if (chainId !== '0x15b32') {
                  console.log('🔄 Switching to Chiliz testnet...');
                  try {
                    await ethereum.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x15b32' }],
                    });
                    console.log('✅ Switched to Chiliz testnet');
                  } catch (switchError: any) {
                    console.error('❌ Failed to switch network:', switchError);
                    return { success: false, error: 'Failed to switch to Chiliz testnet' };
                  }
                }
                
                console.log('💰 Preparing transaction...');
                
                const contractAddress = '0x5c4f413e25ec5ee063b38f3f74ec3aa0a0b6a2b5';
                // For now, let's skip the approval check and go directly to the bet
                // We'll need the actual CHZ token address later
                console.log('⚠️ Skipping token approval check - need actual CHZ token address');
                
                // For now, we'll place the bet directly without token approval
                // TODO: Add proper CHZ token approval when we have the correct address
                const requiredAmount = amount * 1e18;
                
                console.log('🎯 Placing bet...');
                
                // Function signature for placeBet(uint256 amount, Team team)
                // placeBet(uint256,uint8) = 0x4a25d94a
                const functionSignature = '4a25d94a'; // Remove the 0x prefix
                
                // Encode parameters: amount (uint256) and team (uint8)
                const amountInWei = requiredAmount.toString(16).padStart(64, '0');
                const teamValue = team || 0; // Default to Team A if not specified
                const teamHex = teamValue.toString(16).padStart(64, '0');
                
                // Combine function signature and parameters
                const data = functionSignature + amountInWei + teamHex;
                
                const transactionParameters = {
                  to: contractAddress,
                  from: account,
                  value: '0x0', // No ETH transfer, only token transfer
                  data: '0x' + data, // Add the 0x prefix back
                  gas: '0x186A0', // 100000 gas for contract interaction
                };
                
                console.log('📤 Sending transaction...');
                
                // Send transaction
                const txHash = await ethereum.request({
                  method: 'eth_sendTransaction',
                  params: [transactionParameters],
                });
                
                console.log('✅ Transaction sent:', txHash);
                return { success: true, txHash };
                
              } catch (error: any) {
                console.error('❌ MetaMask transaction error:', error);
                return { success: false, error: error.message || 'Transaction failed' };
              }
            },
            args: [message.amount, message.team]
          });

          console.log('Script execution result:', result);
          if (result && result[0] && result[0].result) {
            console.log('Transaction result:', result[0].result);
            sendResponse(result[0].result);
          } else {
            console.error('No result from injected script, result:', result);
            // Add more detailed error information
            const errorDetails = result && result[0] ? result[0].result : 'No result object';
            console.error('Error details:', errorDetails);
            sendResponse({ success: false, error: `Failed to execute transaction - ${errorDetails}` });
          }
        } catch (error) {
          console.error('MetaMask transaction failed:', error);
          sendResponse({ 
            success: false, 
            error: (error as Error).message 
          });
        }
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