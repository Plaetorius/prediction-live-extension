import { WebSocketService } from '../utils/websocket-service';
import { Challenge, PredictionRequest, PredictionResponse } from '../types/websocket';

// CSS is automatically injected via manifest.json content_scripts declaration

class ContentScript {
  private container: HTMLDivElement | null = null;
  private websocketService: WebSocketService;
  private streamId: string | null = null;
  private currentChallenge: Challenge | null = null;
  private walletAddress: string = '';
  private isWalletConnected: boolean = false;

  constructor() {
    this.websocketService = new WebSocketService();
    this.init();
  }

  private async init(): Promise<void> {
    console.log('Content script started');
    this.extractStreamId();
    this.setupConnectionStatusListener();
    await this.waitForChat();
    await this.checkStreamAndConnect();
    
    // Set up periodic wallet status check
    setInterval(() => {
      this.checkWalletConnection();
    }, 5000); // Check every 5 seconds
  }

  private setupConnectionStatusListener(): void {
    this.websocketService.onConnectionStatusChange(async (connected: boolean) => {
      console.log('🔌 Connection status changed:', connected);
      if (connected) {
        await this.createWaitingMessage();
      } else {
        await this.createInactiveMessage();
      }
    });

    // Listen for wallet status changes from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'walletStatusChanged') {
        console.log('Wallet status changed:', message);
        this.refreshWalletStatus();
        sendResponse({ success: true });
      }
    });
  }

  private extractStreamId(): void {
    const url = window.location.href;
    const match = url.match(/twitch\.tv\/([^\/\?]+)/);
    if (match) {
      this.streamId = match[1];
      console.log('Extracted stream ID:', this.streamId);
    } else {
      console.error('Could not extract stream ID from URL');
    }
  }

  private waitForChat(): Promise<void> {
    return new Promise((resolve) => {
      const checkChat = () => {
        const chatContainer = document.querySelector('[data-test-selector="chat-scrollable-area__message-container"]');
        if (chatContainer) {
          resolve();
        } else {
          setTimeout(checkChat, 100);
        }
      };
      checkChat();
    });
  }

  private async checkStreamAndConnect(): Promise<void> {
    if (!this.streamId) {
      console.error('No stream ID available');
      return;
    }

    console.log('🔌 Attempting to connect to stream:', this.streamId);
    
    const connected = await this.websocketService.connectToStream(this.streamId);
    
    if (connected) {
      console.log('✅ Successfully connected to stream:', this.streamId);
      this.setupMessageListener();
    } else {
      console.log('No active stream or connection failed');
      await this.createInactiveMessage();
    }
  }

  private setupMessageListener(): void {
    document.addEventListener('challenge-update', (event: any) => {
      console.log('🎯 Content script received challenge update event:', event);
      console.log('📋 Event detail:', event.detail);
      const payload = event.detail;
      this.handleChallengeUpdate(payload);
    });

    // Listen for server responses
    document.addEventListener('prediction-response', (event: any) => {
      const response = event.detail;
      this.handleServerResponse(response);
    });
  }

  private handleChallengeUpdate(payload: any): void {
    console.log('🎯 Handling challenge update in content script:', payload);
    console.log('📋 Payload type:', payload.type);
    console.log('📋 Payload challenge:', payload.challenge);
    
    if (payload.type === 'challenge:new' && payload.challenge) {
      console.log('🎯 Processing new challenge:', payload.challenge);
      this.currentChallenge = payload.challenge;
      if (this.currentChallenge) {
        console.log('✅ Displaying challenge with options:', this.currentChallenge.options);
        this.displayChallenge(this.currentChallenge);
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      console.log('🔄 Challenge state updated:', payload.new.state);
      this.currentChallenge = payload.new;
      if (payload.new.state === 'closed') {
        this.updateChallengeToClosed();
      } else if (payload.new.state === 'resolved') {
        this.updateChallengeToResolved();
      }
    } else {
      console.log('❓ Unknown challenge update type:', payload);
    }
  }

  private handleServerResponse(response: any): void {
    console.log('Handling server response:', response);
    
    if (response.type === 'success') {
      this.triggerSuccessAnimation('Success!');
    } else if (response.type === 'failure') {
      this.triggerErrorAnimation(response.message || 'Failed');
    }
  }

  private async checkWalletConnection(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'getWalletStatus' 
      });
      
      if (response && response.isConnected) {
        this.isWalletConnected = true;
        this.walletAddress = response.address;
        console.log('Wallet connected from popup:', this.walletAddress);
      } else {
        this.isWalletConnected = false;
        this.walletAddress = '';
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      this.isWalletConnected = false;
      this.walletAddress = '';
    }
  }

  private async refreshWalletStatus(): Promise<void> {
    const previousStatus = this.isWalletConnected;
    await this.checkWalletConnection();
    
    // Only re-render if the status actually changed
    if (previousStatus !== this.isWalletConnected && this.container) {
      console.log('Wallet status changed, refreshing UI:', this.isWalletConnected);
      if (this.currentChallenge) {
        await this.displayChallenge(this.currentChallenge);
      } else if (this.websocketService.isStreamConnected()) {
        await this.createWaitingMessage();
      } else {
        await this.createInactiveMessage();
      }
    }
  }

  private async displayChallenge(challenge: Challenge): Promise<void> {
    // Check wallet connection first
    await this.checkWalletConnection();

    // Remove existing card if any
    const existingCard = document.getElementById('prediction-card-container');
    if (existingCard) {
      existingCard.remove();
    }

    // Find the chat container
    const chatContainer = document.querySelector('.Layout-sc-1xcs6mc-0.gyMdFQ.stream-chat');
    if (!chatContainer) {
      console.error('Chat container not found');
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'prediction-card-container';
    
    // Insert as first child of chat container
    chatContainer.insertBefore(this.container, chatContainer.firstChild);

    // Build wallet status section
    const walletStatusClass = this.isWalletConnected ? 'text-green-400' : 'text-red-400';
    const walletDotClass = this.isWalletConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500';
    const walletText = this.isWalletConnected ? 'Wallet Connected' : 'Wallet Disconnected';
    
    let walletDetails = '';
    if (this.isWalletConnected && this.walletAddress) {
      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      walletDetails = `<p class="text-xs text-gray-400 font-mono">${shortAddress}</p>`;
    } else {
      walletDetails = `
        <button id="connect-wallet-btn" class="
          mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold 
          rounded-lg transition-colors duration-200 border-none cursor-pointer
        ">
          🔗 Connect Wallet
        </button>
      `;
    }

    // Prediction buttons section
    let predictionButtons = '';
    if (this.isWalletConnected) {
      predictionButtons = `
        <div class="flex gap-3 justify-center">
          <button id="option-1-btn" class="
            !text-xl !font-bold
            text-white border-none py-4 px-8 rounded-lg cursor-pointer
            transition-all duration-300 ease-out uppercase tracking-wider relative overflow-hidden
            bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg
            hover:transform hover:-translate-y-1 hover:scale-105 hover:shadow-xl
            active:transform active:translate-y-0 active:scale-100
            disabled:opacity-50 disabled:cursor-not-allowed
          ">
            ${challenge.options[0]?.displayName || 'Option 1'}
            <div class="text-sm opacity-75">${challenge.options[0]?.odds || 1.0}x</div>
          </button>
          <button id="option-2-btn" class="
            !text-xl !font-bold
            text-white border-none py-4 px-8 rounded-lg cursor-pointer
            transition-all duration-300 ease-out uppercase tracking-wider relative overflow-hidden
            bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg
            hover:transform hover:-translate-y-1 hover:scale-105 hover:shadow-xl
            active:transform active:translate-y-0 active:scale-100
            disabled:opacity-50 disabled:cursor-not-allowed
          ">
            ${challenge.options[1]?.displayName || 'Option 2'}
            <div class="text-sm opacity-75">${challenge.options[1]?.odds || 1.0}x</div>
          </button>
        </div>
      `;
    } else {
      predictionButtons = `
        <div class="text-center py-4">
          <p class="text-yellow-400 text-sm mb-3">Connect your wallet to place predictions</p>
          <button id="connect-wallet-main-btn" class="
            px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold 
            rounded-xl transition-all duration-300 border-none cursor-pointer
            transform hover:scale-105 shadow-lg
          ">
            🔗 Connect Wallet to Predict
          </button>
        </div>
      `;
    }

    // Inline HTML for the challenge card
    this.container.innerHTML = `
      <div class="mt-16 bg-black border border-red-500/30 rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-red-500/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            Will the streamer win this game?
          </h3>
          <div class="w-2 h-2 bg-green-500 rounded-full mx-auto mt-2 shadow-lg animate-pulse"></div>
          <p class="text-green-400 text-sm mt-2">Active Challenge</p>
          
          <!-- Wallet Connection Status -->
          <div class="mt-3 p-3 bg-gray-800/50 rounded-lg">
            <div class="flex items-center justify-center gap-2 mb-2">
              <div class="w-2 h-2 ${walletDotClass} rounded-full shadow-lg"></div>
              <span class="text-sm ${walletStatusClass}">
                ${walletText}
              </span>
            </div>
            ${walletDetails}
          </div>
        </div>
        ${predictionButtons}
      </div>
    `;

    // Add event listeners
    const option1Btn = this.container.querySelector('#option-1-btn') as HTMLButtonElement;
    const option2Btn = this.container.querySelector('#option-2-btn') as HTMLButtonElement;
    const connectWalletBtn = this.container.querySelector('#connect-wallet-btn') as HTMLButtonElement;
    const connectWalletMainBtn = this.container.querySelector('#connect-wallet-main-btn') as HTMLButtonElement;

    if (option1Btn) {
      option1Btn.addEventListener('click', () => this.handleOptionClick(0));
    }

    if (option2Btn) {
      option2Btn.addEventListener('click', () => this.handleOptionClick(1));
    }

    if (connectWalletBtn) {
      connectWalletBtn.addEventListener('click', () => this.openPopup());
    }

    if (connectWalletMainBtn) {
      connectWalletMainBtn.addEventListener('click', () => this.openPopup());
    }
  }

  private async createWaitingMessage(): Promise<void> {
    // Check wallet connection first
    await this.checkWalletConnection();

    // Remove existing card if any
    const existingCard = document.getElementById('prediction-card-container');
    if (existingCard) {
      existingCard.remove();
    }

    // Find the chat container
    const chatContainer = document.querySelector('.Layout-sc-1xcs6mc-0.gyMdFQ.stream-chat');
    if (!chatContainer) {
      console.error('Chat container not found');
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'prediction-card-container';
    
    // Insert as first child of chat container
    chatContainer.insertBefore(this.container, chatContainer.firstChild);

    // Build wallet status section
    const walletStatusClass = this.isWalletConnected ? 'text-green-400' : 'text-red-400';
    const walletDotClass = this.isWalletConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500';
    const walletText = this.isWalletConnected ? 'Wallet Connected' : 'Wallet Disconnected';
    
    let walletDetails = '';
    if (this.isWalletConnected && this.walletAddress) {
      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      walletDetails = `<p class="text-xs text-gray-400 font-mono">${shortAddress}</p>`;
    } else {
      walletDetails = `
        <button id="connect-wallet-btn" class="
          mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold 
          rounded-lg transition-colors duration-200 border-none cursor-pointer
        ">
          🔗 Connect Wallet
        </button>
      `;
    }

    // Inline HTML for waiting message
    this.container.innerHTML = `
      <div class="mt-16 bg-black border border-green-500/30 rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-green-500/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            Waiting for Challenge
          </h3>
          <div class="w-2 h-2 bg-green-500 rounded-full mx-auto mt-2 shadow-lg animate-pulse"></div>
          <p class="text-green-400 text-sm mt-2">Connected - Ready for predictions</p>
          
          <!-- Wallet Connection Status -->
          <div class="mt-3 p-3 bg-gray-800/50 rounded-lg">
            <div class="flex items-center justify-center gap-2 mb-2">
              <div class="w-2 h-2 ${walletDotClass} rounded-full shadow-lg"></div>
              <span class="text-sm ${walletStatusClass}">
                ${walletText}
              </span>
            </div>
            ${walletDetails}
          </div>
        </div>
      </div>
    `;

    // Add event listener for wallet connect button
    const connectWalletBtn = this.container.querySelector('#connect-wallet-btn') as HTMLButtonElement;
    if (connectWalletBtn) {
      connectWalletBtn.addEventListener('click', () => this.openPopup());
    }
  }

  private async createInactiveMessage(): Promise<void> {
    // Check wallet connection first
    await this.checkWalletConnection();

    // Remove existing card if any
    const existingCard = document.getElementById('prediction-card-container');
    if (existingCard) {
      existingCard.remove();
    }

    // Find the chat container
    const chatContainer = document.querySelector('.Layout-sc-1xcs6mc-0.gyMdFQ.stream-chat');
    if (!chatContainer) {
      console.error('Chat container not found');
      return;
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'prediction-card-container';
    
    // Insert as first child of chat container
    chatContainer.insertBefore(this.container, chatContainer.firstChild);

    // Build wallet status section
    const walletStatusClass = this.isWalletConnected ? 'text-green-400' : 'text-red-400';
    const walletDotClass = this.isWalletConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500';
    const walletText = this.isWalletConnected ? 'Wallet Connected' : 'Wallet Disconnected';
    
    let walletDetails = '';
    if (this.isWalletConnected && this.walletAddress) {
      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      walletDetails = `<p class="text-xs text-gray-400 font-mono">${shortAddress}</p>`;
    } else {
      walletDetails = `
        <button id="connect-wallet-btn" class="
          mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold 
          rounded-lg transition-colors duration-200 border-none cursor-pointer
        ">
          🔗 Connect Wallet
        </button>
      `;
    }

    // Inline HTML for inactive message
    this.container.innerHTML = `
      <div class="mt-16 bg-black border border-gray-500/30 rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-gray-500/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            No Active Challenges
          </h3>
          <div class="w-2 h-2 bg-gray-500 rounded-full mx-auto mt-2 shadow-lg"></div>
          <p class="text-gray-400 text-sm mt-2">Waiting for streamer to start a challenge</p>
          
          <!-- Wallet Connection Status -->
          <div class="mt-3 p-3 bg-gray-800/50 rounded-lg">
            <div class="flex items-center justify-center gap-2 mb-2">
              <div class="w-2 h-2 ${walletDotClass} rounded-full shadow-lg"></div>
              <span class="text-sm ${walletStatusClass}">
                ${walletText}
              </span>
            </div>
            ${walletDetails}
          </div>
        </div>
      </div>
    `;

    // Add event listener for wallet connect button
    const connectWalletBtn = this.container.querySelector('#connect-wallet-btn') as HTMLButtonElement;
    if (connectWalletBtn) {
      connectWalletBtn.addEventListener('click', () => this.openPopup());
    }
  }

  private openPopup(): void {
    // Open the extension popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  }

  private async handleOptionClick(optionIndex: number): Promise<void> {
    console.log('Option clicked:', optionIndex);
    
    if (!this.websocketService.isStreamConnected() || !this.currentChallenge) {
      this.triggerErrorAnimation('Not connected to stream or no active challenge');
      return;
    }

    const option = this.currentChallenge.options[optionIndex];
    if (!option) {
      this.triggerErrorAnimation('Invalid option selected');
      return;
    }

    // Check wallet connection before proceeding
    await this.checkWalletConnection();
    
    if (!this.isWalletConnected) {
      this.triggerErrorAnimation('Please connect your wallet first');
      return;
    }

    // For now, use a fixed amount and token name
    const predictionRequest: PredictionRequest = {
      challengeId: this.currentChallenge.id,
      userId: 'dev-user-123', // Fixed for development
      optionId: option.id,
      amount: 100, // Fixed amount for now
      tokenName: option.tokenName
    };

    // Send prediction via API
    const response = await this.websocketService.sendPrediction(predictionRequest);
    
    if (response.success) {
      this.showPredictionSuccess(response);
    } else {
      this.triggerErrorAnimation(response.message || 'Failed to place prediction');
    }
  }

  private showPredictionSuccess(response: PredictionResponse): void {
    // Show success popup with response JSON
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/50 pointer-events-auto z-[9999]';
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white text-black p-6 rounded-2xl shadow-2xl z-[10000] max-w-md w-full mx-4';
    popup.innerHTML = `
      <div class="text-center mb-4">
        <h3 class="text-xl font-bold text-green-600 mb-2">Prediction Placed!</h3>
        <p class="text-sm text-gray-600">Response from server:</p>
      </div>
      <pre class="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">${JSON.stringify(response, null, 2)}</pre>
      <button id="close-popup" class="mt-4 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">Close</button>
    `;
    document.body.appendChild(popup);

    // Add close functionality
    const closeBtn = popup.querySelector('#close-popup') as HTMLButtonElement;
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
        popup.remove();
      });
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
        popup.remove();
      }
    }, 5000);
  }

  private updateChallengeToClosed(): void {
    if (this.container) {
      const title = this.container.querySelector('h3');
      if (title) {
        title.textContent = 'Challenge Closed';
      }
      
      const buttons = this.container.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
      });
    }
  }

  private updateChallengeToResolved(): void {
    if (this.container) {
      const title = this.container.querySelector('h3');
      if (title) {
        title.textContent = 'Challenge Resolved';
      }
      
      const buttons = this.container.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
      });
    }
  }

  private triggerErrorAnimation(message: string): void {
    // Inline HTML for the error animation
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gradient-radial from-red-500/10 to-transparent pointer-events-none z-[9999] animate-pulse';
    document.body.appendChild(overlay);

    const messageEl = document.createElement('div');
    messageEl.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-red-500 to-red-600 text-white px-10 py-5 rounded-2xl text-2xl font-bold text-center shadow-2xl z-[10000]';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
      overlay.remove();
      messageEl.remove();
    }, 3000);
  }

  private triggerSuccessAnimation(message: string): void {
    // Inline HTML for the success animation
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gradient-radial from-green-500/10 to-transparent pointer-events-none z-[9999] animate-pulse';
    document.body.appendChild(overlay);

    const messageEl = document.createElement('div');
    messageEl.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-green-500 to-green-600 text-white px-10 py-5 rounded-2xl text-2xl font-bold text-center shadow-2xl z-[10000]';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
      overlay.remove();
      messageEl.remove();
    }, 3000);
  }
}

// Initialize content script
new ContentScript(); 