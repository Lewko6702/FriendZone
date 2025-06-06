/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Forms, Menu, Select, Text, Tooltip, useEffect, useState } from "@webpack/common";

// Storage key for DataStore
const STORAGE_KEY = "vencord.plugin.timezone.userTimezones";

// Plugin settings
const settings = definePluginSettings({
    showInMemberList: {
        type: OptionType.BOOLEAN,
        description: "Show timezone in member list (for users with set timezones)",
        default: true
    },
    showAsProfileBadge: {
        type: OptionType.BOOLEAN,
        description: "Show timezone as profile badge (for users with set timezones)",
        default: true
    },
    use24HourFormat: {
        type: OptionType.BOOLEAN,
        description: "Use 24-hour format",
        default: false
    },
    showSeconds: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in time display",
        default: false
    }
});

// Storage for user timezones (userId -> timezone)
const userTimezones: Record<string, string> = {};

// Class name factory for styling
const cl = classNameFactory("vc-timezone-");

// All available timezones
const ALL_TIMEZONES = [
    { label: "None", value: "auto" },

    // Africa
    { label: "Africa/Abidjan (GMT+0)", value: "Africa/Abidjan" },
    { label: "Africa/Accra (GMT+0)", value: "Africa/Accra" },
    { label: "Africa/Algiers (CET)", value: "Africa/Algiers" },
    { label: "Africa/Cairo (EET)", value: "Africa/Cairo" },
    { label: "Africa/Casablanca (WEST)", value: "Africa/Casablanca" },
    { label: "Africa/Johannesburg (SAST)", value: "Africa/Johannesburg" },
    { label: "Africa/Lagos (WAT)", value: "Africa/Lagos" },
    { label: "Africa/Nairobi (EAT)", value: "Africa/Nairobi" },
    { label: "Africa/Tunis (CET)", value: "Africa/Tunis" },

    // America
    { label: "America/Anchorage (AKDT)", value: "America/Anchorage" },
    { label: "America/Argentina/Buenos_Aires (ART)", value: "America/Argentina/Buenos_Aires" },
    { label: "America/Bogota (COT)", value: "America/Bogota" },
    { label: "America/Chicago (CDT)", value: "America/Chicago" },
    { label: "America/Denver (MDT)", value: "America/Denver" },
    { label: "America/Halifax (ADT)", value: "America/Halifax" },
    { label: "America/Los_Angeles (PDT)", value: "America/Los_Angeles" },
    { label: "America/Mexico_City (CDT)", value: "America/Mexico_City" },
    { label: "America/New_York (EDT)", value: "America/New_York" },
    { label: "America/Phoenix (MST)", value: "America/Phoenix" },
    { label: "America/Santiago (CLT)", value: "America/Santiago" },
    { label: "America/Sao_Paulo (BRT)", value: "America/Sao_Paulo" },
    { label: "America/St_Johns (NDT)", value: "America/St_Johns" },
    { label: "America/Toronto (EDT)", value: "America/Toronto" },
    { label: "America/Vancouver (PDT)", value: "America/Vancouver" },

    // Antarctica
    { label: "Antarctica/Casey (AWST)", value: "Antarctica/Casey" },
    { label: "Antarctica/Davis (+7)", value: "Antarctica/Davis" },
    { label: "Antarctica/McMurdo (NZST)", value: "Antarctica/McMurdo" },

    // Asia
    { label: "Asia/Baghdad (AST)", value: "Asia/Baghdad" },
    { label: "Asia/Bangkok (ICT)", value: "Asia/Bangkok" },
    { label: "Asia/Beirut (EEST)", value: "Asia/Beirut" },
    { label: "Asia/Dhaka (BST)", value: "Asia/Dhaka" },
    { label: "Asia/Dubai (GST)", value: "Asia/Dubai" },
    { label: "Asia/Hong_Kong (HKT)", value: "Asia/Hong_Kong" },
    { label: "Asia/Istanbul (TRT)", value: "Asia/Istanbul" },
    { label: "Asia/Jakarta (WIB)", value: "Asia/Jakarta" },
    { label: "Asia/Jerusalem (IDT)", value: "Asia/Jerusalem" },
    { label: "Asia/Kabul (AFT)", value: "Asia/Kabul" },
    { label: "Asia/Karachi (PKT)", value: "Asia/Karachi" },
    { label: "Asia/Kathmandu (NPT)", value: "Asia/Kathmandu" },
    { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
    { label: "Asia/Kuala_Lumpur (MYT)", value: "Asia/Kuala_Lumpur" },
    { label: "Asia/Manila (PHT)", value: "Asia/Manila" },
    { label: "Asia/Riyadh (AST)", value: "Asia/Riyadh" },
    { label: "Asia/Seoul (KST)", value: "Asia/Seoul" },
    { label: "Asia/Shanghai (CST)", value: "Asia/Shanghai" },
    { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
    { label: "Asia/Taipei (CST)", value: "Asia/Taipei" },
    { label: "Asia/Tehran (IRDT)", value: "Asia/Tehran" },
    { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },

    // Atlantic
    { label: "Atlantic/Azores (AZOST)", value: "Atlantic/Azores" },
    { label: "Atlantic/Bermuda (ADT)", value: "Atlantic/Bermuda" },
    { label: "Atlantic/Canary (WEST)", value: "Atlantic/Canary" },
    { label: "Atlantic/Cape_Verde (CVT)", value: "Atlantic/Cape_Verde" },
    { label: "Atlantic/Reykjavik (GMT)", value: "Atlantic/Reykjavik" },

    // Australia
    { label: "Australia/Adelaide (ACST)", value: "Australia/Adelaide" },
    { label: "Australia/Brisbane (AEST)", value: "Australia/Brisbane" },
    { label: "Australia/Darwin (ACST)", value: "Australia/Darwin" },
    { label: "Australia/Hobart (AEST)", value: "Australia/Hobart" },
    { label: "Australia/Melbourne (AEST)", value: "Australia/Melbourne" },
    { label: "Australia/Perth (AWST)", value: "Australia/Perth" },
    { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },

    // Europe
    { label: "Europe/Amsterdam (CEST)", value: "Europe/Amsterdam" },
    { label: "Europe/Athens (EEST)", value: "Europe/Athens" },
    { label: "Europe/Belgrade (CEST)", value: "Europe/Belgrade" },
    { label: "Europe/Berlin (CEST)", value: "Europe/Berlin" },
    { label: "Europe/Brussels (CEST)", value: "Europe/Brussels" },
    { label: "Europe/Bucharest (EEST)", value: "Europe/Bucharest" },
    { label: "Europe/Budapest (CEST)", value: "Europe/Budapest" },
    { label: "Europe/Bratislava (CEST)", value: "Europe/Bratislava" },
    { label: "Europe/Copenhagen (CEST)", value: "Europe/Copenhagen" },
    { label: "Europe/Dublin (IST)", value: "Europe/Dublin" },
    { label: "Europe/Helsinki (EEST)", value: "Europe/Helsinki" },
    { label: "Europe/Kiev (EEST)", value: "Europe/Kiev" },
    { label: "Europe/Lisbon (WEST)", value: "Europe/Lisbon" },
    { label: "Europe/London (BST)", value: "Europe/London" },
    { label: "Europe/Madrid (CEST)", value: "Europe/Madrid" },
    { label: "Europe/Moscow (MSK)", value: "Europe/Moscow" },
    { label: "Europe/Oslo (CEST)", value: "Europe/Oslo" },
    { label: "Europe/Paris (CEST)", value: "Europe/Paris" },
    { label: "Europe/Prague (CEST)", value: "Europe/Prague" },
    { label: "Europe/Riga (EEST)", value: "Europe/Riga" },
    { label: "Europe/Rome (CEST)", value: "Europe/Rome" },
    { label: "Europe/Sofia (EEST)", value: "Europe/Sofia" },
    { label: "Europe/Stockholm (CEST)", value: "Europe/Stockholm" },
    { label: "Europe/Tallinn (EEST)", value: "Europe/Tallinn" },
    { label: "Europe/Vienna (CEST)", value: "Europe/Vienna" },
    { label: "Europe/Vilnius (EEST)", value: "Europe/Vilnius" },
    { label: "Europe/Warsaw (CEST)", value: "Europe/Warsaw" },
    { label: "Europe/Zurich (CEST)", value: "Europe/Zurich" },

    // Indian
    { label: "Indian/Maldives (MVT)", value: "Indian/Maldives" },
    { label: "Indian/Mauritius (MUT)", value: "Indian/Mauritius" },
    { label: "Indian/Reunion (RET)", value: "Indian/Reunion" },

    // Pacific
    { label: "Pacific/Auckland (NZST)", value: "Pacific/Auckland" },
    { label: "Pacific/Fiji (FJT)", value: "Pacific/Fiji" },
    { label: "Pacific/Guam (ChST)", value: "Pacific/Guam" },
    { label: "Pacific/Honolulu (HST)", value: "Pacific/Honolulu" },
    { label: "Pacific/Majuro (MHT)", value: "Pacific/Majuro" },
    { label: "Pacific/Midway (SST)", value: "Pacific/Midway" },
    { label: "Pacific/Noumea (NCT)", value: "Pacific/Noumea" },
    { label: "Pacific/Pago_Pago (SST)", value: "Pacific/Pago_Pago" },
    { label: "Pacific/Port_Moresby (PGT)", value: "Pacific/Port_Moresby" },
    { label: "Pacific/Tongatapu (TOT)", value: "Pacific/Tongatapu" },

    // UTC
    { label: "UTC", value: "UTC" }
];

// Get user's local timezone
function getUserLocalTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        return "UTC";
    }
}

