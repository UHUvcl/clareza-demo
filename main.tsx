import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Clareza from './app/clareza';
import { installNetworkGuard } from './scripts/network-guard';
import './app/globals.css';
installNetworkGuard();
createRoot(document.getElementById('root')!).render(<StrictMode><Clareza /></StrictMode>);
