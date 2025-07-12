export interface PredictionData {
  title: string;
  status: 'active' | 'completed' | 'failed';
  timestamp: number;
}

export interface ExtensionMessage {
  type: 'PREDICTION_UPDATE' | 'SUCCESS' | 'ERROR';
  data?: any;
}

export interface PredictionCardProps {
  title?: string;
  onAccept: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  isLoading?: boolean;
}

export interface PopupProps {
  onButtonClick: () => void;
}

export interface WalletInfo {
  address: string;
  isConnected: boolean;
} 