// Format time based on timezone
function formatTimeInTimezone(timezone: string, use24Hour: boolean = false, showSeconds: boolean = false): string {
    try {
        const options: Intl.DateTimeFormatOptions = {
            hour: "numeric",
            minute: "2-digit",
            hour12: !use24Hour
        };

        if (showSeconds) {
            options.second = "2-digit";
        }

        return new Date().toLocaleTimeString(undefined, {
            ...options,
            timeZone: timezone
        });
    } catch (e) {
        return "Invalid timezone";
    }
}

// Component to display user's time
function TimeZoneDisplay({ userId, compact = false }: { userId: string, compact?: boolean; }) {
    const [currentTime, setCurrentTime] = useState<string>("");
    const timezone = userTimezones[userId];

    // If no timezone is set for this user, don't show anything
    if (!timezone) return null;

    const { use24HourFormat, showSeconds } = settings.use(["use24HourFormat", "showSeconds"]);

    useEffect(() => {
        // If auto, try to use user's local timezone or fallback to UTC
        const actualTimezone = timezone === "auto" ? getUserLocalTimezone() : timezone;

        // Update time immediately
        setCurrentTime(formatTimeInTimezone(actualTimezone, use24HourFormat, showSeconds));

        // Then update every second/minute
        const interval = setInterval(() => {
            setCurrentTime(formatTimeInTimezone(actualTimezone, use24HourFormat, showSeconds));
        }, showSeconds ? 1000 : 60000); // Update every second if showing seconds, otherwise every minute

        return () => clearInterval(interval);
    }, [userId, timezone, use24HourFormat, showSeconds]);

    if (!currentTime) return null;

    if (compact) {
        return <span className={cl("time-compact")}>{currentTime}</span>;
    }

    return (
        <div className={cl("time-container")}>
            <Tooltip text={timezone === "auto" ? "Auto-detected timezone" : timezone}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <span
                        className={cl("time")}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                    >
                        {currentTime}
                    </span>
                )}
            </Tooltip>
        </div>
    );
}

