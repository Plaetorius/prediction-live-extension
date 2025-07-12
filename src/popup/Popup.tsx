import React from 'react';
import { PopupProps } from '../types';

const Popup: React.FC<PopupProps> = ({ onButtonClick }) => {
  return (
    <div className="w-80 p-5 font-sans">
      <h1 className="text-twitch-purple text-center mb-5 text-lg font-semibold">
        Twitch Title Changer
      </h1>
      <button
        onClick={onButtonClick}
        className="
          bg-twitch-purple text-white border-none py-3 px-6 text-base rounded-lg cursor-pointer
          w-full transition-colors duration-200 hover:bg-twitch-purple-dark active:bg-twitch-purple-darker
        "
      >
        Hello World
      </button>
    </div>
  );
};

export default Popup; 