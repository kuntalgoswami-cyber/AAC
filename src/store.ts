import { create } from 'zustand';
import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('soc_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

interface SecurityState {
    token: string | null;
    socketConnected: boolean;
    logs: any[];
    hitlQueue: any[];
    setToken: (token: string | null) => void;
    setSocketConnected: (status: boolean) => void;
    setLogs: (logs: any[]) => void;
    addLog: (log: any) => void;
    setHitlQueue: (queue: any[]) => void;
    logout: () => void;
}

export const useSecurityStore = create<SecurityState>((set) => ({
    token: localStorage.getItem('soc_token'),
    socketConnected: false,
    logs: [],
    hitlQueue: [],
    setToken: (token) => {
        if (token) localStorage.setItem('soc_token', token);
        else localStorage.removeItem('soc_token');
        set({ token });
    },
    setSocketConnected: (status) => set({ socketConnected: status }),
    setLogs: (logs) => set({ logs }),
    addLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 1000) })),
    setHitlQueue: (queue) => set({ hitlQueue: queue }),
    logout: () => {
        localStorage.removeItem('soc_token');
        set({ token: null, logs: [], hitlQueue: [] });
    }
}));

api.interceptors.response.use(res => res, error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
        useSecurityStore.getState().logout();
    }
    return Promise.reject(error);
});