// Timezone picker modal
function TimeZonePickerModal({ modalProps, userId, username, close }: {
    modalProps: ModalProps,
    userId: string,
    username: string,
    close: () => void;
}) {
    const [selectedTimezone, setSelectedTimezone] = useState<string>(userTimezones[userId] || "auto");
    const [currentTime, setCurrentTime] = useState<string>("");
    const { use24HourFormat, showSeconds } = settings.use(["use24HourFormat", "showSeconds"]);

    // Update preview time when timezone changes
    useEffect(() => {
        const actualTimezone = selectedTimezone === "auto" ? getUserLocalTimezone() : selectedTimezone;

        // Update immediately
        setCurrentTime(formatTimeInTimezone(actualTimezone, use24HourFormat, showSeconds));

        // Then update every second/minute
        const interval = setInterval(() => {
            setCurrentTime(formatTimeInTimezone(actualTimezone, use24HourFormat, showSeconds));
        }, showSeconds ? 1000 : 60000);

        return () => clearInterval(interval);
    }, [selectedTimezone, use24HourFormat, showSeconds]);

    // Save the selected timezone
    const saveTimezone = () => {
        if (selectedTimezone === "auto") {
            delete userTimezones[userId];
        } else {
            userTimezones[userId] = selectedTimezone;
        }

        // Save to DataStore
        DataStore.set(STORAGE_KEY, userTimezones);

        close();
    };

    // Clear the timezone
    const clearTimezone = () => {
        delete userTimezones[userId];
        DataStore.set(STORAGE_KEY, userTimezones);
        close();
    };

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader>
                <Text variant="heading-lg/semibold">Set Timezone for {username}</Text>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent>
                <div className={cl("modal-content")}>
                    <Forms.FormTitle>Select Timezone</Forms.FormTitle>

                    <Forms.FormSection>
                        <Select
                            options={ALL_TIMEZONES}
                            isSelected={v => v === selectedTimezone}
                            select={v => setSelectedTimezone(v)}
                            serialize={v => v}
                            renderOptionLabel={o => (
                                <div className={cl("timezone-option")}>
                                    {o.label}
                                </div>
                            )}
                            renderOptionValue={o => (
                                <div>
                                    {(ALL_TIMEZONES.find(tz => tz.value === selectedTimezone) || ALL_TIMEZONES[0]).label}
                                </div>
                            )}
                        />
                    </Forms.FormSection>

                    <Forms.FormDivider />

                    <div className={cl("time-preview")}>
                        <Forms.FormTitle>Time Preview</Forms.FormTitle>
                        <Text variant="text-lg/normal">{currentTime}</Text>
                    </div>
                </div>
            </ModalContent>

            <ModalFooter>
                <Button
                    color={Button.Colors.BRAND}
                    onClick={saveTimezone}
                >
                    Save
                </Button>
                {userTimezones[userId] && (
                    <Button
                        color={Button.Colors.RED}
                        onClick={clearTimezone}
                    >
                        Clear Timezone
                    </Button>
                )}
                <Button
                    color={Button.Colors.LINK}
                    onClick={close}
                    look={Button.Looks.LINK}
                >
                    Cancel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

// User context menu integration
const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user) return;

    children.push(
        <Menu.MenuItem
            id="vc-set-timezone"
            label="Set Timezone"
            action={() => {
                openModal(modalProps => (
                    <TimeZonePickerModal
                        modalProps={modalProps}
                        userId={user.id}
                        username={user.username}
                        close={() => closeModal(modalProps)} 
                    />
                ));
            }}
        />
    );
};

