import React, { useEffect, useState } from 'react';
import { SocialService } from '../lib/social';
import { CommunityService } from '../lib/community';
import { Profile } from '../types';
import { Users, AlertTriangle, Activity, Settings, Power, Trash2, Search, Info, Wifi, WifiOff, LayoutDashboard, Megaphone, Database, Plus, MessageSquarePlus, Check, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { HealthService, HealthStatus } from '../services/health';

interface MobileAdminDashboardProps {
    onNavigate: (page: string, params?: any) => void;
}

export const MobileAdminDashboard: React.FC<MobileAdminDashboardProps> = ({ onNavigate }) => {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'announcements' | 'settings' | 'requests'>('overview');
    const [stats, setStats] = useState({ totalUsers: 0, totalPlaylists: 0, activeAnnouncements: 0 });
    const [users, setUsers] = useState<Profile[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [adminRequests, setAdminRequests] = useState<any[]>([]);

    // Setting state for Toggle
    const [appSettings, setAppSettings] = useState<any>({});

    // Health State
    const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([]);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);

    const [loading, setLoading] = useState(true);

    // Form State for Creating Announcements
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' as 'info' | 'warning' | 'success' });

    useEffect(() => {
        if (!isAdmin) return;
        loadData();
    }, [isAdmin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, usersData, announcementsData, settingsData, requestsData] = await Promise.all([
                SocialService.getAdminStats(),
                SocialService.getAllUsers(),
                SocialService.getAnnouncements(),
                SocialService.getAppSettings(),
                CommunityService.getRequests('all')
            ]);
            setStats(statsData);
            setUsers(usersData);
            setAnnouncements(announcementsData);
            setAppSettings(settingsData);
            setAdminRequests(requestsData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('Delete?')) return;
        try {
            await SocialService.deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    // Mobile simplified user role toggle - Replaced with direct select for parity
    const handleRoleChange = async (u: Profile, newRole: string) => {
        if (!confirm(`Change ${u.username}'s role to ${newRole}?`)) return;
        try {
            await SocialService.updateUserRole(u.id, newRole as any);
            setUsers(prev => prev.map(user =>
                user.id === u.id ? { ...user, role: newRole } : user
            ));
        } catch (e) {
            console.error(e);
            alert('Failed');
        }
    };

    const handleDeleteUser = async (u: Profile) => {
        if (!confirm(`⚠️ DELETE ${u.username}?\n\nThis will permanently remove:\n• Profile & Stats\n• All Playlists\n• Watch Parties\n• Audit logs will remain.\n\nThis action CANNOT be undone.`)) return;

        const confirmText = prompt(`Type "${u.username}" to confirm deletion:`);
        if (confirmText !== u.username) {
            alert('Deletion cancelled - username did not match');
            return;
        }

        try {
            setLoading(true);
            await SocialService.deleteUserProfile(u.id);
            setUsers(prev => prev.filter(user => user.id !== u.id));
            alert(`Successfully deleted ${u.username}.`);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Failed to delete user.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnnouncement = async () => {
        if (!newAnnouncement.title || !newAnnouncement.content) return;
        try {
            await SocialService.createAnnouncement(newAnnouncement.title, newAnnouncement.content, newAnnouncement.type);
            setNewAnnouncement({ title: '', content: '', type: 'info' });
            loadData(); // Refresh
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleSetting = async (key: string, currentValue: string) => {
        const newValue = currentValue === 'true' ? 'false' : 'true';

        // Optimistic update
        setAppSettings((prev: any) => ({ ...prev, [key]: newValue }));

        try {
            await SocialService.updateAppSetting(key, newValue);
        } catch (e) {
            console.error(e);
            // Revert on failure
            setAppSettings((prev: any) => ({ ...prev, [key]: currentValue }));
        }
    };

    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

    const toggleUserExpand = (id: string) => {
        const newSet = new Set(expandedUsers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedUsers(newSet);
    };

    if (!isAdmin) return <div className="p-10 text-center text-red-500">Access Denied</div>;

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 pt-6 px-4">
            <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

            {/* Mobile Tab Nav - Compact Icons */}
            <div className="flex justify-between mb-6 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 overflow-x-auto gap-2">
                {[
                    { id: 'overview', icon: LayoutDashboard },
                    { id: 'users', icon: Users },
                    { id: 'announcements', icon: Megaphone },
                    { id: 'requests', icon: MessageSquarePlus },
                    { id: 'health', icon: Activity },
                    { id: 'settings', icon: Settings }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex items-center justify-center p-3 rounded-xl transition-all shrink-0 ${activeTab === item.id
                            ? 'bg-zinc-800 text-white shadow-lg'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        title={item.id}
                    >
                        <item.icon size={20} />
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-zinc-900 rounded-xl" />
                    <div className="h-24 bg-zinc-900 rounded-xl" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <Users size={20} className="text-zinc-500 mb-2" />
                                <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
                                <div className="text-xs text-zinc-500">Total Users</div>
                            </div>
                            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <Activity size={20} className="text-zinc-500 mb-2" />
                                <div className="text-2xl font-bold text-white">{stats.totalPlaylists}</div>
                                <div className="text-xs text-zinc-500">Total Playlists</div>
                            </div>
                            <div className="col-span-2 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <AlertTriangle size={20} className="text-zinc-500 mb-2" />
                                <div className="text-2xl font-bold text-white">{stats.activeAnnouncements}</div>
                                <div className="text-xs text-zinc-500">Active Announcements</div>
                            </div>
                        </div>
                    )}

                    {/* USERS - Card List */}
                    {activeTab === 'users' && (
                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                                                <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}&background=27272a&color=fff&bold=true`} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div
                                                    onClick={() => toggleUserExpand(u.id)}
                                                    className="font-bold text-white text-sm cursor-pointer select-none active:text-zinc-300 transition-colors"
                                                >
                                                    {expandedUsers.has(u.id) ? u.username : u.username.split('@')[0]}
                                                    {u.username.includes('@') && (
                                                        <span className="text-[10px] text-zinc-600 ml-1.5 font-normal">
                                                            {expandedUsers.has(u.id) ? '(tap to collapse)' : '...'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col text-[10px] text-zinc-500 mt-0.5">
                                                    <span>Joined {new Date(u.created_at).toLocaleDateString()}</span>
                                                    <span className="text-zinc-400">
                                                        {((u.stats?.total_movies || 0) + (u.stats?.total_shows || 0)) || 0} watched • {users.filter(user => user.id === u.id).length} playlists
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => onNavigate('profile', { id: u.id })}
                                                className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
                                            >
                                                <Search size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(u)}
                                                className="p-2 bg-zinc-800/50 rounded-lg text-red-500/80 hover:text-red-500"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Role Selection */}
                                    <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Role</span>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u, e.target.value)}
                                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border bg-transparent outline-none ${u.role === 'admin' ? 'text-white border-white' :
                                                u.role === 'moderator' ? 'text-zinc-300 border-zinc-600' :
                                                    'text-zinc-500 border-zinc-800'
                                                }`}
                                        >
                                            <option value="user" className="bg-zinc-900 text-zinc-400">User</option>
                                            <option value="moderator" className="bg-zinc-900 text-zinc-300">Moderator</option>
                                            <option value="admin" className="bg-zinc-900 text-white">Admin</option>
                                        </select>
                                    </div>

                                    {/* Streaming Permission */}
                                    <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Stream Content</span>
                                        <button
                                            onClick={async () => {
                                                const newValue = !u.can_stream;
                                                try {
                                                    await SocialService.updateStreamingPermission(u.id, newValue);
                                                    setUsers(prev => prev.map(user =>
                                                        user.id === u.id ? { ...user, can_stream: newValue } : user
                                                    ));
                                                } catch (e) {
                                                    console.error(e);
                                                    alert('Failed to update permission');
                                                }
                                            }}
                                            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-all ${u.can_stream ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                }`}
                                        >
                                            {u.can_stream ? 'Allowed' : 'Blocked'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ANNOUNCEMENTS */}
                    {activeTab === 'announcements' && (
                        <div className="space-y-4">
                            {/* Create Form - Premium Mobile UI */}
                            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-black border border-white/5 p-5 rounded-2xl shadow-xl">
                                <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/10 rounded-lg">
                                            <Megaphone size={14} className="text-white" />
                                        </div>
                                        New Announcement
                                    </span>
                                </h3>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Title</label>
                                        <input
                                            type="text"
                                            placeholder="Brief headline..."
                                            value={newAnnouncement.title}
                                            onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-white/20 focus:bg-white/5 outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Message</label>
                                        <textarea
                                            placeholder="What's happening?"
                                            value={newAnnouncement.content}
                                            onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                                            rows={3}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-white/20 focus:bg-white/5 outline-none resize-none transition-all"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1 mb-2 block">Type</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'info', icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                                                { id: 'warning', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                                                { id: 'success', icon: Database, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setNewAnnouncement(prev => ({ ...prev, type: type.id as any }))}
                                                    className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all duration-300 ${newAnnouncement.type === type.id
                                                        ? `${type.bg} ${type.border} ${type.color} ring-1 ring-inset ring-white/10`
                                                        : 'bg-zinc-900/50 border-white/5 text-zinc-600 hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    <type.icon size={14} strokeWidth={2.5} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest">{type.id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleCreateAnnouncement}
                                        disabled={!newAnnouncement.title || !newAnnouncement.content}
                                        className="w-full mt-2 bg-white text-black font-black py-3.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-lg shadow-white/10"
                                    >
                                        Publish Now
                                    </button>
                                </div>
                            </div>

                            {/* Announcements List Header */}
                            <div className="flex items-center justify-between pt-4 px-1">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Announcements</h3>
                                <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{announcements.length}</span>
                            </div>

                            {/* Improved List Items */}
                            <div className="space-y-3 pb-8">
                                {announcements.map(a => (
                                    <div key={a.id} className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
                                        {/* Contextual Border Left */}
                                        <div className={`absolute inset-y-0 left-0 w-1 ${a.type === 'warning' ? 'bg-yellow-500' : a.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                                            }`} />

                                        <div className="flex justify-between items-start mb-2 pl-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${a.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                    a.type === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {a.type}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleToggleAnnouncement(a.id, a.is_active)}
                                                    className={`p-2 rounded-lg transition-colors ${a.is_active ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}
                                                >
                                                    <Power size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAnnouncement(a.id)}
                                                    className="p-2 bg-zinc-800 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="pl-3">
                                            <h3 className="text-white font-bold text-sm mb-1">{a.title}</h3>
                                            <p className="text-zinc-400 text-xs leading-relaxed opacity-80">{a.content}</p>
                                        </div>
                                    </div>
                                ))}
                                {announcements.length === 0 && (
                                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl opacity-50">
                                        <Megaphone size={24} className="text-zinc-600 mb-2" />
                                        <p className="text-zinc-500 text-xs font-medium">No announcements yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* REQUESTS TAB (New Mobile) */}
                    {activeTab === 'requests' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-white">Requests</h3>
                                <span className="text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded text-xs">
                                    {adminRequests.length}
                                </span>
                            </div>

                            {adminRequests.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl opacity-50">
                                    <MessageSquarePlus size={24} className="text-zinc-600 mb-2" />
                                    <p className="text-zinc-500 text-xs font-medium">No requests found</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {adminRequests.map(req => (
                                        <div key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                            <div className="flex gap-3 p-3">
                                                <div className="w-12 aspect-[2/3] bg-zinc-800 rounded overflow-hidden shrink-0">
                                                    <img src={req.poster_path} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">{req.title}</h4>
                                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                                                        <span className="uppercase">{req.media_type}</span>
                                                        <span>•</span>
                                                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${req.status === 'fulfilled' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                            }`}>
                                                            {req.status}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                                                            <MessageSquarePlus size={10} />
                                                            <span>{req.reply_count}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 justify-center ml-1">
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`Delete request "${req.title}"?`)) return;
                                                            try {
                                                                await CommunityService.deleteRequest(req.id);
                                                                setAdminRequests(prev => prev.filter(r => r.id !== req.id));
                                                            } catch (e) {
                                                                console.error(e);
                                                                alert('Failed');
                                                            }
                                                        }}
                                                        className="p-2 bg-zinc-800/50 hover:bg-red-500/10 hover:text-red-500 text-zinc-500 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            const newStatus = req.status === 'pending' ? 'fulfilled' : 'pending';
                                                            try {
                                                                await CommunityService.updateRequestStatus(req.id, newStatus);
                                                                setAdminRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: newStatus } : r));
                                                            } catch (e) {
                                                                console.error(e);
                                                            }
                                                        }}
                                                        className={`p-2 rounded-lg transition-colors ${req.status === 'fulfilled' ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 bg-zinc-800/50 hover:text-white'}`}
                                                    >
                                                        {req.status === 'fulfilled' ? <Check size={16} /> : <Check size={16} className="opacity-30" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SETTINGS - Only essential mobile settings */}
                    {activeTab === 'settings' && (
                        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-white font-bold text-sm">Registration</div>
                                    <div className="text-zinc-500 text-[10px]">Allow new signups</div>
                                </div>
                                <div
                                    onClick={() => handleToggleSetting('registration_enabled', appSettings.registration_enabled)}
                                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${appSettings.registration_enabled === 'true' ? 'bg-white' : 'bg-zinc-800'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-black rounded-full transition-transform ${appSettings.registration_enabled === 'true' ? 'translate-x-4' : ''}`} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-white font-bold text-sm">Clear History</div>
                                    <div className="text-zinc-500 text-[10px]">User privacy</div>
                                </div>
                                <div
                                    onClick={() => handleToggleSetting('clear_history_enabled', appSettings.clear_history_enabled)}
                                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${appSettings.clear_history_enabled === 'true' ? 'bg-white' : 'bg-zinc-800'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-black rounded-full transition-transform ${appSettings.clear_history_enabled === 'true' ? 'translate-x-4' : ''}`} />
                                </div>
                            </div>
                            <p className="text-xs text-zinc-600 pt-4 text-center">Visit desktop for full settings.</p>
                        </div>
                    )}

                    {/* HEALTH TAB (New) */}
                    {activeTab === 'health' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold text-white">System Status</h2>
                                <button
                                    onClick={async () => {
                                        setIsCheckingHealth(true);
                                        const results = await HealthService.checkAll();
                                        setHealthChecks(results);
                                        setIsCheckingHealth(false);
                                    }}
                                    className={`p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white ${isCheckingHealth ? 'opacity-50' : ''}`}
                                >
                                    <Activity size={18} className={isCheckingHealth ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {healthChecks.length === 0 && !isCheckingHealth && (
                                <button
                                    onClick={async () => {
                                        setIsCheckingHealth(true);
                                        const results = await HealthService.checkAll();
                                        setHealthChecks(results);
                                        setIsCheckingHealth(false);
                                    }}
                                    className="w-full py-8 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-500"
                                >
                                    <Activity className="mb-2" />
                                    <span className="text-xs">Tap to run health check</span>
                                </button>
                            )}

                            <div className="grid grid-cols-1 gap-3">
                                {healthChecks.map((check) => {
                                    const isHealthy = check.status === 'healthy';
                                    const isDegraded = check.status === 'degraded';
                                    return (
                                        <div key={check.service} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isHealthy ? 'bg-green-500/10 text-green-500' : isDegraded ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {isHealthy ? <Wifi size={16} /> : <WifiOff size={16} />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{check.service}</div>
                                                    <div className={`text-[10px] uppercase font-bold tracking-wider ${isHealthy ? 'text-green-500' : 'text-red-500'}`}>{check.status}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-white">{check.responseTime}<span className="text-xs font-normal text-zinc-500 ml-1">ms</span></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
