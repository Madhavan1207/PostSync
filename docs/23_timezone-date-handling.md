# 23_ Local Timezone Date Handling Documentation

This document explains the resolution of the UTC date offset issue in post scheduling components.

---

## 1. Problem Description

Previously, post schedule date pickers used JavaScript's `.toISOString().split("T")[0]` to set default dates.

Because `.toISOString()` converts local time to **UTC (Coordinated Universal Time)**:
* In timezones like India (`UTC+5:30`), past **12:00 AM midnight (IST)**, the local date is `YYYY-MM-DD` (e.g. July 23rd).
* However, in UTC, the time is `06:30 PM` on the **previous day** (e.g. July 22nd).
* This caused date pickers to incorrectly display yesterday's date after midnight.

---

## 2. Solution

Created a timezone-aware helper function `getLocalDateString()` across all client date pickers:

```typescript
const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
```

By extracting `getFullYear()`, `getMonth()`, and `getDate()`, the output formatted string (`YYYY-MM-DD`) strictly matches the user's local timezone and HTML5 `<input type="date">`.

---

## 3. Updated Components

*   **[`app/(shell)/create/CreateClient.tsx`](file:///C:/Users/HP/Desktop/abcdef/PostSync/app/%28shell%29/create/CreateClient.tsx):** Solo post schedule date picker.
*   **[`app/(shell)/drafts/workspace/[id]/WorkspaceDraftDetailClient.tsx`](file:///C:/Users/HP/Desktop/abcdef/PostSync/app/%28shell%29/drafts/workspace/%5Bid%5D/WorkspaceDraftDetailClient.tsx):** Team workspace draft schedule/reschedule modal.
*   **[`components/workspace/TeamMiniCalendar.tsx`](file:///C:/Users/HP/Desktop/abcdef/PostSync/components/workspace/TeamMiniCalendar.tsx):** Team mini-calendar reschedule modal.
*   **[`app/(shell)/calendar/CalendarClient.tsx`](file:///C:/Users/HP/Desktop/abcdef/PostSync/app/%28shell%29/calendar/CalendarClient.tsx):** Calendar reschedule modal.
*   **[`app/(shell)/drafts/DraftsClient.tsx`](file:///C:/Users/HP/Desktop/abcdef/PostSync/app/%28shell%29/drafts/DraftsClient.tsx):** Drafts schedule modal.
