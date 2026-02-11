'use client';

import { useState, useEffect } from 'react';
import { User, Palette, Shield, Zap, Save, Loader2, Check, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useProfile, useUpdateSettings } from '@/lib/api/profile';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { UserSettings } from '@/types/api';

export default function SettingsPage() {
    const { user } = useAuth();
    const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
    const updateSettings = useUpdateSettings();

    // Local state for settings
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('dark');
    const [density, setDensity] = useState<'comfortable' | 'compact' | 'cozy'>('comfortable');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [retentionDays, setRetentionDays] = useState<number>(365);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Load settings from profile
    useEffect(() => {
        if (profile?.settings) {
            const settings = profile.settings as UserSettings;
            if (settings.theme) setTheme(settings.theme);
            if (settings.density) setDensity(settings.density);
            if (settings.notifications_enabled !== undefined) setNotificationsEnabled(settings.notifications_enabled);
            if (settings.retention_days) setRetentionDays(settings.retention_days);
        }
    }, [profile]);

    // Track changes
    useEffect(() => {
        if (profile?.settings) {
            const settings = profile.settings as UserSettings;
            const changed =
                theme !== (settings.theme || 'dark') ||
                density !== (settings.density || 'comfortable') ||
                notificationsEnabled !== (settings.notifications_enabled ?? true) ||
                retentionDays !== (settings.retention_days || 365);
            setHasChanges(changed);
        }
    }, [theme, density, notificationsEnabled, retentionDays, profile]);

    const handleSave = async () => {
        if (!user?.id) return;

        setSaveSuccess(false);
        const newSettings: UserSettings = {
            theme,
            density,
            notifications_enabled: notificationsEnabled,
            retention_days: retentionDays,
        };

        try {
            await updateSettings.mutateAsync({
                userId: user.id,
                settings: newSettings,
            });
            setHasChanges(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    if (profileLoading) {
        return (
            <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0] flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-[#5E6AD2]" />
            </div>
        );
    }

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-[#EEEEF0]">Settings</h1>
                    <p className="text-[14px] text-[#8A8F98] mt-1">Customize your Misir experience</p>
                </div>

                {/* Save Button (Sticky) */}
                {hasChanges && (
                    <div className="sticky top-0 z-10 bg-[#0B0C0E]/95 backdrop-blur-sm border-b border-white/5 -mx-6 px-6 py-3 mb-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] text-[#8A8F98]">You have unsaved changes</p>
                            <Button
                                onClick={handleSave}
                                disabled={updateSettings.isPending}
                                className="bg-[#5E6AD2] hover:bg-[#4E5AC2] text-white"
                            >
                                {updateSettings.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <Check className="mr-2 size-4" />
                                        Saved!
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 size-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Appearance Settings (Job 39) */}
                <Card className="bg-[#141517] border-white/5">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Palette className="size-5 text-[#5E6AD2]" />
                            <CardTitle className="text-[16px] font-medium">Appearance</CardTitle>
                        </div>
                        <CardDescription className="text-[13px] text-[#8A8F98]">
                            Customize the look and feel of Misir
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Theme */}
                        <div className="space-y-2">
                            <Label htmlFor="theme" className="text-[14px] text-[#EEEEF0]">
                                Theme
                            </Label>
                            <Select value={theme} onValueChange={(value: any) => setTheme(value)}>
                                <SelectTrigger id="theme" className="bg-[#0B0C0E] border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="light">Light</SelectItem>
                                    <SelectItem value="dark">Dark</SelectItem>
                                    <SelectItem value="auto">Auto (system)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[12px] text-[#5F646D]">
                                Choose between light, dark, or match your system settings
                            </p>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Density */}
                        <div className="space-y-2">
                            <Label htmlFor="density" className="text-[14px] text-[#EEEEF0]">
                                Interface Density
                            </Label>
                            <Select value={density} onValueChange={(value: any) => setDensity(value)}>
                                <SelectTrigger id="density" className="bg-[#0B0C0E] border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="comfortable">Comfortable (Default)</SelectItem>
                                    <SelectItem value="compact">Compact</SelectItem>
                                    <SelectItem value="cozy">Cozy</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[12px] text-[#5F646D]">
                                Adjust spacing and component sizes
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Privacy & Data (Job 40) */}
                <Card className="bg-[#141517] border-white/5">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Shield className="size-5 text-emerald-500" />
                            <CardTitle className="text-[16px] font-medium">Privacy & Data</CardTitle>
                        </div>
                        <CardDescription className="text-[13px] text-[#8A8F98]">
                            Control your data and privacy settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Notifications */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="notifications" className="text-[14px] text-[#EEEEF0]">
                                    Enable Notifications
                                </Label>
                                <p className="text-[12px] text-[#5F646D]">
                                    Receive alerts for drift, low margins, and insights
                                </p>
                            </div>
                            <Switch
                                id="notifications"
                                checked={notificationsEnabled}
                                onCheckedChange={setNotificationsEnabled}
                            />
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Retention Policy */}
                        <div className="space-y-2">
                            <Label htmlFor="retention" className="text-[14px] text-[#EEEEF0]">
                                Data Retention Period
                            </Label>
                            <Select
                                value={retentionDays.toString()}
                                onValueChange={(value) => setRetentionDays(parseInt(value))}
                            >
                                <SelectTrigger id="retention" className="bg-[#0B0C0E] border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="90">90 days</SelectItem>
                                    <SelectItem value="180">180 days (6 months)</SelectItem>
                                    <SelectItem value="365">365 days (1 year)</SelectItem>
                                    <SelectItem value="730">730 days (2 years)</SelectItem>
                                    <SelectItem value="-1">Forever</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[12px] text-[#5F646D]">
                                How long to keep your artifacts and analytics data
                            </p>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Export Data */}
                        <div className="space-y-2">
                            <Label className="text-[14px] text-[#EEEEF0]">Export Your Data</Label>
                            <p className="text-[12px] text-[#5F646D] mb-3">
                                Download all your spaces, artifacts, and insights
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" className="text-[13px]" disabled>
                                    Export as JSON
                                </Button>
                                <Button variant="outline" className="text-[13px]" disabled>
                                    Export as CSV
                                </Button>
                            </div>
                            <p className="text-[11px] text-amber-500/70">Coming soon</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Advanced Settings (Job 41) */}
                <Card className="bg-[#141517] border-white/5">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Zap className="size-5 text-purple-500" />
                            <CardTitle className="text-[16px] font-medium">Advanced</CardTitle>
                        </div>
                        <CardDescription className="text-[13px] text-[#8A8F98]">
                            Model configuration and system diagnostics
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* How Misir Works */}
                        <div className="space-y-2">
                            <Label className="text-[14px] text-[#EEEEF0]">How Misir Works</Label>
                            <p className="text-[12px] text-[#5F646D] mb-3">
                                Learn about the algorithms powering your knowledge organization
                            </p>
                            <Button
                                variant="outline"
                                className="text-[13px]"
                                onClick={() => window.open('https://github.com/misir-ai/misir/blob/main/docs/algorithms.md', '_blank')}
                            >
                                <ExternalLink className="mr-2 size-3" />
                                View Algorithm Documentation
                            </Button>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Model Configuration */}
                        <div className="space-y-3">
                            <Label className="text-[14px] text-[#EEEEF0]">Model Configuration</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Embedding Model</div>
                                    <div className="text-[13px] text-[#EEEEF0] font-mono">nomic-embed-text-v1.5</div>
                                </div>
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Dimension</div>
                                    <div className="text-[13px] text-[#EEEEF0] font-mono">768</div>
                                </div>
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Drift Sensitivity</div>
                                    <div className="text-[13px] text-[#EEEEF0] font-mono">0.05</div>
                                </div>
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Margin Threshold</div>
                                    <div className="text-[13px] text-[#EEEEF0] font-mono">0.3</div>
                                </div>
                            </div>
                            <p className="text-[11px] text-[#5F646D]">
                                These values are configured at the system level
                            </p>
                        </div>

                        <Separator className="bg-white/5" />

                        {/* Diagnostics */}
                        <div className="space-y-3">
                            <Label className="text-[14px] text-[#EEEEF0]">System Diagnostics</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Account Created</div>
                                    <div className="text-[13px] text-[#EEEEF0]">
                                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                                    </div>
                                </div>
                                <div className="p-3 bg-[#0B0C0E] border border-white/5 rounded">
                                    <div className="text-[11px] text-[#5F646D] mb-1">Onboarding Status</div>
                                    <div className="text-[13px] text-[#EEEEF0]">
                                        {profile?.onboarding_completed ? '✅ Complete' : '⚠️ Incomplete'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Danger Zone */}
                <Card className="bg-red-500/5 border-red-500/20">
                    <CardHeader>
                        <CardTitle className="text-[16px] font-medium text-red-400">Danger Zone</CardTitle>
                        <CardDescription className="text-[13px] text-[#8A8F98]">
                            Irreversible actions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label className="text-[14px] text-[#EEEEF0]">Delete Account</Label>
                            <p className="text-[12px] text-[#5F646D] mb-3">
                                Permanently delete your account and all associated data. This cannot be undone.
                            </p>
                            <Button variant="destructive" disabled className="text-[13px]">
                                Delete Account
                            </Button>
                            <p className="text-[11px] text-amber-500/70">Contact support to delete your account</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
