import { ProfileService } from '../services/ProfileService';
import { PlaylistService } from '../services/PlaylistService';
import { AdminService } from '../services/AdminService';
import { NotificationService } from '../services/NotificationService';
import { PlayerProviderService } from '../services/PlayerProviderService';
import { GuestAccessService } from '../services/GuestAccessService';
import { DirectMessageService } from '../services/DirectMessageService';

/**
 * SocialService Facade
 * 
 * Aggregates functionality from specialized services to maintain backward compatibility.
 * @deprecated Prefer importing specific services directly in new code.
 */
export const SocialService = {
    ...ProfileService,
    ...PlaylistService,
    ...AdminService,
    ...NotificationService,
    ...PlayerProviderService,
    ...GuestAccessService,
    ...DirectMessageService
};
