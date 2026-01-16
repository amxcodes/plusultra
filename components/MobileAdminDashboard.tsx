import React, { useEffect, useState } from 'react';
import { SocialService } from '../lib/social';
import { Profile } from '../types';
import { Users, AlertTriangle, Activity, Settings, Power, Trash2, Search, Info, Wifi, WifiOff, LayoutDashboard, Megaphone, Database } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { HealthService, HealthStatus } from '../services/health';

interface MobileAdminDashboardProps {
    onNavigate: (page: string, params?: any) => void;
}

export const MobileAdminDashboard: React.FC<MobileAdminDashboardProps> = ({ onNavigate }) => {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'announcements' | 'settings'>('overview');
    const [stats, setStats] = useState({ totalUsers: 0, totalPlaylists: 0, activeAnnouncements: 0 });
    const [users, setUsers] = useState<Profile[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);

    // Setting state for Toggle
    const [appSettings, setAppSettings] = useState<any>({});

    // Health State
    const [healthChecks, setHealthChecks] = useState<HealthStatus[]>([]);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin) return;
        loadData();
    }, [isAdmin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, usersData, announcementsData, settingsData] = await Promise.all([
                SocialService.getAdminStats(),
                SocialService.getAllUsers(),
                SocialService.getAnnouncements(),
                SocialService.getAppSettings()
            ]);
            setStats(statsData);
            setUsers(usersData);
            setAnnouncements(announcementsData);
            setAppSettings(settingsData);
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

    if (!isAdmin) return <div className="p-10 text-center text-red-500">Access Denied</div>;

    return (
        <div className="min-h-screen bg-[#0f1014] pb-24 pt-6 px-4">
            <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

            {/* Mobile Tab Nav - Compact Icons */}
            <div className="flex justify-between mb-6 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5">
                {[
                    { id: 'overview', icon: LayoutDashboard },
                    { id: 'users', icon: Users },
                    { id: 'announcements', icon: Megaphone },
                    { id: 'health', icon: Activity },
                    { id: 'settings', icon: Settings }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex items-center justify-center p-3 rounded-xl transition-all ${activeTab === item.id
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
                                                <div className="font-bold text-white text-sm">{u.username}</div>
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
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ANNOUNCEMENTS */}
                    {activeTab === 'announcements' && (
                        <div className="space-y-3">
                            <p className="text-xs text-zinc-500 mb-2">Tap toggle to activate/deactivate</p>
                            {announcements.map(a => (
                                <div key={a.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${a.type === 'warning' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-zinc-800 text-zinc-400'
                                            }`}>{a.type}</div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleToggleAnnouncement(a.id, a.is_active)} className={`${a.is_active ? 'text-green-500' : 'text-zinc-600'}`}>
                                                <Power size={18} />
                                            </button>
                                            <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-zinc-600 hover:text-red-500">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="text-white font-bold text-sm">{a.title}</h3>
                                    <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{a.content}</p>
                                </div>
                            ))}
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
