import React, { useEffect, useState } from 'react';
import { SocialService } from '../lib/social';
import { Profile } from '../types';
import { Users, FileText, Activity, AlertTriangle, CheckCircle, Info, Plus, Trash2, Power, Search, Film, Star, Settings, Globe, Heart } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { TmdbService } from '../services/tmdb';

interface AdminDashboardProps {
    onNavigate: (page: string, params?: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'announcements' | 'playlists' | 'featured' | 'settings'>('overview');
    const [stats, setStats] = useState({ totalUsers: 0, totalPlaylists: 0, activeAnnouncements: 0 });
    const [users, setUsers] = useState<Profile[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [allPlaylists, setAllPlaylists] = useState<any[]>([]);
    const [featuredMovies, setFeaturedMovies] = useState<any[]>([]);
    const [appSettings, setAppSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);

    // Filter/Search State
    const [playlistSearch, setPlaylistSearch] = useState('');

    // Movie Search State
    const [movieSearchQuery, setMovieSearchQuery] = useState('');
    const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);
    const [isSearchingMovies, setIsSearchingMovies] = useState(false);

    // Form State
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' as 'info' | 'warning' | 'success' });

    useEffect(() => {
        if (!isAdmin) return;
        loadAllData();
    }, [isAdmin]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [statsData, usersData, announcementsData, playlistsData, featuredData, settingsData] = await Promise.all([
                SocialService.getAdminStats(),
                SocialService.getAllUsers(),
                SocialService.getAnnouncements(),
                SocialService.getAllPlaylists(),
                SocialService.getFeaturedMovies(),
                SocialService.getAppSettings()
            ]);
            setStats(statsData);
            setUsers(usersData);
            setAnnouncements(announcementsData);
            setAllPlaylists(playlistsData);
            setFeaturedMovies(featuredData);
            setAppSettings(settingsData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSetting = async (key: string, value: string) => {
        try {
            await SocialService.updateAppSetting(key, value);
            alert('Setting saved!');
        } catch (e) {
            console.error(e);
            alert('Failed to save setting');
        }
    };

    const handleCreateAnnouncement = async () => {
        if (!newAnnouncement.title || !newAnnouncement.content) return;
        try {
            await SocialService.createAnnouncement(newAnnouncement.title, newAnnouncement.content, newAnnouncement.type);
            setNewAnnouncement({ title: '', content: '', type: 'info' });
            loadAllData(); // Refresh
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        try {
            await SocialService.deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleAnnouncement = async (id: string, currentStatus: boolean) => {
        try {
            await SocialService.toggleAnnouncement(id, !currentStatus);
            setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
        } catch (e) {
            console.error(e);
        }
    };

    const handleSearchMovies = async () => {
        if (!movieSearchQuery.trim()) return;
        setIsSearchingMovies(true);
        try {
            const results = await TmdbService.search(movieSearchQuery);
            setMovieSearchResults(results);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearchingMovies(false);
        }
    }

    const handleAddFeaturedMovie = async (movie: any) => {
        try {
            await SocialService.addFeaturedMovie(movie);
            setMovieSearchResults([]); // Clear results
            setMovieSearchQuery(''); // Clear search
            loadAllData(); // Refresh list to show new movie
        } catch (e) {
            console.error(e);
            alert('Failed to add movie.');
        }
    };

    const handleRemoveFeaturedMovie = async (id: string) => {
        if (!confirm('Remove from featured?')) return;
        try {
            await SocialService.removeFeaturedMovie(id);
            setFeaturedMovies(prev => prev.filter(m => m.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    const filteredPlaylists = allPlaylists.filter(p =>
        p.name.toLowerCase().includes(playlistSearch.toLowerCase()) ||
        (p.profiles?.username || '').toLowerCase().includes(playlistSearch.toLowerCase())
    );

    if (!isAdmin) return <div className="p-20 text-center text-red-500">Access Denied</div>;

    return (
        <div className="min-h-screen bg-[#0f1014] pt-6 px-4 md:px-12 pb-20">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Admin Dashboard</h1>
            <p className="text-zinc-500 mb-8 text-sm">Platform management and insights</p>

            {/* Tabs */}
            <div className="flex gap-6 mb-8 border-b border-zinc-800/50 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'overview' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'users' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Users
                </button>
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'announcements' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Announcements
                </button>
                <button
                    onClick={() => setActiveTab('playlists')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'playlists' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Playlists
                </button>
                <button
                    onClick={() => setActiveTab('featured')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'featured' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Featured Movies
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`pb-3 text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'settings' ? 'text-white border-b border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    Settings
                </button>
            </div>

            {loading ? (
                <div className="space-y-8">
                    {/* Skeleton for Overview/Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
                                <div className="h-4 w-24 bg-white/5 rounded mb-4" />
                                <div className="h-10 w-16 bg-white/10 rounded" />
                            </div>
                        ))}
                    </div>

                    {/* Skeleton for Tables/Lists */}
                    <div className="border border-zinc-800 rounded-lg overflow-hidden animate-pulse">
                        <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                            <div className="h-5 w-32 bg-white/5 rounded" />
                        </div>
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-white/5" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-32 bg-white/5 rounded" />
                                        <div className="h-3 w-48 bg-white/5 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-[#0f1014] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="p-8 border-b border-white/5 bg-zinc-900/20">
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                            <Settings size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white tracking-tight">System Configuration</h3>
                                            <p className="text-zinc-500 text-sm">Manage global application settings and URLs</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    {/* Site URL */}
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-wider">
                                            <Globe size={14} /> Site Base URL
                                        </label>
                                        <div className="flex gap-0 relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-zinc-600 font-mono text-sm">https://</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={appSettings.site_url?.replace('https://', '').replace('http://', '') || ''}
                                                onChange={(e) => setAppSettings((prev: any) => ({ ...prev, site_url: `https://${e.target.value.replace(/^https?:\/\//, '')}` }))}
                                                placeholder="stream.app"
                                                className="flex-1 bg-black/50 border border-white/10 rounded-l-xl pl-16 pr-4 py-4 text-white placeholder:text-zinc-800 focus:border-white/20 focus:bg-white/5 outline-none transition-all font-mono text-sm"
                                            />
                                            <button
                                                onClick={() => handleSaveSetting('site_url', appSettings.site_url)}
                                                className="px-6 bg-white/5 hover:bg-white/10 border-y border-r border-white/10 rounded-r-xl text-white font-bold text-sm transition-all hover:px-8 active:scale-95"
                                            >
                                                Save
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-zinc-600 pl-1">
                                            Used for generating Watch Party invites and Playlist share links.
                                        </p>
                                    </div>

                                    {/* Donation URL (Optional) */}
                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <label className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-wider">
                                            <Heart size={14} /> Donation / Support URL
                                        </label>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={appSettings.donation_url || ''}
                                                onChange={(e) => setAppSettings((prev: any) => ({ ...prev, donation_url: e.target.value }))}
                                                placeholder="https://ko-fi.com/username"
                                                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-zinc-800 focus:border-white/20 focus:bg-white/5 outline-none transition-all font-mono text-sm"
                                            />
                                            <button
                                                onClick={() => handleSaveSetting('donation_url', appSettings.donation_url)}
                                                className="px-6 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors active:scale-95"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>

                                    {/* Registration Toggle - Minimalist Refinement */}
                                    <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/5">
                                        <div>
                                            <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                                <Users size={14} /> Registration
                                            </h4>
                                            <p className="text-zinc-600 text-xs">
                                                {appSettings.registration_enabled === 'true'
                                                    ? 'New users are allowed to sign up.'
                                                    : 'New user registration is currently disabled.'}
                                            </p>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                const newValue = appSettings.registration_enabled === 'true' ? 'false' : 'true';
                                                // Optimistic update
                                                setAppSettings((prev: any) => ({ ...prev, registration_enabled: newValue }));
                                                try {
                                                    await SocialService.updateAppSetting('registration_enabled', newValue);
                                                } catch (e) {
                                                    console.error(e);
                                                    setAppSettings((prev: any) => ({ ...prev, registration_enabled: appSettings.registration_enabled }));
                                                }
                                            }}
                                            className={`relative w-11 h-6 rounded-full transition-all duration-300 border ${appSettings.registration_enabled === 'true'
                                                ? 'bg-white border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                                                : 'bg-transparent border-zinc-700 hover:border-zinc-600'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${appSettings.registration_enabled === 'true'
                                                ? 'translate-x-[22px] bg-black'
                                                : 'translate-x-[2px] bg-zinc-600'
                                                }`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <Users size={16} className="text-zinc-500" />
                                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total Users</span>
                                </div>
                                <h3 className="text-4xl font-bold text-white tracking-tighter">{stats.totalUsers}</h3>
                            </div>
                            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <Activity size={16} className="text-zinc-500" />
                                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total Playlists</span>
                                </div>
                                <h3 className="text-4xl font-bold text-white tracking-tighter">{stats.totalPlaylists}</h3>
                            </div>
                            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg">
                                <div className="flex items-center gap-3 mb-4">
                                    <AlertTriangle size={16} className="text-zinc-500" />
                                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Active Announcements</span>
                                </div>
                                <h3 className="text-4xl font-bold text-white tracking-tighter">{stats.activeAnnouncements}</h3>
                            </div>
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="border border-zinc-800 rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
                                <h3 className="font-bold text-white text-sm">Registered Users</h3>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        className="bg-black/50 text-xs text-white pl-9 pr-4 py-2 rounded border border-zinc-800 focus:border-zinc-600 outline-none w-64 placeholder:text-zinc-600"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-900/50 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                                        <tr>
                                            <th className="px-6 py-3">User</th>
                                            <th className="px-6 py-3">Role</th>
                                            <th className="px-6 py-3">Joined</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50 text-sm">
                                        {users.map(u => (
                                            <tr key={u.id} className="hover:bg-zinc-900/30 transition-colors">
                                                <td className="px-6 py-3 flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden">
                                                        <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=27272a&color=fff&bold=true`} className="w-full h-full object-cover grayscale" />
                                                    </div>
                                                    <span className="text-zinc-300 font-medium">{u.username}</span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${u.role === 'admin' ? 'bg-white text-black border-white' :
                                                        u.role === 'moderator' ? 'bg-zinc-800 text-zinc-300 border-zinc-700' :
                                                            'text-zinc-500 border-transparent'
                                                        }`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-zinc-600 text-xs font-mono">
                                                    {new Date().toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={() => onNavigate('profile', { id: u.id })}
                                                        className="text-white hover:text-zinc-300 text-xs font-bold hover:underline"
                                                    >
                                                        Review
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ANNOUNCEMENTS TAB */}
                    {activeTab === 'announcements' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* List */}
                            <div className="lg:col-span-2 space-y-3">
                                {announcements.map(a => (
                                    <div key={a.id} className="border border-zinc-800 p-5 rounded-lg flex justify-between items-start group hover:border-zinc-700 transition-colors bg-zinc-900/20">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-widest font-bold ${a.type === 'warning' ? 'border-zinc-700 text-zinc-400' :
                                                    a.type === 'success' ? 'bg-white text-black border-white' :
                                                        'border-zinc-800 text-zinc-500'
                                                    }`}>
                                                    {a.type}
                                                </span>
                                                <span className="text-[10px] text-zinc-600 font-mono">{new Date(a.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="text-base font-bold text-zinc-200 mb-1">{a.title}</h3>
                                            <p className="text-zinc-500 text-sm leading-relaxed">{a.content}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleAnnouncement(a.id, a.is_active)}
                                                className={`p-2 rounded transition-colors ${a.is_active ? 'text-white' : 'text-zinc-700 hover:text-zinc-400'}`}
                                                title="Toggle Active"
                                            >
                                                <Power size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAnnouncement(a.id)}
                                                className="p-2 text-zinc-700 hover:text-red-500 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {announcements.length === 0 && <div className="text-zinc-600 text-sm text-center py-10 border border-zinc-900 border-dashed rounded-lg">No announcements found.</div>}
                            </div>

                            {/* Create Form */}
                            <div className="border border-zinc-800 p-5 rounded-lg h-fit sticky top-24 bg-zinc-900/30">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                                    Create Announcement
                                </h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Title"
                                        value={newAnnouncement.title}
                                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-zinc-600 outline-none"
                                    />
                                    <textarea
                                        placeholder="Message content..."
                                        value={newAnnouncement.content}
                                        onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                                        rows={4}
                                        className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:border-zinc-600 outline-none resize-none"
                                    />
                                    <div className="flex gap-2">
                                        {['info', 'warning', 'success'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setNewAnnouncement(prev => ({ ...prev, type: type as any }))}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${newAnnouncement.type === type
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-zinc-600 border-zinc-800 hover:border-zinc-700'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleCreateAnnouncement}
                                        className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-2 rounded-lg text-xs transition-colors mt-2"
                                    >
                                        Publish Announcement
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PLAYLISTS TAB */}
                    {activeTab === 'playlists' && (
                        <div className="border border-zinc-800 rounded-lg overflow-hidden">
                            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
                                <h3 className="font-bold text-white text-sm">User Playlists</h3>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search playlists..."
                                        value={playlistSearch}
                                        onChange={(e) => setPlaylistSearch(e.target.value)}
                                        className="bg-black/50 text-xs text-white pl-9 pr-4 py-2 rounded border border-zinc-800 focus:border-zinc-600 outline-none w-64 placeholder:text-zinc-600"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-900/50 text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                                        <tr>
                                            <th className="px-6 py-3">Playlist</th>
                                            <th className="px-6 py-3">Content</th>
                                            <th className="px-6 py-3">Creator</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Featured</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/50 text-sm">
                                        {filteredPlaylists.map(p => {
                                            const cover = p.playlist_items?.[0]?.metadata?.poster_path;
                                            return (
                                                <tr key={p.id} className="hover:bg-zinc-900/30 transition-colors">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-800">
                                                                {cover ? (
                                                                    <img src={`https://image.tmdb.org/t/p/w200${cover}`} className="w-full h-full object-cover" alt={p.name} />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-[10px]">
                                                                        {p.name[0]}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-white">{p.name}</div>
                                                                <div className="text-xs text-zinc-600 font-mono">{p.id.slice(0, 8)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-zinc-500 text-xs">
                                                        {p.playlist_items?.length || 0} items
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="text-zinc-400 text-xs">{p.profiles?.username || 'Unknown'}</span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${p.is_public ? 'border-zinc-700 text-zinc-400' : 'border-red-900/50 text-red-700'
                                                            }`}>
                                                            {p.is_public ? 'Public' : 'Private'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <button
                                                            disabled={!p.is_public}
                                                            onClick={async () => {
                                                                try {
                                                                    await SocialService.toggleFeaturedPlaylist(p.id, !p.is_featured);
                                                                    setAllPlaylists(prev => prev.map(item => item.id === p.id ? { ...item, is_featured: !p.is_featured } : item));
                                                                } catch (e) {
                                                                    console.error(e);
                                                                }
                                                            }}
                                                            className={`text-[10px] font-bold px-3 py-1.5 rounded transition-colors uppercase tracking-wider ${!p.is_public
                                                                ? 'opacity-20 cursor-not-allowed text-zinc-600 border border-zinc-800'
                                                                : p.is_featured
                                                                    ? 'bg-white text-black hover:bg-zinc-200'
                                                                    : 'bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
                                                                }`}
                                                        >
                                                            {p.is_featured ? 'Active' : 'Promote'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredPlaylists.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-zinc-600 text-xs">
                                                    No playlists found matching "{playlistSearch}"
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* FEATURED MOVIES TAB */}
                    {activeTab === 'featured' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Featured List */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/30 flex justify-between items-center">
                                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                                        <Film size={14} className="text-zinc-500" /> Global Featured
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                                        {featuredMovies.length} Active
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {featuredMovies.map(m => (
                                        <div key={m.id} className="relative group aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                                            {m.metadata?.poster_path || m.metadata?.imageUrl ? (
                                                <img src={`https://image.tmdb.org/t/p/w300${m.metadata.poster_path || (m.metadata.imageUrl?.includes('tmdb') ? m.metadata.imageUrl.split('w500')[1] : '')}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="Movie" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-700 font-black text-4xl">
                                                    ?
                                                </div>
                                            )}

                                            <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                <span className="text-xs font-bold text-white truncate">{m.metadata?.title || m.tmdb_id}</span>
                                                <button
                                                    onClick={() => handleRemoveFeaturedMovie(m.id)}
                                                    className="mt-2 text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 py-1 rounded hover:bg-red-500 hover:text-white transition-colors uppercase font-bold tracking-wider"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {featuredMovies.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-zinc-600 text-xs border border-dashed border-zinc-800 rounded-lg">
                                            No movies featured yet.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Add Featured Form */}
                            <div className="border border-zinc-800 p-5 rounded-lg h-fit sticky top-24 bg-zinc-900/30">
                                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                                    Add Featured Content
                                </h3>
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            type="text"
                                            placeholder="Search TMDB..."
                                            value={movieSearchQuery}
                                            onChange={(e) => setMovieSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchMovies()}
                                            className="w-full bg-black border border-zinc-800 rounded px-3 pl-9 py-2 text-xs text-white focus:border-zinc-600 outline-none"
                                        />
                                        <button
                                            onClick={handleSearchMovies}
                                            disabled={isSearchingMovies || !movieSearchQuery.trim()}
                                            className="absolute right-1 top-1 bottom-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                                        >
                                            {isSearchingMovies ? '...' : 'Go'}
                                        </button>
                                    </div>

                                    {/* Search Results */}
                                    {movieSearchResults.length > 0 && (
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                            {movieSearchResults.map(movie => (
                                                <div key={movie.id} className="flex gap-3 bg-zinc-900/50 p-2 rounded border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                                    <div className="w-10 h-14 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                                                        <img src={movie.imageUrl} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="text-white text-xs font-bold truncate">{movie.title}</div>
                                                        <div className="text-zinc-500 text-[10px]">{movie.year} • {movie.mediaType}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddFeaturedMovie(movie)}
                                                        className="self-center p-2 rounded-full bg-white text-black hover:bg-zinc-200"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {movieSearchResults.length === 0 && movieSearchQuery && !isSearchingMovies && (
                                        <div className="text-center py-4 text-zinc-600 text-xs">
                                            No results found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
