# DealTrace design rules

## Colour tokens (CSS variables in src/styles/index.css; use only these)
brand #2B59C3 (primary buttons, links, active nav, chart accent)
brand-hover #234AA6
brand-subtle #EEF3FC (selected rows, active nav background)
bg-app #F7F8FA · bg-surface #FFFFFF · border #E4E7EC
text #101828 · text-muted #667085
sev-critical #B42318 · sev-high #C4320A · sev-medium #B54708 · sev-low #475467
success #067647
Badges: colour as text plus a 10% tint as background, never solid bright fills.

## Typography
IBM Plex Sans for UI; IBM Plex Mono for IDs, VINs, hashes and money in tables. Tabular numbers for all figures.
Page title 20/28 semibold · Section title 16/24 semibold · Body 14/20 · Table 13/18 · Caption 12/16.
Sentence case everywhere. No ALL CAPS headings.

## Layout
4px grid. Page padding 24. Card padding 16. Gaps 16 or 24. Max content width 1440.
Radius 6 for inputs and buttons, 8 for cards and sheets. Never larger.
1px borders. Shadow only on popovers and sheets, very soft.
Tables: row height 40, sticky header, hover background, right-aligned numbers.

## Components
Buttons: primary, secondary (white with border), ghost, destructive; height 32 or 36.
KPI card: small muted label, 24px semibold value, small change indicator ("+12% vs last 30 days").
Severity badge: coloured dot + word. Status badge: neutral outline.
Icons: lucide-react, 16px, stroke 1.75, always next to a label in nav and buttons.

## Charts
One quiet grey for data plus the brand colour for the series that matters. Severity colours only in severity charts.
Light gridlines. Values or axis, not both. No pie charts unless 4 or fewer parts of a whole. No 3D, no gradients.

## States (every data view has all four)
Loading: skeletons matching the final layout. Empty: small icon, one sentence, one action.
Error: one sentence and a Retry button. Success: toast after every action ("Decision saved · F-2291 marked Fix before funding").

## Motion
150 to 200 ms ease-out for sheets, tabs and number changes. No bouncing, no confetti.

## Copy
Short, specific, calm. Real names, IDs and amounts. No exclamation marks, no emoji. Never say "fraud".

## Do NOT (these make a UI look AI-generated)
purple or blue gradients, glassmorphism, glowing borders, neon accents; emoji as icons; big hero illustrations; oversized headings;
every card the same size in a rainbow of colours; default template look left unchanged; rounded-2xl/3xl corners; heavy shadows;
empty space instead of data; one hero record and nothing else; buttons that do nothing.

## Accessibility
Contrast at least 4.5:1, visible brand-colour focus rings, full keyboard navigation, aria-labels on icon-only buttons.
