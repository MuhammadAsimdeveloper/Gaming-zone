# UI credits and open-source provenance

The NeonRift Editorial Arcade refresh adapts layout and interaction *patterns* from
MIT-licensed projects. No source package, component runtime, icon set, or asset was
copied into this repository.

## shadcn/ui

- Repository: https://github.com/shadcn-ui/ui
- License: MIT
- Adapted patterns: card composition (border + radius + shadow), focus-visible ring
  treatment, and the accessible listbox/option structure used by the search combobox.
- Not added as a dependency: the project does not use React Hook Form, Radix primitives,
  or the shadcn CLI.

## Magic UI

- Repository: https://github.com/magicuidesign/magicui
- License: MIT
- Adapted patterns: the marquee layout and the bento grid composition.
- Not added as a dependency: the marquee is CSS keyframes with `prefers-reduced-motion`
  handling; no framer-motion or copied component code is used.

## Excluded

- React Bits (https://github.com/DavidHDev/react-bits): excluded because GitHub reports
  a non-standard `NOASSERTION` license. No patterns or code were used.

## Original work

All NeonRift color tokens, copy, game thumbnails, icons (Lucide, ISC), and game code are
original or already licensed in this repository. No third-party marketing copy was reused.
