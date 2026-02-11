/**
 * Alert Generators — Creates natural language alerts for blind spots and drift
 * Based on MISIR_DASHBOARD_SPECIFICATION.md v1.0 Alert Writing Formula
 * Tone: Curious, not judgmental. Insightful, not prescriptive. Encouraging, not nagging.
 */

export interface AlertItem {
    id: number;
    title: string | null;
    url: string;
    margin: number;
    topic_name?: string;
}

export interface AlertAction {
    label: string;
    action: 'review' | 'reclassify' | 'create_topic' | 'ignore';
    target?: string;
}

export interface Alert {
    id: string;
    type: 'info' | 'warning' | 'success' | 'danger';
    title: string;
    message: string;
    actions?: AlertAction[];
    space_id?: number;
}

/**
 * Generates alert for items with low assignment margin (blind spots)
 * Trigger: margin < 0.3 for multiple items in same space
 * @param items - Array of low-margin artifacts
 * @param space_name - Name of the space
 * @param space_id - ID of the space
 * @returns Alert object with suggested actions
 */
export function generateLowMarginAlert(
    items: AlertItem[],
    space_name: string,
    space_id: number
): Alert {
    const count = items.length;

    return {
        id: `low-margin-${space_id}`,
        type: 'info',
        title: '💡 We noticed something interesting:',
        message: `Your last ${count} ${count === 1 ? 'item doesn\'t' : 'items don\'t'} fit neatly into your existing topics in "${space_name}". This usually means you're discovering something new.`,
        actions: [
            {
                label: 'Create a new topic area',
                action: 'create_topic',
            },
            {
                label: 'Review these items together',
                action: 'review',
                target: `/dashboard/spaces/${space_id}/library?filter=low-margin`,
            },
            {
                label: 'Keep exploring - we\'ll keep tracking',
                action: 'ignore',
            },
        ],
        space_id,
    };
}

/**
 * Generates alert for high drift event (topic focus shifted)
 * Trigger: drift magnitude > 0.3 for a topic
 * @param artifact - Newly saved artifact that caused drift
 * @param topic_name - Name of affected topic
 * @param drift - Drift magnitude (0-1)
 * @param space_id - ID of the space
 * @returns Alert object
 */
export function generateHighDriftAlert(
    artifact: { id: number; title: string | null; url: string },
    topic_name: string,
    drift: number,
    space_id: number
): Alert {
    const title = artifact.title || 'this item';
    return {
        id: `high-drift-${artifact.id}`,
        type: 'warning',
        title: '🔄 Your focus is shifting:',
        message: `After reading "${title}," your understanding of ${topic_name} evolved significantly. This is normal when exploring new perspectives.`,
        actions: [
            {
                label: 'See what changed',
                action: 'review',
                target: `/dashboard/spaces/${space_id}/map`,
            },
        ],
        space_id,
    };
}

/**
 * Generates alert for velocity drop (user slowed down saving)
 * Trigger: current_week_count < (30_day_avg * 0.5)
 * @param current - Items saved this week
 * @param average - 30-day average
 * @param space_name - Name of space
 * @param space_id - ID of the space
 * @returns Alert object
 */
export function generateVelocityDropAlert(
    current: number,
    average: number,
    space_name: string,
    space_id: number
): Alert {
    const avg = Math.round(average);
    return {
        id: `velocity-drop-${space_id}`,
        type: 'info',
        title: '📉 You\'ve slowed down:',
        message: `You're saving ${current < 1 ? 'less than 1' : Math.round(current)} item${Math.round(current) === 1 ? '' : 's'} per week in "${space_name}", down from your usual ${avg}. Busy week, or losing momentum?`,
        actions: [
            {
                label: 'View space',
                action: 'review',
                target: `/dashboard/spaces/${space_id}`,
            },
            {
                label: 'Dismiss',
                action: 'ignore',
            },
        ],
        space_id,
    };
}

/**
 * Generates alert for confidence drop in a topic
 * Trigger: confidence dropped > 0.2 in recent period
 * @param topic_name - Name of topic
 * @param old_confidence - Previous confidence score
 * @param new_confidence - Current confidence score
 * @param space_id - ID of the space
 * @returns Alert object
 */
export function generateConfidenceDropAlert(
    topic_name: string,
    old_confidence: number,
    new_confidence: number,
    space_id: number
): Alert {
    return {
        id: `confidence-drop-${topic_name}`,
        type: 'warning',
        title: '⚠️ This topic is getting messy:',
        message: `Your recent reads in "${topic_name}" cover very different angles. You might want to split this into separate topic areas.`,
        actions: [
            {
                label: 'Review topics',
                action: 'review',
                target: `/dashboard/spaces/${space_id}/library?topic=${encodeURIComponent(topic_name)}`,
            },
            {
                label: 'View on map',
                action: 'review',
                target: `/dashboard/spaces/${space_id}/map`,
            },
        ],
        space_id,
    };
}

/**
 * Aggregates multiple alerts into a summary banner message
 * @param alerts - Array of Alert objects
 * @returns Summary string for banner display
 */
export function summarizeAlerts(alerts: Alert[]): string {
    const warningCount = alerts.filter((a) => a.type === 'warning').length;
    const infoCount = alerts.filter((a) => a.type === 'info').length;

    if (warningCount > 0 && infoCount > 0) {
        return `⚠️ ${warningCount + infoCount} spaces need your attention`;
    }
    if (warningCount > 0) {
        return `⚠️ ${warningCount} space${warningCount === 1 ? '' : 's'} ${warningCount === 1 ? 'has' : 'have'} items that don't fit well`;
    }
    if (infoCount > 0) {
        return `ℹ️ ${infoCount} update${infoCount === 1 ? '' : 's'} in your spaces`;
    }
    return 'All clear ✅';
}