// Badge component for profile
const TimeZoneBadge: ProfileBadge = {
    shouldShow: ({ userId }) => !!userId && userTimezones[userId] !== undefined,
    component: ({ userId }) => (
        <ErrorBoundary noop>
        <div style={{ color: "var(--header-primary)" }}>
                <TimeZoneDisplay userId={userId} />
            </div>
        </ErrorBoundary>
    ),
    position: BadgePosition.START
};

export default definePlugin({
    name: "FriendZone",
    description: "Show and set timezones for users in member list and profiles",
    authors: [
        { name: "Ryu", id: 586633092379443200n },
        { name: "Lewko", id: 736746952372256861n }
    ], 
    dependencies: ["MemberListDecoratorsAPI"],
    settings,

    async start() {
        // Load saved timezones from DataStore
        try {
            const savedTimezones = await DataStore.get(STORAGE_KEY);
            if (savedTimezones) {
                Object.assign(userTimezones, savedTimezones);
            }
        } catch (e) {
            console.error("Failed to load saved timezones", e);
        }

        // Add member list decorator
        if (settings.store.showInMemberList) {
            addMemberListDecorator("timezone", ({ user }) => (
                user && userTimezones[user.id] ? (
                    <ErrorBoundary noop>
                        <TimeZoneDisplay userId={user.id} compact={true} />
                    </ErrorBoundary>
                ) : null
            ));
        }

        // Add profile badge
        if (settings.store.showAsProfileBadge) {
            addProfileBadge(TimeZoneBadge);
        }
    },

    stop() {
        // Clean up
        removeMemberListDecorator("timezone");
        removeProfileBadge(TimeZoneBadge);
    },

    // Context menu integration
    contextMenus: {
        "user-context": UserContextMenuPatch,
        "user-profile-actions": UserContextMenuPatch
    }
});