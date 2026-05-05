---
name: refero-lift-off-challenge
description: Use this skill when you want to design or restyle a UI in the Refero "Lift-off challenge" control-panel aesthetic with a light industrial canvas, black display modules, mono technical labels, and sharp red urgency accents.
---

# Refero Lift-off Challenge

Use this skill when the user wants a UI that feels like a retro-futuristic mission-control panel rather than a generic SaaS dashboard.

## Source Files

- `references/DESIGN.md`: extracted Refero `DESIGN.md` content from the source page
- `references/source.html`: raw fetched page payload
- `references/implementation-notes.md`: condensed implementation checklist
- `assets/preview-poster.jpg`: preview still from the Refero page
- `assets/preview.mp4`: preview animation from the Refero page

## Core Aesthetic

- Keep the overall theme light, not dark.
- Use a rigid pale-grey chassis as the canvas.
- Place information inside dense black or near-black display modules.
- Use urgent red sparingly for primary actions, warnings, and high-priority focus.
- Favor compact spacing, mechanical alignment, and strong contrast over decorative softness.
- Mix a clean sans with mono technical labels and occasional digital-display numerics.

## Working Rules

1. Start by reading `references/DESIGN.md`.
2. Translate the color, typography, spacing, and shape tokens into the target stack.
3. Preserve the industrial control-panel feel:
   - compact padding
   - hard contrast
   - small technical labels
   - pill or oversized radii only where the reference explicitly uses them
4. Avoid drifting into:
   - glassmorphism
   - pastel gradients as the main look
   - oversized empty hero sections
   - generic card-grid SaaS styling
5. When building new components, prefer practical, status-heavy modules such as:
   - readout cards
   - control clusters
   - warning/action rows
   - parameter panels

## Implementation Priorities

- Build a token layer first.
- Recreate typography hierarchy before micro-details.
- Use mono captions and metadata for technical flavor.
- Reserve the red accent for the few interactions or states that should feel critical.
- Use gradients only as supporting detail, not as the dominant page treatment.

## Deliverable Standard

- The result should feel disciplined, compact, and engineered.
- It should read clearly on desktop first, then adapt to mobile without losing the control-panel hierarchy.
- If the user asks for a redesign, keep the output practical and interface-driven rather than cinematic.
