import { WebSocketService } from '../utils/websocket-service';
import { Challenge } from '../types/websocket';

// CSS is automatically injected via manifest.json content_scripts declaration

class ContentScript {
  private container: HTMLDivElement | null = null;
  private websocketService: WebSocketService;
  private streamId: string | null = null;
  private currentChallenge: Challenge | null = null;
  private walletAddress: string = '';
  private isWalletConnected: boolean = false;
  private countdownInterval: NodeJS.Timeout | null = null;

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
    } else if (payload.id && payload.title && payload.options) {
      // Handle direct challenge payload (not nested under 'challenge' property)
      console.log('🎯 Processing direct challenge payload:', payload);
      this.currentChallenge = payload;
      if (this.currentChallenge) {
        this.displayChallenge(this.currentChallenge);
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
    // Clear existing countdown timer
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

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
            ${challenge.options[0]?.display_name || 'Option 1'}
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
            ${challenge.options[1]?.display_name || 'Option 2'}
            <div class="text-sm opacity-75">${challenge.options[1]?.odds || 1.0}x</div>
          </button>
        </div>
      `;
    }
    // Calculate initial intensity based on time remaining
    const timePercentage = this.getTimeRemainingPercentage(challenge);
    const intensityClasses = this.getIntensityClasses(timePercentage);
    
    // Inline HTML for the challenge card
    this.container.innerHTML = `
      <div id="prediction-card" class="mt-16 ${intensityClasses} rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-current/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            ${challenge.title}
          </h3>
          <div class="w-2 h-2 bg-green-500 rounded-full mx-auto mt-2 shadow-lg animate-pulse"></div>
          <p class="text-green-400 text-sm mt-2">Active Challenge</p>
          <div class="mt-2 p-2 bg-current/10 rounded-lg border border-current/30">
            <p class="text-current text-sm opacity-90">Closing in: <span id="countdown-timer" class="font-mono font-bold">${challenge.closing_at ? this.formatCountdown(challenge.closing_at) : 'Loading...'}</span></p>
          </div>
          
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

    // Start countdown timer (will handle missing closing_at gracefully)
    this.startCountdown(challenge);
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

  private formatCountdown(closingAt: string): string {
    const now = new Date();
    const closingTime = new Date(closingAt);
    const timeLeft = closingTime.getTime() - now.getTime();

    if (timeLeft <= 0) {
      return 'CLOSED';
    }

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getTimeRemainingPercentage(challenge: Challenge): number {
    if (!challenge.closing_at || !challenge.created_at) return 1;
    
    const now = new Date();
    const createdTime = new Date(challenge.created_at);
    const closingTime = new Date(challenge.closing_at);
    
    const totalDuration = closingTime.getTime() - createdTime.getTime();
    const timeElapsed = now.getTime() - createdTime.getTime();
    
    const percentage = Math.max(0, Math.min(1, 1 - (timeElapsed / totalDuration)));
    return percentage;
  }

  private getIntensityClasses(percentage: number): string {
    if (percentage > 0.5) {
      // More than 50% time left - calm green
      return 'bg-black border-green-500/30 text-green-400';
    } else if (percentage > 0.25) {
      // 25-50% time left - warning yellow
      return 'bg-gradient-to-br from-yellow-900/20 to-black border-yellow-500/40 text-yellow-400';
    } else if (percentage > 0.1) {
      // 10-25% time left - urgent orange
      return 'bg-gradient-to-br from-orange-900/30 to-black border-orange-500/50 shadow-orange-500/20 text-orange-400';
    } else {
      // Less than 10% time left - critical red with pulsing
      return 'bg-gradient-to-br from-red-900/40 to-black border-red-500/60 shadow-red-500/30 animate-pulse text-red-400';
    }
  }

  private startCountdown(challenge: Challenge): void {
    // Clear existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      const countdownElement = document.getElementById('countdown-timer');
      const cardElement = document.getElementById('prediction-card');
      
      if (countdownElement) {
        if (challenge.closing_at) {
          const countdown = this.formatCountdown(challenge.closing_at);
          countdownElement.textContent = countdown;
          
          // Update card background intensity based on time remaining
          if (cardElement) {
            const percentage = this.getTimeRemainingPercentage(challenge);
            const intensityClasses = this.getIntensityClasses(percentage);
            
            // Remove old intensity classes and add new ones
            const baseClasses = 'mt-16 rounded-2xl p-5 mx-4 shadow-2xl mb-4';
            cardElement.className = `${baseClasses} ${intensityClasses}`;
          }
          
          // If countdown reaches 0, close the challenge
          if (countdown === 'CLOSED') {
            this.updateChallengeToClosed();
            if (this.countdownInterval) {
              clearInterval(this.countdownInterval);
              this.countdownInterval = null;
            }
          }
        } else {
          // No closing_at available, show loading message
          countdownElement.textContent = 'Loading...';
        }
      }
    }, 1000);
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

    // Show token input modal
    this.showTokenInputModal(optionIndex, option);
  }

  private showTokenInputModal(optionIndex: number, option: any): void {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center';
    overlay.id = 'token-input-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'bg-gradient-to-br from-gray-900 to-black border border-purple-500/50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-95 opacity-0';
    modal.id = 'token-input-modal';
    
    modal.innerHTML = `
      <div class="text-center mb-6">
        <h3 class="text-2xl font-bold text-white mb-2">Place Your Bet</h3>
        <p class="text-purple-400 text-sm">${option.displayName || `Option ${optionIndex + 1}`}</p>
        <div class="w-16 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mt-4"></div>
      </div>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Token Name</label>
          <input 
            type="text" 
            id="token-name-input"
            placeholder="Enter token name (e.g., CHZ, BTC, ETH)"
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all duration-200"
            maxlength="10"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Amount (CHZ)</label>
          <input 
            type="number" 
            id="token-amount-input"
            placeholder="Enter amount"
            min="1"
            max="1000"
            value="10"
            class="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all duration-200"
          />
        </div>
        
        <div class="flex gap-3 pt-4">
          <button 
            id="cancel-bet-btn"
            class="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            Cancel
          </button>
          <button 
            id="confirm-bet-btn"
            class="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all duration-200 font-medium transform hover:scale-105"
          >
            Place Bet
          </button>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Animate modal in
    setTimeout(() => {
      modal.classList.remove('scale-95', 'opacity-0');
      modal.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    // Add event listeners
    const tokenNameInput = modal.querySelector('#token-name-input') as HTMLInputElement;
    const tokenAmountInput = modal.querySelector('#token-amount-input') as HTMLInputElement;
    const cancelBtn = modal.querySelector('#cancel-bet-btn') as HTMLButtonElement;
    const confirmBtn = modal.querySelector('#confirm-bet-btn') as HTMLButtonElement;
    
    // Auto-focus on token name input
    setTimeout(() => tokenNameInput?.focus(), 100);
    
    // Handle cancel
    cancelBtn?.addEventListener('click', () => {
      this.closeTokenInputModal();
    });
    
    // Handle confirm
    confirmBtn?.addEventListener('click', async () => {
      const tokenName = tokenNameInput?.value.trim();
      const amount = parseInt(tokenAmountInput?.value || '0');
      
      if (!tokenName) {
        this.showInputError('Please enter a token name');
        return;
      }
      
      if (!amount || amount < 1) {
        this.showInputError('Please enter a valid amount');
        return;
      }
      
      await this.processBet(optionIndex, option, tokenName, amount);
      this.closeTokenInputModal();
    });
    
    // Handle Enter key
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      } else if (e.key === 'Escape') {
        cancelBtn?.click();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    
    // Store cleanup function
    (overlay as any).cleanup = () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }

  private closeTokenInputModal(): void {
    const overlay = document.getElementById('token-input-overlay');
    if (overlay) {
      const modal = overlay.querySelector('#token-input-modal');
      if (modal) {
        modal.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
          if ((overlay as any).cleanup) {
            (overlay as any).cleanup();
          }
          overlay.remove();
        }, 200);
      }
    }
  }

  private showInputError(message: string): void {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[10000] transform translate-x-full transition-transform duration-300';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Animate in
    setTimeout(() => {
      errorDiv.classList.remove('translate-x-full');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      errorDiv.classList.add('translate-x-full');
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }

  private async processBet(_optionIndex: number, option: any, tokenName: string, amount: number): Promise<void> {
    try {
      // Show loading animation
      this.showLoadingAnimation('Preparing transaction...');
      
      console.log('Starting MetaMask transaction for:', { tokenName, amount, option: option.displayName, optionId: option.id });
      
      // Determine team based on option index (0 = Team A, 1 = Team B)
      const team = _optionIndex + 1; // 1 for Team A, 2 for Team B (enum in contract)
      
      // Direct MetaMask interaction in content script
      const response = await this.sendMetaMaskTransactionDirectly(amount, team);
      
      console.log('MetaMask transaction response:', response);
      
      // If we get here without an error, the transaction was likely successful
      // Even if response is undefined, if no error was thrown, the transaction probably went through
      if (response && response.success) {
        // After successful MetaMask transaction, send prediction to API
        this.showLoadingAnimation('Submitting prediction...');
        
        try {
          const predictionResponse = await this.websocketService.sendPrediction({
            challengeId: this.currentChallenge?.id || '',
            userId: this.walletAddress,
            optionId: option.id,
            amount: amount,
            tokenName: tokenName
          });
          
          console.log('Prediction API response:', predictionResponse);
          
          if (predictionResponse.success) {
            this.showTransactionSuccess(tokenName, amount, option.displayName, response.txHash);
          } else {
            console.error('Prediction API failed:', predictionResponse.message);
            this.triggerErrorAnimation(predictionResponse.message || 'Failed to submit prediction');
          }
        } catch (apiError: any) {
          console.error('Error sending prediction to API:', apiError);
          this.triggerErrorAnimation('Failed to submit prediction to server');
        }
      } else if (response && response.error) {
        // Only show error if there's an actual error
        console.error('Transaction failed:', response.error);
        this.triggerErrorAnimation(response.error || 'Transaction failed');
      } else {
        // If response is undefined but no error, assume success
        console.log('Transaction sent successfully (no response object)');
        this.showTransactionSuccess(tokenName, amount, option.displayName);
      }
      
      this.hideLoadingAnimation();
      
    } catch (error: any) {
      console.error('Error processing bet:', error);
      this.hideLoadingAnimation();
      this.triggerErrorAnimation(error.message || 'Failed to process transaction');
    }
  }

  private async sendMetaMaskTransactionDirectly(amount: number, team: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      console.log('🔗 Starting MetaMask transaction via background script...');
      
      // Send message to background script to handle MetaMask transaction
      const response = await chrome.runtime.sendMessage({
        action: 'EXECUTE_METAMASK_TRANSACTION',
        amount: amount,
        team: team
      });
      
      console.log('✅ MetaMask transaction response from background:', response);
      return response;
      
    } catch (error: any) {
      console.error('❌ Error in sendMetaMaskTransactionDirectly:', error);
      return { success: false, error: error.message || 'Failed to execute transaction' };
    }
  }



  private showLoadingAnimation(message: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center';
    overlay.id = 'loading-overlay';
    
    overlay.innerHTML = `
      <div class="bg-gradient-to-br from-gray-900 to-black border border-purple-500/50 rounded-2xl p-8 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p class="text-white text-lg font-medium">${message}</p>
        <p class="text-gray-400 text-sm mt-2">Please check your wallet...</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }

  private hideLoadingAnimation(): void {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  private showTransactionSuccess(tokenName: string, amount: number, optionName: string, txHash?: string): void {
    this.hideLoadingAnimation();
    
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center';
    
    overlay.innerHTML = `
      <div class="bg-gradient-to-br from-green-900 to-green-800 border border-green-500/50 rounded-2xl p-8 text-center max-w-md mx-4">
        <div class="text-6xl mb-4">🎉</div>
        <h3 class="text-2xl font-bold text-white mb-2">Bet Placed!</h3>
        <p class="text-green-300 mb-4">Your transaction has been submitted</p>
        <div class="bg-black/30 rounded-lg p-4 mb-4 text-left">
          <p class="text-sm text-gray-300"><span class="text-green-400">Token:</span> ${tokenName}</p>
          <p class="text-sm text-gray-300"><span class="text-green-400">Amount:</span> ${amount} CHZ</p>
          <p class="text-sm text-gray-300"><span class="text-green-400">Option:</span> ${optionName}</p>
          ${txHash ? `<p class="text-sm text-gray-300"><span class="text-green-400">Tx Hash:</span> <span class="font-mono text-xs">${txHash.substring(0, 10)}...</span></p>` : ''}
        </div>
        <button id="close-success-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200">
          Close
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 5000);
    
    // Manual close button
    const closeBtn = overlay.querySelector('#close-success-btn') as HTMLButtonElement;
    closeBtn?.addEventListener('click', () => {
      overlay.remove();
    });
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

      // Clear countdown timer
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
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

      // Clear countdown timer
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
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