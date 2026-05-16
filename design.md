```markdown
# UI/UX Design Brief: Minimalist Real-Time Web Chat Platform

## Document Control
* **Project Name:** ChatApp Web (WhatsApp-Inspired Web Client)
* **Target Interface:** Desktop Web & Responsive Mobile Web Browsers
* **Design Philosophy:** Content-first, high information density, ultra-low visual cognitive load.

---

## 1. Core User Experience Pillars

To match the operational mechanics of real-time systems, the user interface must prioritize speed and utility over heavy animations or decorative components.

*   **Zero Latency Perception:** Every message interaction must feel instantaneous. The UI must utilize optimistic states to visually confirm actions before network confirmation completes.
*   **Persistent Structural Layout:** Avoid jarring page refreshes or full-screen routing transitions. The workspace is a locked layout where content changes dynamically inside dedicated views.
*   **Familiar Layout Mapping:** Rely on industry-standard messaging patterns to eliminate user onboarding friction.

---

## 2. Layout Structure & Workspace Architecture

The web interface uses a rigid, full-height single-page split pane (**35% Sidebar / 65% Main Chat Canvas**) that locks to the browser viewport bounds. No page-level scrolling is permitted.


```

┌────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (35%)             │  MAIN WORKSPACE CANVAS (65%)              │
├────────────────────────────┼───────────────────────────────────────────┤
│ [Global Header: Profile/Nav]│ [Room Header: Active Contact / Room Info] │
├────────────────────────────┼───────────────────────────────────────────┤
│ [Search & Filter Bar]      │                                           │
├────────────────────────────┤ [Scrollable Message List Area]            │
│                            │                                           │
│ [Scrollable Chat List]     │                                           │
│  - Active Room Item        │                                           │
│  - Standard Room Item      │                                           │
│                            ├───────────────────────────────────────────┤
│                            │ [Message Ingress Panel: Inputs / Actions] │
└────────────────────────────┴───────────────────────────────────────────┘

```

### 2.1 Component Specifications

#### 1. Left Sidebar Panels
*   **Global Header Utility:** Displays current user's profile avatar, action triggers for "New Chat", and a contextual global settings menu drop-down.
*   **Search Box:** A sticky input field allowing real-time character matching filtering against local active chat lists.
*   **Active Chat Stream Room Items:** Vertically scrollable list of open rooms containing:
    *   User avatar/icon.
    *   Room Name / Contact Name.
    *   Snippet of the latest message payload string.
    *   Timestamp of last activity (formatted to `HH:MM` for today, or `DD/MM/YYYY` for past history).
    *   Unread message counter badge (high-contrast background shape).
    *   Message delivery state icons (single gray check for sent, double gray checks for delivered, double blue checks for read).

#### 2. Main Workspace Canvas
*   **Contextual Room Header:** Displays active conversation details (name, avatar, and subtext indicating current status like "Online", "Last seen...", or a dynamic "typing..." string event placeholder).
*   **Scrollable Chat Feed Container:** The primary messaging viewing block. Features include:
    *   Centrally pinned historical date separation chips (e.g., "Today", "Yesterday", "May 15, 2026").
    *   Distinct visual separation between inbound and outbound content streams (Outbound messages right-aligned with accented backgrounds; inbound messages left-aligned with neutral backgrounds).
*   **Message Ingress Dock (Input Bar):** Fixed to the bottom baseline. Accommodates standard actions: text input area, emoji layout trigger button, and a persistent action button (Send icon).

---

## 3. Component Interaction States & Visual Language

### 3.1 Color System Matrix (Light & Dark Archetypes)

The color palette is deliberately reserved, pulling focus purely to text hierarchy and active structural event cues.

| Variable Layer | Light Mode Spec | Dark Mode Spec | Intent / Context |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F0F2F5` | `#0C1317` | App viewport framework background |
| **Workspace Background** | `#FFFFFF` | `#111B21` | Panels, chat list rows, components |
| **Chat Feed Backdrop** | `#EFEAE2` | `#0B141A` | Main chat view background |
| **Outbound Bubble** | `#D9FDD3` | `#005C4B` | Messages dispatched by current user |
| **Inbound Bubble** | `#FFFFFF` | `#202C33` | Messages incoming from remote peers |
| **Primary Type Text** | `#111B21` | `#E9EDEF` | Main reading typography layer |
| **Secondary Type Text**| `#667781` | `#8696A0` | Timestamps, status strings, snippets |
| **Active Accent** | `#00A884` | `#00A884` | Unread badges, system notifications |

### 3.2 Typography Rules
*   **Primary Typeface:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`.
*   **Sizing Hierarchy:**
    *   Room Headers / User Titles: `16px`, Medium Weight (`500`).
    *   Message Text Content: `14.5px`, Regular Weight (`400`), Line Height `1.4` for reading clarity.
    *   Timestamps / System Badges: `12px`, Regular Weight (`400`).

---

## 4. Key UI Flows & State Triggers

### 4.1 Message Lifecycle States (The Delivery Pipeline)
The interface must change message status indicators step-by-step to match real-time backend confirmations:


```

[User presses Enter] ──────► Appends message bubble instantly with an alpha opacity clock icon (Pending State)
│
[WebSocket Ack Received] ──► Opacity updates to full solid fill; renders a Single Gray Checkmark (Sent State)
│
[Remote Peer Ingress] ────► Updates to Double Gray Checkmarks (Delivered State)
│
[Remote Peer Visible] ────► Transitions to Double Blue Checkmarks (Read State)

```

### 4.2 Dynamic UI Micro-Interactions
*   **The Typing Indicator:** When a `user_typing_start` WebSocket frame enters the runtime engine, the room chat snippet text within the left sidebar instantly swaps its string content to green text saying `"typing..."`. In the main workspace header, the "Online" status string changes smoothly to `"typing..."`.
*   **Infinite History Hydration:** As a user scrolls to the top boundary of the active message feed container, a muted, center-aligned spinning loading wheel asset initiates. Once data-fetching REST operations append the newly paginated history chunk, the loader cleanly unmounts, and the viewport scroll anchor shifts precisely to maintain the user's focus position.
*   **Hover-State Disclosures:** Hovering a message bubble reveals a hidden, contextual down-caret button. Clicking it activates a localized popover context window for actions like "Delete Message" or "Forward Message".

---

## 5. Responsive Adaptations (Mobile Layout Strategy)

When screen width collapses to `< 768px` (Mobile Viewports), the interface automatically shifts from a dual-pane canvas split layout into a **stacked single-pane layer engine**:

1.  **Default View:** The left sidebar component detaches and stretches to occupy 100% of the active viewport width, acting as the main dashboard view.
2.  **Navigation Execution:** Tapping an active Chat Room item triggers a lateral slide animation. The conversation canvas loads full-screen on top of the dashboard stack.
3.  **Return Path:** The chat workspace view gains a left-aligned Back arrow header button on mobile viewports. Tapping this button drops the conversation viewport context and slides the dashboard list back into view.

```