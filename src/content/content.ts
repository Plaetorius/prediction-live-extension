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

  constructor() {
    this.init();
  }

  private init(): void {
    console.log('Content script started');
    this.waitForChat().then(() => {
      this.createPredictionCard();
    });
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
          <div class="w-2 h-2 bg-red-500 rounded-full mx-auto mt-2 shadow-lg animate-pulse"></div>
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

  private async handleAccept(): Promise<void> {
    console.log('Accept clicked');
    this.triggerSuccessAnimation();
    // Add your accept logic here
  }

  private async handleReject(): Promise<void> {
    console.log('Reject clicked');
    // Add your reject logic here
  }

  private triggerSuccessAnimation(): void {
    // Inline HTML for the success animation
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-gradient-radial from-green-500/10 to-transparent pointer-events-none z-[9999] animate-pulse';
    document.body.appendChild(overlay);

    const message = document.createElement('div');
    message.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-green-500 to-green-600 text-white px-10 py-5 rounded-2xl text-2xl font-bold text-center shadow-2xl z-[10000]';
    message.textContent = 'Success!';
    document.body.appendChild(message);

    setTimeout(() => {
      overlay.remove();
      message.remove();
    }, 3000);
  }
}

// Initialize content script
new ContentScript(); 