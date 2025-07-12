import { WebSocketService } from '../utils/walletconnect';

// Remove unused imports and inline HTML for the prediction card and success animation

function injectContentCSS() {
  fetch(chrome.runtime.getURL('content.css'))
    .then(res => res.text())
    .then(css => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    });
}

injectContentCSS();

class ContentScript {
  private container: HTMLDivElement | null = null;
  private websocketService: WebSocketService;
  private streamId: string | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.websocketService = new WebSocketService();
    this.init();
  }

  private init(): void {
    console.log('Content script started');
    this.extractStreamId();
    this.waitForChat().then(() => {
      this.checkStreamAndConnect();
    });
  }

  private extractStreamId(): void {
    // Extract streamer ID from URL
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

    // Check if stream is active and connect
    const connected = await this.websocketService.connectToStream(this.streamId);
    
    if (connected) {
      this.isConnected = true;
      console.log('Connected to stream:', this.streamId);
      this.createPredictionCard();
      this.setupMessageListener();
    } else {
      console.log('No active stream or connection failed');
      this.createPredictionCard();
    }
  }

  private setupMessageListener(): void {
    // Listen for server responses
    document.addEventListener('prediction-response', (event: any) => {
      const response = event.detail;
      this.handleServerResponse(response);
    });
  }

  private handleServerResponse(response: any): void {
    console.log('Handling server response:', response);
    
    if (response.type === 'success') {
      this.triggerSuccessAnimation('Success!');
    } else if (response.type === 'failure') {
      this.triggerErrorAnimation(response.message || 'Failed');
    }
  }

  private createPredictionCard(): void {
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

    // Inline HTML for the prediction card
    this.container.innerHTML = `
      <div class="mt-16 bg-black border border-red-500/30 rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-red-500/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            Will the streamer win this game?
          </h3>
          <div class="w-2 h-2 bg-green-500 rounded-full mx-auto mt-2 shadow-lg animate-pulse"></div>
          <p class="text-green-400 text-sm mt-2">Connected to stream</p>
        </div>
        <div class="flex gap-3 justify-center">
          <button id="accept-btn" class="
            !text-xl !font-bold
            text-white border-none py-4 px-8 rounded-lg cursor-pointer
            transition-all duration-300 ease-out uppercase tracking-wider relative overflow-hidden
            bg-gradient-to-br from-green-500 to-green-600 shadow-lg
            hover:transform hover:-translate-y-1 hover:scale-105 hover:shadow-xl
            active:transform active:translate-y-0 active:scale-100
            disabled:opacity-50 disabled:cursor-not-allowed
          ">
            Accept
          </button>
          <button id="reject-btn" class="
            !text-xl !font-bold
            text-white border-none py-4 px-8 rounded-lg cursor-pointer
            transition-all duration-300 ease-out uppercase tracking-wider relative overflow-hidden
            bg-gradient-to-br from-red-500 to-red-600 shadow-lg
            hover:transform hover:-translate-y-1 hover:scale-105 hover:shadow-xl
            active:transform active:translate-y-0 active:scale-100
            disabled:opacity-50 disabled:cursor-not-allowed
          ">
            Reject
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    const acceptBtn = this.container.querySelector('#accept-btn') as HTMLButtonElement;
    const rejectBtn = this.container.querySelector('#reject-btn') as HTMLButtonElement;

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => this.handleAccept());
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => this.handleReject());
    }
  }

  /*private createInactiveMessage(): void {
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

    // Inline HTML for inactive message
    this.container.innerHTML = `
      <div class="mt-16 bg-black border border-gray-500/30 rounded-2xl p-5 mx-4 shadow-2xl mb-4">
        <div class="text-center mb-5 pb-4 border-b border-gray-500/20">
          <h3 class="!text-2xl text-white font-bold m-0 drop-shadow-lg">
            No Active Prediction
          </h3>
          <div class="w-2 h-2 bg-gray-500 rounded-full mx-auto mt-2 shadow-lg"></div>
          <p class="text-gray-400 text-sm mt-2">Waiting for streamer to start a prediction</p>
        </div>
      </div>
    `;
  }*/

  private async handleAccept(): Promise<void> {
    console.log('Accept clicked');
    
    if (!this.isConnected) {
      this.triggerErrorAnimation('Not connected to stream');
      return;
    }

    // Send prediction via WebSocket
    await this.websocketService.sendPrediction('accept');
  }

  private async handleReject(): Promise<void> {
    console.log('Reject clicked');
    
    if (!this.isConnected) {
      this.triggerErrorAnimation('Not connected to stream');
      return;
    }

    // Send prediction via WebSocket
    await this.websocketService.sendPrediction('reject');
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
}

// Initialize content script
new ContentScript(); 